import { Router } from 'express';
import {
  AnimalFlesh, CostTier, Difficulty, EvidenceLevel, FrequencyGuide, IngredientRole, MappingStatus, Prisma, ReviewStatus, SpiceLevel,
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { authenticate, requireRole } from '../../middleware/auth';
import { AUTHORS, EDITORS, REVIEWERS } from '../../lib/roles';
import { confirmableLines, needsFoodstuff, readinessReport } from '../ingredients/readiness';
import { bulkChangeStatus, editSideEffects } from '../review/review.service';
import { mountReviewRoutes } from '../review/review.routes';
import { allowedTransitions } from '../review/workflow';
import { liveInfo, republish, takeOffline, versionContent } from '../publishing/publishing.service';

export const recipesRouter = Router();
recipesRouter.use(authenticate);

const listQuery = z.object({
  q: z.string().trim().optional(),
  status: z.nativeEnum(ReviewStatus).optional(),
  category: z.string().optional(),
  cuisine: z.string().optional(),
  live: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});


type RecipeFilter = { q?: string; status?: ReviewStatus; category?: string; cuisine?: string; live?: 'true' | 'false' };
const recipeWhere = (q: RecipeFilter): Prisma.RecipeWhereInput => ({
  ...(q.status && { status: q.status }),
  ...(q.category && { category: q.category }),
  ...(q.cuisine && { cuisine: q.cuisine }),
  ...(q.live === 'true' && { liveSnapshotId: { not: null } }),
  ...(q.live === 'false' && { liveSnapshotId: null }),
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
      .object({ q: z.string().trim().optional(), status: z.nativeEnum(ReviewStatus).optional(), category: z.string().optional(), cuisine: z.string().optional(), live: z.enum(['true', 'false']).optional() })
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
          status: true, namesVerified: true, allergenFlags: true, updatedAt: true, liveSnapshot: { select: { version: true } },
          _count: { select: { comments: { where: { resolved: false } }, lines: { where: { OR: [{ mappingStatus: { not: MappingStatus.CONFIRMED } }, { roleConfirmed: false }] } } } },
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
    const { live, versions } = await liveInfo(recipe.id);
    res.json({
      ...recipe,
      live,
      versions,
      allowedTransitions: allowedTransitions({ from: recipe.status, role: user.role, actorId: user.id, lastEditedById: recipe.lastEditedById }),
    });
  }),
);

recipesRouter.get(
  '/:id/versions/:version',
  ah(async (req, res) => {
    res.json(await versionContent(req.params.id, z.coerce.number().int().min(1).parse(req.params.version)));
  }),
);

recipesRouter.post(
  '/:id/unpublish',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    res.json(await takeOffline(req.params.id, req.user!.id));
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

// Ingredient mapping: link a free-text line to foodstuffs, set its role, and confirm it.
// These are structural edits, not reviewed claims, so they neither send an approved dish back to review nor change
// "last edited by" (which would let a dietitian approve her own claim edits after an admin maps a line).
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
        role: z.nativeEnum(IngredientRole).optional(),
        roleConfirmed: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    const line = await prisma.recipeIngredientLine.findFirst({
      where: { id: req.params.lineId, recipeId: req.params.id },
      include: { recipe: { select: { status: true } }, foods: { select: { id: true } } },
    });
    if (!line) throw new AppError(404, 'Ingredient line not found');
    if (line.recipe.status === ReviewStatus.ARCHIVED) throw new AppError(409, 'Archived dishes cannot be edited');
    if (body.foodIds) {
      const found = await prisma.food.count({ where: { id: { in: body.foodIds } } });
      if (found !== new Set(body.foodIds).size) throw new AppError(400, 'One or more foodstuffs do not exist');
    }

    const { foodIds, ...rest } = body;
    const role = body.role ?? line.role;
    const foodCount = foodIds ? new Set(foodIds).size : line.foods.length;
    let mappingStatus = body.mappingStatus;
    if (!mappingStatus && foodIds) mappingStatus = foodCount ? MappingStatus.CONFIRMED : MappingStatus.UNMAPPED;
    const finalStatus = mappingStatus ?? line.mappingStatus;
    if (finalStatus === MappingStatus.CONFIRMED && foodCount === 0 && needsFoodstuff(role))
      throw new AppError(400, 'A core or seasoning ingredient must be linked to at least one foodstuff before it can be confirmed. Link a foodstuff, or change its role to Staple or Optional if none applies.');

    const updated = await prisma.recipeIngredientLine.update({
      where: { id: line.id },
      data: {
        ...rest,
        ...(mappingStatus ? { mappingStatus } : {}),
        // choosing a role is a deliberate human decision, so it counts as confirming it
        ...(body.role !== undefined && body.roleConfirmed === undefined ? { roleConfirmed: true } : {}),
        ...(foodIds ? { foods: { set: foodIds.map((id) => ({ id })) } } : {}),
      },
      include: { foods: { select: { id: true, code: true, name: true } } },
    });
    await audit(req.user!.id, 'UPDATE', 'Recipe', req.params.id, { fields: ['ingredientLine'], lineId: line.id });
    res.json(updated);
  }),
);

// Confirms every line that can safely be confirmed in one go (links and role). Lines that still need a foodstuff are left alone.
recipesRouter.post(
  '/:id/ingredients/confirm-all',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const recipe = await prisma.recipe.findUnique({
      where: { id: req.params.id },
      select: { status: true, lines: { select: { id: true, position: true, role: true, roleConfirmed: true, mappingStatus: true, foods: { select: { id: true } } } } },
    });
    if (!recipe) throw new AppError(404, 'Dish not found');
    if (recipe.status === ReviewStatus.ARCHIVED) throw new AppError(409, 'Archived dishes cannot be edited');
    const todo = confirmableLines(recipe.lines);
    const ids = new Set(todo.map((l) => l.id));
    await prisma.recipeIngredientLine.updateMany({ where: { id: { in: [...ids] } }, data: { mappingStatus: MappingStatus.CONFIRMED, roleConfirmed: true } });
    const after = readinessReport(recipe.lines.map((l) => (ids.has(l.id) ? { ...l, mappingStatus: 'CONFIRMED', roleConfirmed: true } : l)));
    await audit(req.user!.id, 'UPDATE', 'Recipe', req.params.id, { fields: ['ingredientLines'], confirmed: todo.length });
    res.json({ confirmed: todo.length, needAttention: after.notReady.length, lines: after.notReady });
  }),
);

// A published dish whose working copy has moved on (ingredient links or roles changed) can be republished without a new review,
// because claim edits already send a dish back to review; only structural changes can leave it PUBLISHED.
recipesRouter.post(
  '/:id/republish',
  requireRole(...AUTHORS),
  ah(async (req, res) => {
    res.json(await republish(req.params.id, req.user!.id));
  }),
);

mountReviewRoutes(recipesRouter, 'recipe');
