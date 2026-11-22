import { describe, expect, it } from 'vitest';
import { ReviewStatus as S, Role } from '@prisma/client';
import { allowedTransitions, checkTransition, isBulkAllowed } from './workflow';

const base = { actorId: 'u1', lastEditedById: 'u2' };

describe('review workflow', () => {
  it('lets a dietitian approve content someone else edited', () => {
    expect(checkTransition({ ...base, from: S.PENDING_REVIEW, to: S.APPROVED, role: Role.NUTRITION_REVIEWER }).ok).toBe(true);
  });
  it('blocks approval of your own edits (four-eyes)', () => {
    const r = checkTransition({ ...base, lastEditedById: 'u1', from: S.PENDING_REVIEW, to: S.APPROVED, role: Role.NUTRITION_REVIEWER });
    expect(r.ok).toBe(false);
  });
  it('blocks content managers from approving', () => {
    const r = checkTransition({ ...base, from: S.PENDING_REVIEW, to: S.APPROVED, role: Role.CONTENT_MANAGER });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });
  it('requires a note to reject', () => {
    expect(checkTransition({ ...base, from: S.PENDING_REVIEW, to: S.REJECTED, role: Role.NUTRITION_REVIEWER }).ok).toBe(false);
    expect(checkTransition({ ...base, from: S.PENDING_REVIEW, to: S.REJECTED, role: Role.NUTRITION_REVIEWER, note: 'Unsupported claim' }).ok).toBe(true);
  });
  it('does not allow skipping review (DRAFT -> PUBLISHED)', () => {
    expect(checkTransition({ ...base, from: S.DRAFT, to: S.PUBLISHED, role: Role.SUPER_ADMIN }).ok).toBe(false);
  });
  it('viewers cannot do anything', () => {
    expect(checkTransition({ ...base, from: S.DRAFT, to: S.PENDING_REVIEW, role: Role.VIEWER }).ok).toBe(false);
  });

  it('offers a dietitian approve/reject/request-changes on pending content', () => {
    const tos = allowedTransitions({ from: S.PENDING_REVIEW, role: Role.NUTRITION_REVIEWER, actorId: 'u1', lastEditedById: 'u2' }).map((t) => t.to);
    expect(tos).toEqual(expect.arrayContaining([S.APPROVED, S.REJECTED, S.REQUIRES_UPDATE]));
  });
  it('flags approve as blocked when the dietitian edited last', () => {
    const a = allowedTransitions({ from: S.PENDING_REVIEW, role: Role.NUTRITION_REVIEWER, actorId: 'u1', lastEditedById: 'u1' });
    expect(a.find((t) => t.to === S.APPROVED)?.blockedReason).toBeTruthy();
  });
  it('never allows bulk approval, but allows bulk submit and request-changes', () => {
    expect(isBulkAllowed(S.APPROVED)).toBe(false);
    expect(isBulkAllowed(S.PENDING_REVIEW)).toBe(true);
    expect(isBulkAllowed(S.REQUIRES_UPDATE)).toBe(true);
  });
});
