import { getAuthUser } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import {
  createSavedPrinterSchema,
  savedPrinterIdSchema,
  updateProfileSchema,
} from './profile.schemas';
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

export const listSavedPrinters = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const printers = await profileService.listSavedPrinters(user.id);
  res.status(200).json(printers);
});

export const createSavedPrinter = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = createSavedPrinterSchema.parse(req.body);
  const printer = await profileService.createSavedPrinter(user.id, input);
  res.status(201).json(printer);
});

export const deleteSavedPrinter = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const printerId = savedPrinterIdSchema.parse(req.params.id);
  await profileService.deleteSavedPrinter(user.id, printerId);
  res.status(200).json({ success: true });
});
