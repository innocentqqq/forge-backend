import { Router } from 'express';
import { createOrder, getOrders, getOrderById, updateOrderStatus } from './orders.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.post('/', requireAuth, createOrder);
router.get('/', requireAuth, getOrders);
router.get('/:id', requireAuth, getOrderById);
router.patch('/:id/status', requireAuth, updateOrderStatus);

export default router;
