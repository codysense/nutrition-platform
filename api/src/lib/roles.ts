import { Role } from '@prisma/client';

/** People who write and submit content. */
export const AUTHORS: Role[] = [Role.SUPER_ADMIN, Role.CONTENT_MANAGER];
/** People who can sign off nutrition content (the dietitian role). */
export const REVIEWERS: Role[] = [Role.SUPER_ADMIN, Role.NUTRITION_REVIEWER];
/** Anyone who may edit fields or comment. VIEWER is read-only. */
export const EDITORS: Role[] = [Role.SUPER_ADMIN, Role.CONTENT_MANAGER, Role.NUTRITION_REVIEWER];
