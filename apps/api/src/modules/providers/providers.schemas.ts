import { z } from 'zod';
import { DAYS_OF_WEEK, PROVIDER_TYPES } from './providers.types';

export const providerTypeSchema = z.enum(PROVIDER_TYPES);

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a HH:mm time');

const pickupHourRangeSchema = z
  .object({
    open: timeSchema,
    close: timeSchema,
  })
  .strict()
  .refine((range) => range.open < range.close, {
    message: 'close must be later than open',
  });

export const pickupHoursSchema = z.record(z.enum(DAYS_OF_WEEK), pickupHourRangeSchema.nullable());

export const providerAvailabilitySchema = z
  .object({
    isOpen: z.boolean().optional(),
    maxQueueSize: z.number().int().positive().max(1000).optional(),
    pickupHours: pickupHoursSchema.optional(),
  })
  .strict();

const providerFields = {
  type: providerTypeSchema,
  displayName: z.string().trim().min(1).max(120),
  bio: z.string().trim().max(1000).nullable().optional(),
  pickupArea: z.string().trim().min(1).max(160),
  pickupAddress: z.string().trim().min(5).max(500),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  availability: providerAvailabilitySchema.optional(),
};

export const onboardProviderSchema = z
  .object(providerFields)
  .strict()
  .superRefine((value, ctx) => {
    const hasLatitude = value.latitude !== undefined && value.latitude !== null;
    const hasLongitude = value.longitude !== undefined && value.longitude !== null;
    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasLatitude ? ['longitude'] : ['latitude'],
        message: 'latitude and longitude must be provided together',
      });
    }
  });

export const updateProviderSchema = z
  .object({
    type: providerTypeSchema.optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    bio: z.string().trim().max(1000).nullable().optional(),
    pickupArea: z.string().trim().min(1).max(160).optional(),
    pickupAddress: z.string().trim().min(5).max(500).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    availability: providerAvailabilitySchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided',
      });
    }

    if (value.availability && Object.keys(value.availability).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['availability'],
        message: 'At least one availability field must be provided',
      });
    }

    if (value.latitude !== undefined && value.longitude === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['longitude'],
        message: 'longitude is required when latitude is provided',
      });
    }
    if (value.longitude !== undefined && value.latitude === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'latitude is required when longitude is provided',
      });
    }
  });

export type OnboardProviderInput = z.infer<typeof onboardProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
