/**
 * One-off, idempotent: gives every dish that is already PUBLISHED a live snapshot, so nothing that was visible
 * stops being visible when publishing snapshots are introduced. Safe to run on every start: with nothing to do it is one query.
 * It never fails the deploy: problems are logged and the server still starts.
 */
import 'dotenv/config';
import { PrismaClient, ReviewStatus } from '@prisma/client';
import { publishRecipe } from '../src/modules/publishing/publishing.service';

const prisma = new PrismaClient();

async function main() {
  const pending = await prisma.recipe.findMany({ where: { status: ReviewStatus.PUBLISHED, liveSnapshotId: null }, select: { id: true, name: true } });
  for (const r of pending) {
    await prisma.$transaction((tx) => publishRecipe(tx, r.id, 'system-backfill', { enforceReady: false }));
    console.log(`[backfill] created live snapshot for "${r.name}"`);
  }
  console.log(`[backfill] ${pending.length} snapshot(s) created`);
}

main()
  .catch((e) => console.error('[backfill] skipped because of an error (the server will still start):', e))
  .finally(() => prisma.$disconnect());
