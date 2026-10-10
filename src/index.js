import express from 'express';
import { getRepository as defaultGetRepository } from './models/libraryModel.js';
import { resourceRoutes } from './routes/resourceRoutes.js';
import { errorHandler } from './utils/errors.js';

export function createApp({ getRepository = defaultGetRepository } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.get('/', (req, res) => res.json({
    name: 'Library Loans API',
    version: '1.0.0',
    endpoints: ['/members', '/books', '/loans', '/loans?status=Terlambat', '/health', '/health/ready'],
    documentation: 'https://github.com/kaylrad/PPB_modul1_sales#readme',
  }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (req, res) => {
    await getRepository().health();
    res.json({ status: 'ok', database: 'connected' });
  });
  for (const resource of ['members', 'books', 'loans']) {
    app.use(`/${resource}`, resourceRoutes(resource, getRepository));
  }
  app.use((req, res) => res.status(404).json({ error: { message: 'Endpoint tidak ditemukan.' } }));
  app.use(errorHandler);
  return app;
}

export default createApp();
