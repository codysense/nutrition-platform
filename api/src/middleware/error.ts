import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, ErrorCode } from '../lib/errors';

/**
 * Every error leaves the API in one shape:
 *   { error: string (message safe to show), code: string (stable, machine-readable), details?: any, requestId: string }
 */
const send = (res: Parameters<ErrorRequestHandler>[2], status: number, error: string, code: ErrorCode, details?: unknown) =>
  res.status(status).json({ error, code, ...(details !== undefined ? { details } : {}), requestId: res.locals.requestId });

const pretty = (path: (string | number)[]) =>
  path.length ? path.join('.') : 'request';

export const notFound: RequestHandler = (req, res) =>
  send(res, 404, `There is no endpoint ${req.method} ${req.path}`, 'NOT_FOUND');

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    if (err.status >= 500) console.error(`[${res.locals.requestId}] ${req.method} ${req.originalUrl}`, err);
    return send(res, err.status, err.message, err.code, err.details);
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) (fieldErrors[pretty(issue.path)] ??= []).push(issue.message);
    const summary = Object.entries(fieldErrors).slice(0, 3).map(([f, m]) => `${f}: ${m[0]}`).join('; ');
    return send(res, 400, `Some details are not valid (${summary})`, 'VALIDATION_FAILED', { fieldErrors });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | string | undefined) ?? 'value';
      const what = Array.isArray(target) ? target.join(', ') : String(target);
      return send(res, 409, `A record with this ${what} already exists`, 'CONFLICT', { fields: [what] });
    }
    if (err.code === 'P2025') return send(res, 404, 'That record no longer exists. It may have been deleted.', 'NOT_FOUND');
    if (err.code === 'P2003') return send(res, 409, 'This record is linked to other records and cannot be changed that way', 'CONFLICT');
  }

  // body-parser problems (malformed JSON, body too large)
  const type = (err as { type?: string }).type;
  if (type === 'entity.parse.failed') return send(res, 400, 'The request body is not valid JSON', 'BAD_REQUEST');
  if (type === 'entity.too.large') return send(res, 413, 'The request is too large', 'PAYLOAD_TOO_LARGE');

  console.error(`[${res.locals.requestId}] ${req.method} ${req.originalUrl}`, err);
  return send(res, 500, 'The server hit an unexpected problem. Please try again.', 'INTERNAL');
};
