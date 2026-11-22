import { ReviewStatus as S, Role } from '@prisma/client';
import { AUTHORS, REVIEWERS } from '../../lib/roles';

interface Rule {
  to: S;
  roles: Role[];
  /** A written reason is mandatory (rejections and change requests). */
  note?: boolean;
  /** Four-eyes rule: the approver cannot be the person who last edited the content. */
  differentActor?: boolean;
}

/** Single source of truth for who may move content between states. */
export const TRANSITIONS: Record<S, Rule[]> = {
  DRAFT: [
    { to: S.PENDING_REVIEW, roles: AUTHORS },
    { to: S.ARCHIVED, roles: [Role.SUPER_ADMIN] },
  ],
  PENDING_REVIEW: [
    { to: S.APPROVED, roles: REVIEWERS, differentActor: true },
    { to: S.REJECTED, roles: REVIEWERS, note: true },
    { to: S.REQUIRES_UPDATE, roles: REVIEWERS, note: true },
    { to: S.DRAFT, roles: AUTHORS }, // withdraw
  ],
  APPROVED: [
    { to: S.PUBLISHED, roles: AUTHORS },
    { to: S.REQUIRES_UPDATE, roles: REVIEWERS, note: true },
  ],
  PUBLISHED: [
    { to: S.REQUIRES_UPDATE, roles: REVIEWERS, note: true },
    { to: S.ARCHIVED, roles: AUTHORS },
  ],
  REJECTED: [
    { to: S.DRAFT, roles: AUTHORS },
    { to: S.ARCHIVED, roles: [Role.SUPER_ADMIN] },
  ],
  REQUIRES_UPDATE: [
    { to: S.PENDING_REVIEW, roles: AUTHORS },
    { to: S.ARCHIVED, roles: [Role.SUPER_ADMIN] },
  ],
  ARCHIVED: [{ to: S.DRAFT, roles: [Role.SUPER_ADMIN] }],
};

export type TransitionCheck = { ok: true } | { ok: false; status: number; reason: string };

export function checkTransition(args: {
  from: S;
  to: S;
  role: Role;
  actorId: string;
  lastEditedById: string | null;
  note?: string;
}): TransitionCheck {
  const rule = TRANSITIONS[args.from].find((r) => r.to === args.to);
  if (!rule) return { ok: false, status: 409, reason: `Cannot move from ${args.from} to ${args.to}` };
  if (!rule.roles.includes(args.role)) return { ok: false, status: 403, reason: `Your role cannot move content to ${args.to}` };
  if (rule.note && !args.note?.trim()) return { ok: false, status: 400, reason: `A note is required when moving to ${args.to}` };
  if (rule.differentActor && args.lastEditedById === args.actorId)
    return { ok: false, status: 409, reason: 'You edited this content last, so someone else must approve it' };
  return { ok: true };
}

export interface AllowedTransition {
  to: S;
  noteRequired: boolean;
  /** Set when the role may normally do this but not right now (e.g. approving your own edits). */
  blockedReason?: string;
}

/** What the signed-in user may do next. The UI renders this list, so it never duplicates the rules. */
export function allowedTransitions(args: { from: S; role: Role; actorId: string; lastEditedById: string | null }): AllowedTransition[] {
  return TRANSITIONS[args.from]
    .filter((r) => r.roles.includes(args.role))
    .map((r) => ({
      to: r.to,
      noteRequired: !!r.note,
      ...(r.differentActor && args.lastEditedById === args.actorId
        ? { blockedReason: 'You edited this last, so someone else must approve it' }
        : {}),
    }));
}

/** Moves that must be done one item at a time so each item is genuinely reviewed. */
export const BULK_BLOCKED: S[] = [S.APPROVED];
export const isBulkAllowed = (to: S) => !BULK_BLOCKED.includes(to);
