import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { authenticate, requireRole } from '../../middleware/auth';
import { EDITORS } from '../../lib/roles';

export const sourcesRouter = Router();
sourcesRouter.use(authenticate);

sourcesRouter.get(
  '/',
  ah(async (_req, res) => {
    res.json(await prisma.knowledgeSource.findMany({ orderBy: { title: 'asc' }, include: { _count: { select: { nutrientValues: true } } } }));
  }),
);

sourcesRouter.post(
  '/',
  requireRole(...EDITORS),
  ah(async (req, res) => {
    const body = z
      .object({
        title: z.string().trim().min(1),
        publisher: z.string().trim().optional(),
        url: z.string().url().optional(),
        publicationYear: z.number().int().min(1900).max(2100).optional(),
        licenseNote: z.string().trim().optional(),
      })
      .parse(req.body);
    const source = await prisma.knowledgeSource.create({ data: body });
    await audit(req.user!.id, 'CREATE', 'KnowledgeSource', source.id);
    res.status(201).json(source);
  }),
);
