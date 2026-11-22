import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
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

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: false }));
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

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);
