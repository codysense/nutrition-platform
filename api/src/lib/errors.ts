import { RequestHandler } from 'express';

export type ErrorCode =
  | 'BAD_REQUEST' | 'VALIDATION_FAILED' | 'UNAUTHENTICATED' | 'INVALID_CREDENTIALS' | 'FORBIDDEN' | 'PASSWORD_CHANGE_REQUIRED'
  | 'NOT_FOUND' | 'CONFLICT' | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'INTERNAL';

const DEFAULT_CODE: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE', 429: 'RATE_LIMITED',
};

/** An error whose message is safe and useful to show to the user. */
export class AppError extends Error {
  public code: ErrorCode;
  constructor(public status: number, message: string, public details?: unknown, code?: ErrorCode) {
    super(message);
    this.code = code ?? DEFAULT_CODE[status] ?? 'INTERNAL';
  }
}

/** Express 4 does not catch rejected promises; wrap every async handler. */
export const ah =
  (fn: (...args: Parameters<RequestHandler>) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
