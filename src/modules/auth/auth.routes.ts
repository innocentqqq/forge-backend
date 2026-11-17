import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as authController from './auth.controller';

export const authRouter = Router();

authRouter.use(requireAuth);

authRouter.post('/oauth-signin-check', authController.checkOAuthSignIn);
