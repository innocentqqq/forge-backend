import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import * as controller from './orders.controller';

const router = Router();

router.use(requireAuth);

router.post('/', asyncHandler(controller.createOrderHandler));
router.get('/', asyncHandler(controller.listOrdersHandler));
router.get('/provider', asyncHandler(controller.listProviderOrdersHandler));

router.post('/:id/accept', asyncHandler(controller.acceptOrderHandler));
router.post('/:id/decline', asyncHandler(controller.declineOrderHandler));
router.post('/:id/demo/start', asyncHandler(controller.startDemoPrintHandler));
router.patch('/:id/progress', asyncHandler(controller.updateProgressHandler));
router.patch('/:id/status', asyncHandler(controller.updateStatusHandler));
router.get('/:id/messages', asyncHandler(controller.listMessagesHandler));
router.post('/:id/messages', asyncHandler(controller.createMessageHandler));
router.get('/:id', asyncHandler(controller.getOrderHandler));

export default router;
