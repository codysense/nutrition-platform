import rateLimit from 'express-rate-limit';
import { AppError } from './errors';

/** 15-minute window. Rejections go through the normal JSON error format instead of express-rate-limit's plain text. */
export const limiter = (limit: number, message: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, message)),
  });
