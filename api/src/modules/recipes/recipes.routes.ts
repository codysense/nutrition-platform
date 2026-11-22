import { Router } from 'express';
import {
  AnimalFlesh, CostTier, Difficulty, EvidenceLevel, FrequencyGuide, MappingStatus, Prisma, ReviewStatus, SpiceLevel,
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { authenticate, requireRole } from '../../middleware/auth';
import { EDITORS, REVIEWERS } from '../../lib/roles';
import { bulkChangeStatus, editSideEffects } from '../review/review.service';
import { mountReviewRoutes } from '../review/review.routes';
import { allowedTransitions } from '../review/workflow';

export const recipesRouter = Router();
recipesRouter.use(authenticate);

const listQuery = z.object({
  q: z.string().trim().optional(),
  status: z.nativeEnum(ReviewStatus).optional(),
  category: z.string().optional(),
  cuisine: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});


type RecipeFilter = { q?: string; status?: ReviewStatus; category?: string; cuisine?: string };
const recipeWhere = (q: RecipeFilter): Prisma.RecipeWhereInput => ({
  ...(q.status && { status: q.status }),
  ...(q.category && { category: q.category }),
  ...(q.cuisine && { cuisine: q.cuisine }),
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
      .object({ q: z.string().trim().optional(), status: z.nativeEnum(ReviewStatus).optional(), category: z.string().optional(), cuisine: z.string().optional() })
      .optional(),
    to: z.nativeEnum(ReviewStatus),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => !!v.ids !== !!v.filter, { message: 'Provide either ids or filter' });

recipesRouter.post(
  '/bulk-status',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const body = bulkSchema.parse(req.body);
    const ids = body.ids ?? (await prisma.recipe.findMany({ where: recipeWhere(body.filter!), select: { id: true }, take: BULK_MAX + 1 })).map((r) => r.id);
    if (ids.length === 0) throw new AppError(400, 'Nothing matches that selection');
    if (ids.length > BULK_MAX) throw new AppError(400, `Too many items (limit ${BULK_MAX}). Narrow the filter.`);
    res.json(await bulkChangeStatus('recipe', ids, req.user!, body.to, body.note));
  }),
);

recipesRouter.get(
  '/',
  ah(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where = recipeWhere(q);
    const [total, items] = await Promise.all([
      prisma.recipe.count({ where }),
      prisma.recipe.findMany({
        where,
        orderBy: { legacyNo: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, legacyNo: true, slug: true, name: true, category: true, cuisine: true, region: true,
          status: true, namesVerified: true, allergenFlags: true, updatedAt: true,
          _count: { select: { comments: { where: { resolved: false } }, lines: { where: { mappingStatus: MappingStatus.UNMAPPED } } } },
        },
      }),
    ]);
    res.json({ items, total, page: q.page, pageSize: q.pageSize });
  }),
);

recipesRouter.get(
  '/:id',
  ah(async (req, res) => {
    const recipe = await prisma.recipe.findUnique({
      where: { id: req.params.id },
      include: {
        aliases: true,
        steps: { orderBy: { stepNumber: 'asc' } },
        lines: { orderBy: { position: 'asc' }, include: { foods: { select: { id: true, code: true, name: true, status: true } } } },
        comments: { orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, name: true, role: true } } } },
      },
    });
    if (!recipe) throw new AppError(404, 'Dish not found');
    const user = req.user!;
    res.json({
      ...recipe,
      allowedTransitions: allowedTransitions({ from: recipe.status, role: user.role, actorId: user.id, lastEditedById: recipe.lastEditedById }),
    });
  }),
);

const nullableText = z.string().trim().max(4000).nullable();
const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1),
    originNote: nullableText,
    cuisine: nullableText,
    region: nullableText,
    mealSlot: nullableText,
    cookingMethod: nullableText,
    spiceLevel: z.nativeEnum(SpiceLevel).nullable(),
    costTier: z.nativeEnum(CostTier).nullable(),
    summaryIngredients: nullableText,
    timeText: nullableText,
    totalMinutes: z.number().int().min(0).nullable(),
    difficulty: z.nativeEnum(Difficulty).nullable(),
    servings: z.number().int().min(1).nullable(),
    healthBenefits: nullableText,
    keyNutrients: nullableText,
    cautions: nullableText,
    frequencyGuide: z.nativeEnum(FrequencyGuide).nullable(),
    allergenFlags: z.array(z.string().trim().min(1)),
    containsAnimalFlesh: z.nativeEnum(AnimalFlesh).nullable(),
    servedWith: nullableText,
    occasion: nullableText,
    storageGuidance: nullableText,
    tips: nullableText,
    // reviewer-only flags (do not invalidate an approval)
    evidenceLevel: z.nativeEnum(EvidenceLevel),
    namesVerified: z.boolean(),
  })
  .partial()
  .strict();
const REVIEWER_ONLY_KEYS = ['evidenceLevel', 'namesVerified'];

recipesRouter.patch(
  '/:id',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const body = patchSchema.parse(req.body);
    const user = req.user!;
    const keys = Object.keys(body);
    if (!keys.length) throw new AppError(400, 'Nothing to update');
    if (keys.some((k) => REVIEWER_ONLY_KEYS.includes(k)) && !REVIEWERS.includes(user.role))
      throw new AppError(403, 'Only a reviewer can change evidence level or verification flags');
    const existing = await prisma.recipe.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!existing) throw new AppError(404, 'Dish not found');
    if (existing.status === ReviewStatus.ARCHIVED) throw new AppError(409, 'Archived dishes cannot be edited');

    const contentChanged = keys.some((k) => !REVIEWER_ONLY_KEYS.includes(k));
    const effects = contentChanged ? editSideEffects(existing.status, user.id) : { invalidates: false, data: {} };
    const updated = await prisma.recipe.update({ where: { id: req.params.id }, data: { ...body, ...effects.data } });
    await audit(user.id, 'UPDATE', 'Recipe', updated.id, { fields: keys, approvalInvalidated: effects.invalidates });
    res.json(updated);
  }),
);

recipesRouter.put(
  '/:id/aliases',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const { aliases } = z
      .object({ aliases: z.array(z.object({ language: z.string().trim().min(1), name: z.string().trim().min(1), verified: z.boolean().default(false) })) })
      .parse(req.body);
    const existing = await prisma.recipe.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!existing) throw new AppError(404, 'Dish not found');
    // Only reviewers can verify names. Others keep existing verified flags only for names left unchanged.
    let finalAliases = aliases;
    if (!REVIEWERS.includes(req.user!.role)) {
      const prior = await prisma.recipeAlias.findMany({ where: { recipeId: req.params.id, verified: true } });
      finalAliases = aliases.map((a) => ({ ...a, verified: prior.some((e) => e.language === a.language && e.name === a.name) }));
    }
    const effects = editSideEffects(existing.status, req.user!.id);
    await prisma.$transaction([
      prisma.recipeAlias.deleteMany({ where: { recipeId: req.params.id } }),
      prisma.recipeAlias.createMany({ data: finalAliases.map((a) => ({ ...a, recipeId: req.params.id })) }),
      prisma.recipe.update({ where: { id: req.params.id }, data: effects.data }),
    ]);
    await audit(req.user!.id, 'UPDATE', 'Recipe', req.params.id, { fields: ['aliases'], approvalInvalidated: effects.invalidates });
    res.json(await prisma.recipeAlias.findMany({ where: { recipeId: req.params.id } }));
  }),
);

// Ingredient mapping: link a free-text line to foodstuffs and (optionally) structured quantity/unit.
recipesRouter.patch(
  '/:id/ingredients/:lineId',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const body = z
      .object({
        foodIds: z.array(z.string()).optional(),
        quantity: z.number().positive().nullable().optional(),
        unit: z.string().trim().max(30).nullable().optional(),
        mappingStatus: z.nativeEnum(MappingStatus).optional(),
      })
      .strict()
      .parse(req.body);
    const line = await prisma.recipeIngredientLine.findFirst({
      where: { id: req.params.lineId, recipeId: req.params.id },
      include: { recipe: { select: { status: true } } },
    });
    if (!line) throw new AppError(404, 'Ingredient line not found');
    if (line.recipe.status === ReviewStatus.ARCHIVED) throw new AppError(409, 'Archived dishes cannot be edited');
    if (body.foodIds) {
      const found = await prisma.food.count({ where: { id: { in: body.foodIds } } });
      if (found !== new Set(body.foodIds).size) throw new AppError(400, 'One or more foodstuffs do not exist');
    }
    const effects = editSideEffects(line.recipe.status, req.user!.id);
    const { foodIds, ...rest } = body;
    const [updated] = await prisma.$transaction([
      prisma.recipeIngredientLine.update({
        where: { id: line.id },
        data: {
          ...rest,
          ...(foodIds ? { foods: { set: foodIds.map((id) => ({ id })) } } : {}),
          ...(foodIds && !body.mappingStatus ? { mappingStatus: foodIds.length ? MappingStatus.CONFIRMED : MappingStatus.UNMAPPED } : {}),
        },
        include: { foods: { select: { id: true, code: true, name: true } } },
      }),
      prisma.recipe.update({ where: { id: req.params.id }, data: effects.data }),
    ]);
    await audit(req.user!.id, 'UPDATE', 'Recipe', req.params.id, { fields: ['ingredientLine'], lineId: line.id, approvalInvalidated: effects.invalidates });
    res.json(updated);
  }),
);

mountReviewRoutes(recipesRouter, 'recipe');
