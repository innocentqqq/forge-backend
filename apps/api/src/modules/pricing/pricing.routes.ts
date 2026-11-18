import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { estimate } from './pricing.controller';

export const pricingRouter = Router();

pricingRouter.post('/estimate', requireAuth, asyncHandler(estimate));

export default pricingRouter;
