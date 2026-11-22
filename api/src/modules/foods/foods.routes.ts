import { Router } from 'express';
import { DataQuality, EvidenceLevel, Prisma, ReviewStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { authenticate, requireRole } from '../../middleware/auth';
import { EDITORS, REVIEWERS } from '../../lib/roles';
import { bulkChangeStatus, editSideEffects } from '../review/review.service';
import { mountReviewRoutes } from '../review/review.routes';
import { allowedTransitions } from '../review/workflow';

export const foodsRouter = Router();
foodsRouter.use(authenticate);

const listQuery = z.object({
  q: z.string().trim().optional(),
  status: z.nativeEnum(ReviewStatus).optional(),
  category: z.string().optional(),
  missingNutrients: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});


type FoodFilter = { q?: string; status?: ReviewStatus; category?: string; missingNutrients?: 'true' | 'false' };
const foodWhere = (q: FoodFilter): Prisma.FoodWhereInput => ({
  ...(q.status && { status: q.status }),
  ...(q.category && { category: q.category }),
  ...(q.missingNutrients === 'true' && { nutrients: { none: {} } }),
  ...(q.q && {
    OR: [
      { name: { contains: q.q, mode: 'insensitive' } },
      { aliases: { some: { name: { contains: q.q, mode: 'insensitive' } } } },
    ],
  }),
});

const BULK_MAX = 500;
const bulkSchema = z
  .object({
    ids: z.array(z.string()).min(1).max(BULK_MAX).optional(),
    filter: z
      .object({
        q: z.string().trim().optional(), status: z.nativeEnum(ReviewStatus).optional(), category: z.string().optional(),
        missingNutrients: z.enum(['true', 'false']).optional(),
      })
      .optional(),
    to: z.nativeEnum(ReviewStatus),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => !!v.ids !== !!v.filter, { message: 'Provide either ids or filter' });

foodsRouter.post(
  '/bulk-status',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const body = bulkSchema.parse(req.body);
    const ids = body.ids ?? (await prisma.food.findMany({ where: foodWhere(body.filter!), select: { id: true }, take: BULK_MAX + 1 })).map((r) => r.id);
    if (ids.length === 0) throw new AppError(400, 'Nothing matches that selection');
    if (ids.length > BULK_MAX) throw new AppError(400, `Too many items (limit ${BULK_MAX}). Narrow the filter.`);
    res.json(await bulkChangeStatus('food', ids, req.user!, body.to, body.note));
  }),
);

foodsRouter.get(
  '/',
  ah(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where = foodWhere(q);
    const [total, items] = await Promise.all([
      prisma.food.count({ where }),
      prisma.food.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, code: true, name: true, category: true, status: true, namesVerified: true, updatedAt: true,
          aliases: { select: { language: true, name: true } },
          _count: { select: { nutrients: true, lines: true, comments: { where: { resolved: false } } } },
        },
      }),
    ]);
    res.json({ items, total, page: q.page, pageSize: q.pageSize });
  }),
);

foodsRouter.get(
  '/:id',
  ah(async (req, res) => {
    const food = await prisma.food.findUnique({
      where: { id: req.params.id },
      include: {
        aliases: true,
        nutrients: { include: { nutrient: true, source: { select: { id: true, title: true, publicationYear: true } } } },
        comments: { orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, name: true, role: true } } } },
        lines: { select: { recipe: { select: { id: true, name: true, legacyNo: true } } } },
      },
    });
    if (!food) throw new AppError(404, 'Foodstuff not found');
    const { lines, ...rest } = food;
    const usedIn = [...new Map(lines.map((l) => [l.recipe.id, l.recipe])).values()];
    const user = req.user!;
    res.json({
      ...rest,
      usedIn,
      allowedTransitions: allowedTransitions({ from: food.status, role: user.role, actorId: user.id, lastEditedById: food.lastEditedById }),
    });
  }),
);

const nullableText = z.string().trim().max(2000).nullable();
const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1),
    forms: nullableText,
    botanicalName: nullableText,
    allergenNote: nullableText,
    referenceForm: nullableText,
    namesVerified: z.boolean(),
  })
  .partial()
  .strict();

foodsRouter.patch(
  '/:id',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const body = patchSchema.parse(req.body);
    const user = req.user!;
    const keys = Object.keys(body);
    if (!keys.length) throw new AppError(400, 'Nothing to update');
    if (keys.includes('namesVerified') && !REVIEWERS.includes(user.role)) throw new AppError(403, 'Only a reviewer can mark names as verified');
    const existing = await prisma.food.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!existing) throw new AppError(404, 'Foodstuff not found');
    if (existing.status === ReviewStatus.ARCHIVED) throw new AppError(409, 'Archived foodstuffs cannot be edited');
    const contentChanged = keys.some((k) => k !== 'namesVerified');
    const effects = contentChanged ? editSideEffects(existing.status, user.id) : { invalidates: false, data: {} };
    const updated = await prisma.food.update({ where: { id: req.params.id }, data: { ...body, ...effects.data } });
    await audit(user.id, 'UPDATE', 'Food', updated.id, { fields: keys, approvalInvalidated: effects.invalidates });
    res.json(updated);
  }),
);

foodsRouter.put(
  '/:id/aliases',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const { aliases } = z
      .object({ aliases: z.array(z.object({ language: z.string().trim().min(1), name: z.string().trim().min(1), verified: z.boolean().default(false) })) })
      .parse(req.body);
    const existing = await prisma.food.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!existing) throw new AppError(404, 'Foodstuff not found');
    // Only reviewers can verify names. Others keep existing verified flags only for names left unchanged.
    let finalAliases = aliases;
    if (!REVIEWERS.includes(req.user!.role)) {
      const prior = await prisma.foodAlias.findMany({ where: { foodId: req.params.id, verified: true } });
      finalAliases = aliases.map((a) => ({ ...a, verified: prior.some((e) => e.language === a.language && e.name === a.name) }));
    }
    const effects = editSideEffects(existing.status, req.user!.id);
    await prisma.$transaction([
      prisma.foodAlias.deleteMany({ where: { foodId: req.params.id } }),
      prisma.foodAlias.createMany({ data: finalAliases.map((a) => ({ ...a, foodId: req.params.id })) }),
      prisma.food.update({ where: { id: req.params.id }, data: effects.data }),
    ]);
    await audit(req.user!.id, 'UPDATE', 'Food', req.params.id, { fields: ['aliases'], approvalInvalidated: effects.invalidates });
    res.json(await prisma.foodAlias.findMany({ where: { foodId: req.params.id } }));
  }),
);

// Nutrient values: every value needs a source and a data-quality label. amount = null removes the value.
const nutrientBody = z.object({
  values: z
    .array(
      z
        .object({
          nutrientKey: z.string().min(1),
          amount: z.number().min(0).nullable(),
          sourceId: z.string().optional(),
          citation: z.string().trim().max(500).optional(),
          quality: z.nativeEnum(DataQuality).optional(),
        })
        .refine((v) => v.amount === null || (!!v.sourceId && !!v.quality), {
          message: 'sourceId and quality are required whenever an amount is given',
        }),
    )
    .min(1)
    .max(50),
});

foodsRouter.put(
  '/:id/nutrients',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const { values } = nutrientBody.parse(req.body);
    const user = req.user!;
    const food = await prisma.food.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
    if (!food) throw new AppError(404, 'Foodstuff not found');
    if (food.status === ReviewStatus.ARCHIVED) throw new AppError(409, 'Archived foodstuffs cannot be edited');

    const nutrients = await prisma.nutrient.findMany({ where: { key: { in: values.map((v) => v.nutrientKey) } } });
    const byKey = new Map(nutrients.map((n) => [n.key, n]));
    const unknown = values.filter((v) => !byKey.has(v.nutrientKey)).map((v) => v.nutrientKey);
    if (unknown.length) throw new AppError(400, `Unknown nutrient key(s): ${unknown.join(', ')}`);
    const sourceIds = [...new Set(values.map((v) => v.sourceId).filter((s): s is string => !!s))];
    if (sourceIds.length && (await prisma.knowledgeSource.count({ where: { id: { in: sourceIds } } })) !== sourceIds.length)
      throw new AppError(400, 'One or more sources do not exist');

    const effects = editSideEffects(food.status, user.id);
    await prisma.$transaction([
      ...values.map((v) => {
        const nutrientId = byKey.get(v.nutrientKey)!.id;
        if (v.amount === null) return prisma.foodNutrient.deleteMany({ where: { foodId: food.id, nutrientId } });
        const data = { amount: v.amount, sourceId: v.sourceId!, quality: v.quality!, citation: v.citation, enteredById: user.id };
        return prisma.foodNutrient.upsert({
          where: { foodId_nutrientId: { foodId: food.id, nutrientId } },
          create: { foodId: food.id, nutrientId, ...data },
          update: data,
        });
      }),
      prisma.food.update({ where: { id: food.id }, data: effects.data }),
    ]);
    await audit(user.id, 'UPDATE', 'Food', food.id, { fields: values.map((v) => `nutrient:${v.nutrientKey}`), approvalInvalidated: effects.invalidates });
    res.json(await prisma.foodNutrient.findMany({ where: { foodId: food.id }, include: { nutrient: true } }));
  }),
);

mountReviewRoutes(foodsRouter, 'food');
