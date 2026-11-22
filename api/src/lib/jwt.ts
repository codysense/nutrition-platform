import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';

export const signToken = (user: { id: string; role: Role }) =>
  jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
