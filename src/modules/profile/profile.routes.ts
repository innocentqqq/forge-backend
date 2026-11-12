import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as profileController from './profile.controller';

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get('/', profileController.getProfile);
profileRouter.patch('/', profileController.updateProfile);
profileRouter.get('/stats', profileController.getProfileStats);

profileRouter.get('/saved-printers', profileController.listSavedPrinters);
profileRouter.post('/saved-printers', profileController.createSavedPrinter);
profileRouter.delete('/saved-printers/:id', profileController.deleteSavedPrinter);
