import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as profileController from './profile.controller';

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get('/', profileController.getProfile);
profileRouter.patch('/', profileController.updateProfile);
profileRouter.get('/stats', profileController.getProfileStats);

profileRouter.get('/saved-providers', profileController.listSavedProviders);
profileRouter.post('/saved-providers', profileController.saveProvider);
profileRouter.delete('/saved-providers/:id', profileController.deleteSavedProvider);
