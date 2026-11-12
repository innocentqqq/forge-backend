import { getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { saveProviderSchema, savedProviderIdSchema, updateProfileSchema } from './profile.schemas';
import * as profileService from './profile.service';

export const getProfile = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const profile = await profileService.getOrCreateProfile(user);
  res.status(200).json(profile);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = updateProfileSchema.parse(req.body);
  const profile = await profileService.updateProfile(user, input);
  res.status(200).json(profile);
});

export const getProfileStats = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const stats = await profileService.getProfileStats(user.id);
  res.status(200).json(stats);
});

export const listSavedProviders = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const providers = await profileService.listSavedProviders(user.id);
  res.status(200).json(providers);
});

export const saveProvider = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = saveProviderSchema.parse(req.body);
  const saved = await profileService.saveProvider(user.id, input);
  res.status(201).json(saved);
});

export const deleteSavedProvider = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const providerId = savedProviderIdSchema.parse(req.params.id);
  await profileService.deleteSavedProvider(user.id, providerId);
  res.status(200).json({ success: true });
});
