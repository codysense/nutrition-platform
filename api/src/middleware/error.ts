import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err instanceof ZodError) return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A record with that value already exists' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
};
