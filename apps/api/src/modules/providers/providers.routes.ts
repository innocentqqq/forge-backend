import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireProvider } from '../../middleware/provider';
import * as providerController from './providers.controller';

export const providersRouter = Router();

// Public search — the mobile app calls this without a Bearer token.
providersRouter.get('/', providerController.searchProvidersHandler);

// Onboarding: POST /providers is canonical; /onboard stays as a legacy alias.
providersRouter.post('/', requireAuth, providerController.createProvider);
providersRouter.post('/onboard', requireAuth, providerController.onboardProvider);

// More specific /me/* routes are registered before the generic /me routes.
providersRouter.get(
  '/me/printers',
  requireAuth,
  requireProvider,
  providerController.listMyPrinters,
);
providersRouter.post(
  '/me/printers',
  requireAuth,
  requireProvider,
  providerController.createMyPrinter,
);
providersRouter.patch(
  '/me/printers/:id',
  requireAuth,
  requireProvider,
  providerController.updateMyPrinter,
);
providersRouter.delete(
  '/me/printers/:id',
  requireAuth,
  requireProvider,
  providerController.deleteMyPrinter,
);
providersRouter.put(
  '/me/printers/:id/materials',
  requireAuth,
  requireProvider,
  providerController.setPrinterMaterials,
);
providersRouter.put('/me/hours', requireAuth, requireProvider, providerController.updateMyHours);
providersRouter.post(
  '/me/activate',
  requireAuth,
  requireProvider,
  providerController.activateProvider,
);
providersRouter.get('/me/orders', requireAuth, requireProvider, providerController.listMyOrders);

providersRouter.get('/me', requireAuth, requireProvider, providerController.getMyProvider);
providersRouter.patch('/me', requireAuth, requireProvider, providerController.updateMyProvider);
