import { Router } from 'express';
import { MappingStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah } from '../../lib/errors';
import { authenticate, requireRole } from '../../middleware/auth';

export const statsRouter = Router();
statsRouter.use(authenticate);

statsRouter.get(
  '/stats',
  ah(async (_req, res) => {
    const [recipesByStatus, foodsByStatus, totalFoods, foodsWithNutrients, openComments, unmappedLines, namesUnverifiedRecipes, nutrientCoverage, liveDishes, totalLines] =
      await Promise.all([
        prisma.recipe.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.food.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.food.count(),
        prisma.food.count({ where: { nutrients: { some: {} } } }),
        prisma.reviewComment.count({ where: { resolved: false } }),
        prisma.recipeIngredientLine.count({ where: { OR: [{ mappingStatus: { not: MappingStatus.CONFIRMED } }, { roleConfirmed: false }] } }),
        prisma.recipe.count({ where: { namesVerified: false } }),
        prisma.foodNutrient.groupBy({ by: ['nutrientId'], _count: { _all: true } }),
        prisma.recipe.count({ where: { liveSnapshotId: { not: null } } }),
        prisma.recipeIngredientLine.count(),
      ]);
    const nutrients = await prisma.nutrient.findMany({ orderBy: { sortOrder: 'asc' } });
    const counts = new Map(nutrientCoverage.map((c) => [c.nutrientId, c._count._all]));
    const toMap = (rows: { status: string; _count: { _all: number } }[]) => Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    res.json({
      recipesByStatus: toMap(recipesByStatus),
      foodsByStatus: toMap(foodsByStatus),
      foods: { total: totalFoods, withNutrientValues: foodsWithNutrients },
      nutrientCoverage: nutrients.map((n) => ({ key: n.key, name: n.name, foodsWithValue: counts.get(n.id) ?? 0, totalFoods })),
      openComments,
      unmappedIngredientLines: unmappedLines,
      liveDishes,
      ingredientLines: { total: totalLines, ready: totalLines - unmappedLines },
      recipesWithUnverifiedNames: namesUnverifiedRecipes,
    });
  }),
);

const auditQuery = z.object({
  entityType: z.string().optional(),
  action: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

statsRouter.get(
  '/audit',
  requireRole(Role.SUPER_ADMIN),
  ah(async (req, res) => {
    const q = auditQuery.parse(req.query);
    const where = { ...(q.entityType && { entityType: q.entityType }), ...(q.action && { action: q.action }) };
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
        include: { actor: { select: { id: true, name: true, role: true } } },
      }),
    ]);
    // Resolve readable names for dishes and foodstuffs so the log is understandable at a glance.
    const idsOf = (type: string) => [...new Set(rows.filter((r) => r.entityType === type && r.entityId).map((r) => r.entityId!))];
    const recipeIds = idsOf('Recipe');
    const foodIds = idsOf('Food');
    const [recipes, foods]: [{ id: string; name: string }[], { id: string; name: string }[]] = await Promise.all([
      recipeIds.length ? prisma.recipe.findMany({ where: { id: { in: recipeIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      foodIds.length ? prisma.food.findMany({ where: { id: { in: foodIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    ]);
    const names = new Map([...recipes, ...foods].map((r) => [r.id, r.name]));
    res.json({
      items: rows.map((r) => ({ ...r, entityName: r.entityId ? names.get(r.entityId) ?? null : null })),
      total, page: q.page, pageSize: q.pageSize,
    });
  }),
);

statsRouter.get(
  '/nutrients',
  ah(async (_req, res) => {
    res.json(await prisma.nutrient.findMany({ orderBy: { sortOrder: 'asc' } }));
  }),
);
