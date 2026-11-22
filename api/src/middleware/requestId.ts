import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';

/** Gives every request a short reference id, returned in the X-Request-Id header and in error bodies, and logged on server errors. */
export const requestId: RequestHandler = (req, res, next) => {
  const id = randomUUID().slice(0, 8);
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
