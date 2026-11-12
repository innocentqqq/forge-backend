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

export const saveProviderSchema = z
  .object({
    providerId: z.string().uuid('Provider id must be a valid UUID'),
  })
  .strict();

export const savedProviderIdSchema = z.string().uuid('Provider id must be a valid UUID');

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SaveProviderInput = z.infer<typeof saveProviderSchema>;
