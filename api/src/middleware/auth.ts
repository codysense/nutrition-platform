import { RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../lib/jwt';
import { AppError } from '../lib/errors';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}

const PASSWORD_CHANGE_PATHS = ['/api/v1/auth/me', '/api/v1/auth/change-password'];

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Verifies the bearer token, then reloads the user so deactivation takes effect immediately. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Missing bearer token');
    let sub: string | undefined;
    try {
      sub = verifyToken(header.slice(7)).sub;
    } catch {
      throw new AppError(401, 'Invalid or expired token');
    }
    const user = sub
      ? await prisma.user.findUnique({ where: { id: sub }, select: { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true } })
      : null;
    if (!user || !user.isActive) throw new AppError(401, 'Account not found or deactivated');
    // A user with a temporary password can do nothing except look themselves up and change it.
    if (user.mustChangePassword && !PASSWORD_CHANGE_PATHS.includes(req.baseUrl + req.path))
      throw new AppError(403, 'You must change your temporary password before continuing', undefined, 'PASSWORD_CHANGE_REQUIRED');
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword };
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission to do that'));
    next();
  };
