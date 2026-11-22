import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { authenticate, requireRole } from '../../middleware/auth';

export const usersRouter = Router();
usersRouter.use(authenticate, requireRole(Role.SUPER_ADMIN));

const publicSelect = { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true, createdAt: true } as const;
const password = z.string().min(12, 'Use at least 12 characters');

usersRouter.get(
  '/',
  ah(async (_req, res) => {
    res.json(await prisma.user.findMany({ select: publicSelect, orderBy: { createdAt: 'asc' } }));
  }),
);

usersRouter.post(
  '/',
  ah(async (req, res) => {
    const body = z
      .object({ email: z.string().email().toLowerCase(), name: z.string().trim().min(1), role: z.nativeEnum(Role), password })
      .parse(req.body);
    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, role: body.role, passwordHash: await bcrypt.hash(body.password, 12), mustChangePassword: true },
      select: publicSelect,
    });
    await audit(req.user!.id, 'CREATE', 'User', user.id, { role: user.role });
    res.status(201).json(user);
  }),
);

usersRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const body = z
      .object({ name: z.string().trim().min(1).optional(), role: z.nativeEnum(Role).optional(), isActive: z.boolean().optional(), password: password.optional() })
      .strict()
      .parse(req.body);
    if (req.params.id === req.user!.id && (body.role !== undefined || body.isActive === false))
      throw new AppError(400, 'You cannot change your own role or deactivate yourself');
    const { password: newPassword, ...rest } = body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...rest, ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: true } : {}) },
      select: publicSelect,
    });
    await audit(req.user!.id, 'UPDATE', 'User', user.id, { fields: Object.keys(body).filter((k) => k !== 'password'), passwordReset: !!newPassword });
    res.json(user);
  }),
);
