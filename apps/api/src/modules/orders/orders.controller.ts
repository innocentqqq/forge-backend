import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import {
  acceptOrder,
  createOrder,
  createOrderMessage,
  declineOrder,
  getOrder,
  listCustomerOrders,
  listOrderMessages,
  listProviderOrders,
  startDemoPrint,
  updateProgress,
  updateStatus,
} from './orders.service';
import {
  createMessageSchema,
  createOrderSchema,
  progressSchema,
  statusSchema,
} from './orders.schemas';

function orderId(req: Request): string {
  const id = req.params.id;
  if (!id) throw new AppError(400, 'MISSING_ORDER_ID', 'An order id is required.');
  return id;
}

export async function createOrderHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const order = await createOrder(user.id, createOrderSchema.parse(req.body));
  res.status(201).json({ order });
}

export async function listOrdersHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  res.status(200).json({ orders: await listCustomerOrders(user.id) });
}

export async function listProviderOrdersHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  res.status(200).json({ orders: await listProviderOrders(user.id) });
}

export async function getOrderHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  res.status(200).json({ order: await getOrder(user.id, orderId(req)) });
}

export async function updateProgressHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const input = progressSchema.parse(req.body);
  res.status(200).json({ order: await updateProgress(user.id, orderId(req), input) });
}

export async function updateStatusHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const input = statusSchema.parse(req.body);
  res.status(200).json({ order: await updateStatus(user.id, orderId(req), input) });
}

export async function acceptOrderHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  res.status(200).json({ order: await acceptOrder(user.id, orderId(req)) });
}

export async function declineOrderHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  res.status(200).json({ order: await declineOrder(user.id, orderId(req)) });
}

export async function startDemoPrintHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  res.status(200).json({ order: await startDemoPrint(user.id, orderId(req)) });
}

export async function listMessagesHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  res.status(200).json({ messages: await listOrderMessages(user.id, orderId(req)) });
}

export async function createMessageHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const input = createMessageSchema.parse(req.body);
  res.status(201).json({ message: await createOrderMessage(user.id, orderId(req), input.body) });
}
