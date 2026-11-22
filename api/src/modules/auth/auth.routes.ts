import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, AppError } from '../../lib/errors';
import { signToken } from '../../lib/jwt';
import { audit } from '../../lib/audit';
import { authenticate } from '../../middleware/auth';

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

authRouter.post(
  '/login',
  loginLimiter,
  ah(async (req, res) => {
    const { email, password } = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.isActive) throw new AppError(401, 'Invalid email or password');
    await audit(user.id, 'LOGIN', 'User', user.id);
    res.json({
      token: signToken(user),
      user: { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword },
    });
  }),
);

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

const changeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

authRouter.post(
  '/change-password',
  changeLimiter,
  authenticate,
  ah(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(12, 'Use at least 12 characters').max(128) })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    // 400, not 401: a 401 would make the web app think the session expired and sign the user out.
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError(400, 'Current password is incorrect');
    if (currentPassword === newPassword) throw new AppError(400, 'Choose a password different from the current one');
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: false } });
    await audit(user.id, 'PASSWORD_CHANGED', 'User', user.id);
    res.json({ ok: true });
  }),
);
