import { z } from 'zod';
import { MATERIALS, QUALITIES } from './profile.types';

export const materialSchema = z.enum(MATERIALS);
export const qualitySchema = z.enum(QUALITIES);

export const notificationSettingsSchema = z
  .object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    orderUpdates: z.boolean().optional(),
    promotions: z.boolean().optional(),
  })
  .strict();

export const preferenceSettingsSchema = z
  .object({
    material: materialSchema.optional(),
    quality: qualitySchema.optional(),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).nullable().optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
    phone: z.string().trim().min(3).max(32).nullable().optional(),
    notifications: notificationSettingsSchema.optional(),
    preferences: preferenceSettingsSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided',
      });
    }

    if (value.notifications && Object.keys(value.notifications).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notifications'],
        message: 'At least one notification setting must be provided',
      });
    }

    if (value.preferences && Object.keys(value.preferences).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['preferences'],
        message: 'At least one preference must be provided',
      });
    }
  });

export const createSavedPrinterSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    manufacturer: z.string().trim().min(1).max(120).nullish(),
    model: z.string().trim().min(1).max(120).nullish(),
    material: materialSchema.default('PLA'),
    quality: qualitySchema.default('STANDARD'),
    notes: z.string().trim().max(2000).nullish(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export const savedPrinterIdSchema = z.string().uuid('Saved printer id must be a valid UUID');

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateSavedPrinterInput = z.infer<typeof createSavedPrinterSchema>;
