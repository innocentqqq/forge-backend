import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env, isProduction } from './config/env';
import { loadModuleRouters } from './config/module-loader';
import { errorHandler, notFoundHandler } from './middleware/error';

function corsOrigin(): string | string[] {
  if (env.CORS_ORIGIN === '*') {
    return '*';
  }
  return env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function healthPayload() {
  return {
    status: 'ok',
    service: 'forge-api',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigin() }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json(healthPayload());
  });

  const api = express.Router();
  api.get('/health', (_req, res) => {
    res.status(200).json(healthPayload());
  });

  for (const { basePath, router } of loadModuleRouters()) {
    api.use(basePath, router);
  }

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  return app;
}

export const app = createApp();
