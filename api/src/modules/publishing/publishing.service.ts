import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { hashContent, snapshotContent } from './snapshot';
import { readinessReport } from '../ingredients/readiness';

type Db = Prisma.TransactionClient | typeof prisma;

const SNAPSHOT_INCLUDE = {
  aliases: true,
  steps: true,
  lines: { include: { foods: { select: { id: true, name: true, category: true, aliases: { select: { language: true, name: true } } } } } },
} satisfies Prisma.RecipeInclude;

async function currentContent(db: Db, recipeId: string) {
  const recipe = await db.recipe.findUnique({ where: { id: recipeId }, include: SNAPSHOT_INCLUDE });
  if (!recipe) throw new AppError(404, 'Dish not found');
  return { recipe, content: snapshotContent(recipe) };
}

export interface PublishResult {
  version: number;
  /** False when the working copy is identical to what is already live, so no new version was needed. */
  created: boolean;
}

/** Freezes the current working copy as the new live version. Call inside the same transaction as the status change. */
export async function publishRecipe(db: Db, recipeId: string, actorId: string, opts: { enforceReady?: boolean } = {}): Promise<PublishResult> {
  const { recipe, content } = await currentContent(db, recipeId);

  // The public app matches on ingredient links and roles, so nothing goes live until a person has confirmed every line.
  if (opts.enforceReady !== false) {
    const report = readinessReport(recipe.lines.map((l) => ({ position: l.position, role: l.role, roleConfirmed: l.roleConfirmed, mappingStatus: l.mappingStatus, foods: l.foods })));
    if (report.notReady.length > 0)
      throw new AppError(
        409,
        `${report.notReady.length} of ${report.total} ingredient lines still need confirming (links and role) before this dish can go live`,
        { lines: report.notReady }, 'CONFLICT',
      );
  }
  const hash = hashContent(content);
  const live = recipe.liveSnapshotId ? await db.publishedRecipe.findUnique({ where: { id: recipe.liveSnapshotId } }) : null;
  if (live && live.contentHash === hash) return { version: live.version, created: false };

  const [last, approval] = await Promise.all([
    db.publishedRecipe.findFirst({ where: { recipeId }, orderBy: { version: 'desc' }, select: { version: true } }),
    db.auditLog.findFirst({
      where: { entityType: 'Recipe', entityId: recipeId, action: 'STATUS_CHANGE', meta: { path: ['to'], equals: 'APPROVED' } },
      orderBy: { createdAt: 'desc' },
      select: { actorId: true, createdAt: true },
    }),
  ]);
  const snapshot = await db.publishedRecipe.create({
    data: {
      recipeId, version: (last?.version ?? 0) + 1, contentHash: hash, content: content as unknown as Prisma.InputJsonValue,
      approvedAt: approval?.createdAt, approvedById: approval?.actorId, publishedById: actorId,
    },
  });
  if (live) await db.publishedRecipe.update({ where: { id: live.id }, data: { retiredAt: new Date() } });
  await db.recipe.update({ where: { id: recipeId }, data: { liveSnapshotId: snapshot.id } });
  return { version: snapshot.version, created: true };
}

/** Takes the live version offline. Returns the version that was live, or null if nothing was. */
export async function unpublishRecipe(db: Db, recipeId: string): Promise<number | null> {
  const recipe = await db.recipe.findUnique({ where: { id: recipeId }, select: { liveSnapshotId: true } });
  if (!recipe?.liveSnapshotId) return null;
  const snap = await db.publishedRecipe.update({ where: { id: recipe.liveSnapshotId }, data: { retiredAt: new Date() }, select: { version: true } });
  await db.recipe.update({ where: { id: recipeId }, data: { liveSnapshotId: null } });
  return snap.version;
}

/** Explicit "take offline" (the dish keeps its review status). */
export async function takeOffline(recipeId: string, actorId: string) {
  const version = await prisma.$transaction((tx) => unpublishRecipe(tx, recipeId));
  if (version === null) throw new AppError(409, 'This dish is not live');
  await audit(actorId, 'UNPUBLISH', 'Recipe', recipeId, { version });
  return { version };
}

/** What the back office shows next to a dish: is it live, which version, and has the working copy moved on since. */
export async function liveInfo(recipeId: string) {
  const [recipe, versions, now] = await Promise.all([
    prisma.recipe.findUnique({ where: { id: recipeId }, select: { liveSnapshot: { select: { version: true, publishedAt: true, contentHash: true, approvedAt: true } } } }),
    prisma.publishedRecipe.findMany({
      where: { recipeId }, orderBy: { version: 'desc' }, take: 10,
      select: { version: true, publishedAt: true, retiredAt: true, approvedAt: true },
    }),
    currentContent(prisma, recipeId).then((c) => hashContent(c.content)),
  ]);
  const live = recipe?.liveSnapshot ?? null;
  return {
    live: live ? { version: live.version, publishedAt: live.publishedAt, approvedAt: live.approvedAt, hasUnpublishedChanges: live.contentHash !== now } : null,
    versions,
  };
}

export async function versionContent(recipeId: string, version: number) {
  const snap = await prisma.publishedRecipe.findUnique({ where: { recipeId_version: { recipeId, version } } });
  if (!snap) throw new AppError(404, 'That version does not exist');
  return snap;
}

/** Publishes the current working copy of a dish that is already PUBLISHED (e.g. after ingredient links or roles changed). */
export async function republish(recipeId: string, actorId: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { status: true } });
  if (!recipe) throw new AppError(404, 'Dish not found');
  if (recipe.status !== 'PUBLISHED')
    throw new AppError(409, 'Only a published dish can be republished this way. Other dishes go through approval first.');
  const result = await prisma.$transaction((tx) => publishRecipe(tx, recipeId, actorId));
  if (result.created) await audit(actorId, 'PUBLISH', 'Recipe', recipeId, { version: result.version, via: 'republish' });
  return result;
}
