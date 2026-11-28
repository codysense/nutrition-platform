/**
 * Suggests a role for every ingredient line that no person has confirmed yet. Idempotent: lines a person has touched
 * (roleConfirmed = true) are never changed, and unchanged suggestions are skipped, so running it on every start is cheap.
 * It never fails the deploy: problems are logged and the server still starts.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { suggestRole } from '../src/modules/ingredients/roles';

const prisma = new PrismaClient();

async function main() {
  const lines = await prisma.recipeIngredientLine.findMany({
    where: { roleConfirmed: false },
    select: { id: true, rawText: true, optional: true, role: true, foods: { select: { name: true, category: true } } },
  });
  let changed = 0;
  for (const l of lines) {
    const role = suggestRole({ rawText: l.rawText, optional: l.optional, foods: l.foods });
    if (role !== l.role) {
      await prisma.recipeIngredientLine.update({ where: { id: l.id }, data: { role } });
      changed++;
    }
  }
  console.log(`[backfill-roles] checked ${lines.length} unconfirmed line(s), updated ${changed}`);
}

main()
  .catch((e) => console.error('[backfill-roles] skipped because of an error (the server will still start):', e))
  .finally(() => prisma.$disconnect());
