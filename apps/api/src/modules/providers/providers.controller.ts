import { getAuthUser, type AuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { getRequestProvider } from '../../middleware/provider';
import {
  createProviderSchema,
  hoursBodySchema,
  onboardProviderSchema,
  printerInputSchema,
  printerMaterialsSchema,
  printerUpdateSchema,
  updateProviderSchema,
} from './providers.schemas';
import * as providerService from './providers.service';
import { searchProviders } from './providers.search';

function providerUserId(user: AuthUser): string {
  return user.id;
}

export const searchProvidersHandler = asyncHandler(async (req, res) => {
  const providers = await searchProviders(req.query as Record<string, unknown>);
  res.status(200).json({ providers });
});

export const onboardProvider = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = onboardProviderSchema.parse(req.body);
  const provider = await providerService.onboardProvider(user, input);
  res.status(201).json(provider);
});

export const createProvider = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = createProviderSchema.parse(req.body);
  const provider = await providerService.createProvider(user, input);
  res.status(201).json(provider);
});

export const getMyProvider = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const profile = await providerService.getMyProvider(providerUserId(user));
  res.status(200).json(profile);
});

export const updateMyProvider = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = updateProviderSchema.parse(req.body);
  const profile = await providerService.updateMyProvider(providerUserId(user), input);
  res.status(200).json(profile);
});

export const listMyPrinters = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  res.status(200).json({ printers: await providerService.listMyPrinters(providerUserId(user)) });
});

export const createMyPrinter = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = printerInputSchema.parse(req.body);
  res.status(201).json(await providerService.createMyPrinter(providerUserId(user), input));
});

export const updateMyPrinter = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = printerUpdateSchema.parse(req.body);
  res
    .status(200)
    .json(
      await providerService.updateMyPrinter(providerUserId(user), req.params.id as string, input),
    );
});

export const deleteMyPrinter = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const result = await providerService.deleteMyPrinter(
    providerUserId(user),
    req.params.id as string,
  );
  res.status(200).json(result);
});

export const setPrinterMaterials = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = printerMaterialsSchema.parse(req.body);
  res
    .status(200)
    .json(
      await providerService.setPrinterMaterials(
        providerUserId(user),
        req.params.id as string,
        input,
      ),
    );
});

export const updateMyHours = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const hours = hoursBodySchema.parse(req.body);
  res.status(200).json(await providerService.updateMyHours(providerUserId(user), hours));
});

export const activateProvider = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  res.status(200).json(await providerService.activateProvider(providerUserId(user)));
});

export const listMyOrders = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  // The provider middleware has already verified ownership of a provider profile.
  getRequestProvider(req);
  res.status(200).json({ orders: await providerService.listProviderOrders(providerUserId(user)) });
});
