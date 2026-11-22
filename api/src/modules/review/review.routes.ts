import { Router } from 'express';
import { ReviewStatus } from '@prisma/client';
import { z } from 'zod';
import { ah, AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { authenticate, requireRole } from '../../middleware/auth';
import { EDITORS } from '../../lib/roles';
import { addComment, changeStatus, Kind } from './review.service';

/** Adds POST /:id/status and POST /:id/comments to a recipes or foods router. */
export function mountReviewRoutes(router: Router, kind: Kind) {
  router.post(
    '/:id/status',
    requireRole(...EDITORS),
    ah(async (req, res) => {
      const { to, note } = z
        .object({ to: z.nativeEnum(ReviewStatus), note: z.string().trim().max(2000).optional() })
        .parse(req.body);
      res.json(await changeStatus(kind, req.params.id, req.user!, to, note));
    }),
  );
  router.post(
    '/:id/comments',
    requireRole(...EDITORS),
    ah(async (req, res) => {
      const { body, field } = z
        .object({ body: z.string().trim().min(1).max(4000), field: z.string().max(80).optional() })
        .parse(req.body);
      res.status(201).json(await addComment(kind, req.params.id, req.user!, body, field));
    }),
  );
}

/** Cross-cutting review endpoints: queue and comment resolution. */
export const reviewRouter = Router();
reviewRouter.use(authenticate);

reviewRouter.get(
  '/queue',
  ah(async (_req, res) => {
    const open = { select: { comments: { where: { resolved: false } } } } as const;
    const [recipes, foods] = await Promise.all([
      prisma.recipe.findMany({
        where: { status: ReviewStatus.PENDING_REVIEW },
        orderBy: { updatedAt: 'asc' },
        select: { id: true, legacyNo: true, name: true, category: true, updatedAt: true, lastEditedById: true, _count: open },
      }),
      prisma.food.findMany({
        where: { status: ReviewStatus.PENDING_REVIEW },
        orderBy: { updatedAt: 'asc' },
        select: { id: true, code: true, name: true, category: true, updatedAt: true, lastEditedById: true, _count: open },
      }),
    ]);
    res.json({ recipes, foods });
  }),
);

reviewRouter.patch(
  '/comments/:id',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const { resolved } = z.object({ resolved: z.boolean() }).parse(req.body);
    const existing = await prisma.reviewComment.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Comment not found');
    const updated = await prisma.reviewComment.update({
      where: { id: existing.id },
      data: resolved
        ? { resolved: true, resolvedById: req.user!.id, resolvedAt: new Date() }
        : { resolved: false, resolvedById: null, resolvedAt: null },
    });
    await audit(req.user!.id, resolved ? 'COMMENT_RESOLVED' : 'COMMENT_REOPENED', 'ReviewComment', existing.id);
    res.json(updated);
  }),
);
