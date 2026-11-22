import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/error';
import { requestId } from './middleware/requestId';
import { parseOrigins } from './config/cors';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { recipesRouter } from './modules/recipes/recipes.routes';
import { foodsRouter } from './modules/foods/foods.routes';
import { sourcesRouter } from './modules/sources/sources.routes';
import { reviewRouter } from './modules/review/review.routes';
import { statsRouter } from './modules/stats/stats.routes';
import { exportRouter } from './modules/export/export.routes';

export const app = express();

// Render (and most hosts) put a proxy in front of the app; needed for correct client IPs and rate limiting.
app.set('trust proxy', 1);

const { origins, warnings } = parseOrigins(env.CORS_ORIGIN);
warnings.forEach((w) => console.warn('[config]', w));
console.log('[config] CORS allowed origins:', origins.length ? origins.join(', ') : '(none: the web app will be blocked)');
const warnedOrigins = new Set<string>();

app.use(requestId);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || origins.includes(origin)) return cb(null, true); // no Origin header = curl, health checks, same-origin
      if (!warnedOrigins.has(origin)) {
        warnedOrigins.add(origin);
        console.warn(`[cors] Blocked a request from "${origin}". Allowed origins: ${origins.join(', ') || '(none)'}`);
      }
      cb(null, false);
    },
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin/users', usersRouter);
app.use('/api/v1/admin/dishes', recipesRouter);
app.use('/api/v1/admin/foods', foodsRouter);
app.use('/api/v1/admin/sources', sourcesRouter);
app.use('/api/v1/admin/review', reviewRouter);
app.use('/api/v1/admin/export', exportRouter);
app.use('/api/v1/admin', statsRouter);

app.use(notFound);
app.use(errorHandler);
