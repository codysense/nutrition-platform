import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export const audit = (
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  meta?: Prisma.InputJsonValue,
) => prisma.auditLog.create({ data: { actorId, action, entityType, entityId, meta } });
