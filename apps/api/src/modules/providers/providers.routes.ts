import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireProvider } from '../../middleware/provider';
import * as providerController from './providers.controller';

export const providersRouter = Router();

// Public search — the mobile app calls this without a Bearer token.
providersRouter.get('/', providerController.searchProvidersHandler);

providersRouter.post('/onboard', requireAuth, providerController.onboardProvider);
providersRouter.get('/me', requireAuth, requireProvider, providerController.getMyProvider);
providersRouter.patch('/me', requireAuth, requireProvider, providerController.updateMyProvider);
