import { Prisma, ReviewStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { AuthUser } from '../../middleware/auth';
import { checkTransition, isBulkAllowed } from './workflow';
import { publishRecipe, unpublishRecipe } from '../publishing/publishing.service';

export type Kind = 'recipe' | 'food';

const fkField = (kind: Kind) => (kind === 'recipe' ? 'recipeId' : 'foodId');
const entityName = (kind: Kind) => (kind === 'recipe' ? 'Recipe' : 'Food');

async function loadCurrent(kind: Kind, id: string) {
  const sel = { status: true, lastEditedById: true } as const;
  const row =
    kind === 'recipe'
      ? await prisma.recipe.findUnique({ where: { id }, select: sel })
      : await prisma.food.findUnique({ where: { id }, select: sel });
  if (!row) throw new AppError(404, `${kind === 'recipe' ? 'Dish' : 'Foodstuff'} not found`);
  return row;
}

export async function changeStatus(kind: Kind, id: string, actor: AuthUser, to: ReviewStatus, note?: string) {
  const current = await loadCurrent(kind, id);
  const check = checkTransition({
    from: current.status,
    to,
    role: actor.role,
    actorId: actor.id,
    lastEditedById: current.lastEditedById,
    note,
  });
  if (!check.ok) throw new AppError(check.status, check.reason);

  if (to === ReviewStatus.APPROVED) {
    const open = await prisma.reviewComment.count({
      where: { [fkField(kind)]: id, resolved: false } as Prisma.ReviewCommentWhereInput,
    });
    if (open > 0) throw new AppError(409, `Resolve the ${open} open comment(s) before approving`);
  }

  const outcome = await prisma.$transaction(async (tx) => {
    let published: { version: number; created: boolean } | null = null;
    let unpublishedVersion: number | null = null;
    if (kind === 'recipe') {
      await tx.recipe.update({ where: { id }, data: { status: to } });
      // Publishing freezes a live version. Archiving, or flagging published content as needing an update, takes it offline.
      if (to === ReviewStatus.PUBLISHED) published = await publishRecipe(tx, id, actor.id);
      else if (to === ReviewStatus.ARCHIVED || (current.status === ReviewStatus.PUBLISHED && to === ReviewStatus.REQUIRES_UPDATE))
        unpublishedVersion = await unpublishRecipe(tx, id);
    } else {
      await tx.food.update({ where: { id }, data: { status: to } });
    }
    if (note?.trim()) {
      await tx.reviewComment.create({
        data: {
          [fkField(kind)]: id,
          field: 'status',
          body: `[${current.status} -> ${to}] ${note.trim()}`,
          resolved: true,
          resolvedById: actor.id,
          resolvedAt: new Date(),
          authorId: actor.id,
        } as Prisma.ReviewCommentUncheckedCreateInput,
      });
    }
    return { published, unpublishedVersion };
  });
  if (outcome.published?.created) await audit(actor.id, 'PUBLISH', 'Recipe', id, { version: outcome.published.version });
  if (outcome.unpublishedVersion !== null) await audit(actor.id, 'UNPUBLISH', 'Recipe', id, { version: outcome.unpublishedVersion, reason: `moved to ${to}` });
  await audit(actor.id, 'STATUS_CHANGE', entityName(kind), id, { from: current.status, to, note: note ?? null });
  return { id, status: to, ...(outcome.published ? { liveVersion: outcome.published.version } : {}) };
}

export async function addComment(kind: Kind, id: string, actor: AuthUser, body: string, field?: string) {
  await loadCurrent(kind, id);
  const comment = await prisma.reviewComment.create({
    data: { [fkField(kind)]: id, field, body, authorId: actor.id } as Prisma.ReviewCommentUncheckedCreateInput,
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  await audit(actor.id, 'COMMENT', entityName(kind), id, { field: field ?? null });
  return comment;
}

/**
 * Editing approved/published content invalidates the approval: it goes back to PENDING_REVIEW
 * so a dietitian re-checks the change. Returns the extra fields to merge into the update.
 */
export function editSideEffects(currentStatus: ReviewStatus, actorId: string) {
  const invalidates = currentStatus === ReviewStatus.APPROVED || currentStatus === ReviewStatus.PUBLISHED;
  return {
    invalidates,
    data: { lastEditedById: actorId, ...(invalidates ? { status: ReviewStatus.PENDING_REVIEW } : {}) },
  };
}

export interface BulkResult {
  total: number;
  moved: number;
  skipped: { id: string; name: string; reason: string }[];
}

/**
 * Applies the normal single-item rules to every id, so a bulk run can never do more than clicking
 * through the items one by one. Items that fail are skipped and reported, not aborted.
 */
export async function bulkChangeStatus(kind: Kind, ids: string[], actor: AuthUser, to: ReviewStatus, note?: string): Promise<BulkResult> {
  if (!isBulkAllowed(to)) throw new AppError(400, 'Approvals must be done one item at a time so each item is actually reviewed');
  let moved = 0;
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      await changeStatus(kind, id, actor, to, note);
      moved++;
    } catch (err) {
      if (err instanceof AppError) failed.push({ id, reason: err.message });
      else throw err;
    }
  }
  const failedIds = failed.map((f) => f.id);
  const rows = failedIds.length
    ? kind === 'recipe'
      ? await prisma.recipe.findMany({ where: { id: { in: failedIds } }, select: { id: true, name: true } })
      : await prisma.food.findMany({ where: { id: { in: failedIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(rows.map((r) => [r.id, r.name]));
  await audit(actor.id, 'BULK_STATUS_CHANGE', kind === 'recipe' ? 'Recipe' : 'Food', undefined, { to, requested: ids.length, moved, skipped: failed.length });
  return { total: ids.length, moved, skipped: failed.map((f) => ({ ...f, name: names.get(f.id) ?? f.id })) };
}
