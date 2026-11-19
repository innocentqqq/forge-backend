import { getAuthUser } from '../../middleware/auth';
import { getRequestProvider } from '../../middleware/provider';
import { asyncHandler } from '../../middleware/error';
import { onboardProviderSchema, updateProviderSchema } from './providers.schemas';
import * as providerService from './providers.service';

export const onboardProvider = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = onboardProviderSchema.parse(req.body);
  const provider = await providerService.onboardProvider(user, input);
  res.status(201).json(provider);
});

export const getMyProvider = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const profile = await providerService.getMyProvider(user.id);
  res.status(200).json(profile);
});

export const updateMyProvider = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = updateProviderSchema.parse(req.body);
  const profile = await providerService.updateMyProvider(user.id, input);
  res.status(200).json(profile);
});

export const listMyPrinters = asyncHandler(async (req, res) => {
  const provider = getRequestProvider(req);
  const printers = await providerService.listProviderPrinters(provider.id);
  res.status(200).json({ printers });
});

export const listMyOrders = asyncHandler(async (req, res) => {
  const provider = getRequestProvider(req);
  const orders = await providerService.listProviderOrders(provider.id);
  res.status(200).json({ orders });
});
