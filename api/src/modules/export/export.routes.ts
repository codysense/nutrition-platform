import { Router } from 'express';
import { ReviewStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { authenticate } from '../../middleware/auth';

export const exportRouter = Router();
exportRouter.use(authenticate);

const query = z.object({ status: z.nativeEnum(ReviewStatus).optional() });

/** CSV-safe cell. Leading = + - @ are neutralised so a spreadsheet never runs text as a formula. */
const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
const today = () => new Date().toISOString().slice(0, 10);

async function loadDishes(status?: ReviewStatus) {
  const rows = await prisma.recipe.findMany({
    where: status ? { status } : {},
    orderBy: { legacyNo: 'asc' },
    include: {
      aliases: true,
      lines: { orderBy: { position: 'asc' }, select: { rawText: true } },
      comments: { where: { resolved: false, field: { not: 'status' } }, include: { author: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });
  return rows.map((r) => ({
    id: r.id, legacyNo: r.legacyNo, name: r.name, category: r.category, cuisine: r.cuisine, region: r.region, status: r.status,
    healthBenefits: r.healthBenefits, keyNutrients: r.keyNutrients, cautions: r.cautions, frequencyGuide: r.frequencyGuide,
    allergenFlags: r.allergenFlags, containsAnimalFlesh: r.containsAnimalFlesh, storageGuidance: r.storageGuidance,
    ingredients: r.lines.map((l) => l.rawText),
    aliases: r.aliases.map((a) => ({ language: a.language, name: a.name, verified: a.verified })),
    namesVerified: r.namesVerified,
    openComments: r.comments.map((c) => ({ field: c.field, body: c.body, author: c.author.name })),
  }));
}

// Everything a dietitian needs to read a dish offline (also feeds the printable review sheet in the web app).
exportRouter.get(
  '/dishes.json',
  ah(async (req, res) => {
    const { status } = query.parse(req.query);
    const items = await loadDishes(status);
    await audit(req.user!.id, 'EXPORT', 'Recipe', undefined, { format: 'json', status: status ?? 'ALL', count: items.length });
    res.json({ generatedAt: new Date().toISOString(), status: status ?? null, items });
  }),
);

exportRouter.get(
  '/dishes.csv',
  ah(async (req, res) => {
    const { status } = query.parse(req.query);
    const items = await loadDishes(status);
    const head = ['#', 'Dish', 'Category', 'Cuisine', 'Region', 'Status', 'Health benefits', 'Key nutrients', 'Cautions / tips',
      'Eating-frequency guide (draft)', 'Allergen flags', 'Animal flesh in recipe', 'Storage guidance', 'Ingredients', 'Local names',
      'Local names verified', 'Open comments'];
    const body = items.map((d) => [
      d.legacyNo, d.name, d.category, d.cuisine, d.region, d.status, d.healthBenefits, d.keyNutrients, d.cautions, d.frequencyGuide,
      d.allergenFlags.join('; '), d.containsAnimalFlesh, d.storageGuidance, d.ingredients.join(' | '),
      d.aliases.map((a) => `${a.language}: ${a.name}${a.verified ? ' (verified)' : ''}`).join('; '), d.namesVerified ? 'Yes' : 'No',
      d.openComments.map((c) => `[${c.field ?? 'general'}] ${c.author}: ${c.body}`).join(' | '),
    ]);
    await audit(req.user!.id, 'EXPORT', 'Recipe', undefined, { format: 'csv', status: status ?? 'ALL', count: items.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dishes-${today()}.csv"`);
    res.send(csv([head, ...body]));
  }),
);

exportRouter.get(
  '/foods.csv',
  ah(async (req, res) => {
    const { status } = query.parse(req.query);
    const [nutrients, foods] = await Promise.all([
      prisma.nutrient.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.food.findMany({
        where: status ? { status } : {},
        orderBy: { code: 'asc' },
        include: { aliases: true, nutrients: true, _count: { select: { lines: true } } },
      }),
    ]);
    const head = ['Code', 'Foodstuff', 'Category', 'Status', 'Botanical name', 'Allergen note', 'Local names', 'Local names verified',
      'Nutrient reference form', 'Used in (ingredient lines)', ...nutrients.map((n) => `${n.name} (${n.unit})`)];
    const body = foods.map((f) => [
      f.code, f.name, f.category, f.status, f.botanicalName, f.allergenNote,
      f.aliases.map((a) => `${a.language}: ${a.name}${a.verified ? ' (verified)' : ''}`).join('; '), f.namesVerified ? 'Yes' : 'No',
      f.referenceForm, f._count.lines,
      ...nutrients.map((n) => f.nutrients.find((v) => v.nutrientId === n.id)?.amount.toString() ?? ''),
    ]);
    await audit(req.user!.id, 'EXPORT', 'Food', undefined, { format: 'csv', status: status ?? 'ALL', count: foods.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="foodstuffs-${today()}.csv"`);
    res.send(csv([head, ...body]));
  }),
);
