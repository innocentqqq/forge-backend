import { z } from 'zod';
import {
  DAYS_OF_WEEK,
  MATERIALS,
  PROVIDER_STATUSES,
  PROVIDER_TYPES,
  QUALITIES,
  TECHNOLOGIES,
} from './providers.types';

export const providerTypeSchema = z.enum(PROVIDER_TYPES);
export const materialSchema = z.enum(MATERIALS);
export const qualitySchema = z.enum(QUALITIES);
export const providerStatusSchema = z.enum(PROVIDER_STATUSES);
export const technologySchema = z.enum(TECHNOLOGIES);

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

const buildVolumeSchema = z
  .object({
    x: z.number().min(20).max(1000),
    y: z.number().min(20).max(1000),
    z: z.number().min(20).max(1000),
  })
  .strict();

const materialRateSchema = z
  .object({
    ratePerCm3: z.number().finite().gt(0).lte(1000),
    minimumOrder: z.number().finite().min(0).default(0),
    colors: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export const materialRateMapSchema = z.record(materialSchema, materialRateSchema);
export const agreementsSchema = z
  .object({
    liability: z.boolean().optional(),
    paymentTerms: z.boolean().optional(),
    prohibitedItems: z.boolean().optional(),
    safePickup: z.boolean().optional(),
  })
  .strict();

export const providerAvailabilitySchema = z
  .object({
    isOpen: z.boolean().optional(),
    maxQueueSize: z.number().int().positive().max(1000).optional(),
    pickupHours: pickupHoursSchema.optional(),
    turnaroundDays: z.number().int().positive().max(365).optional(),
    maxActiveOrders: z.number().int().positive().max(1000).optional(),
  })
  .strict();

const printerFields = {
  name: z.string().trim().min(1).max(120),
  modelName: z.string().trim().min(1).max(120).nullable().optional(),
  technology: technologySchema.optional(),
  buildVolume: buildVolumeSchema,
  materials: z.array(materialSchema).min(1),
  bestQuality: qualitySchema.optional(),
  isActive: z.boolean().optional(),
  rates: materialRateMapSchema.optional(),
};

export const printerInputSchema = z.object(printerFields).strict();
export const printerUpdateSchema = z
  .object({
    name: printerFields.name.optional(),
    modelName: printerFields.modelName,
    technology: technologySchema.optional(),
    buildVolume: buildVolumeSchema.optional(),
    materials: z.array(materialSchema).min(1).optional(),
    bestQuality: qualitySchema.optional(),
    isActive: z.boolean().optional(),
    rates: materialRateMapSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one printer field must be provided',
  });

/** The original mobile app sent one printer with a single price. */
export const legacyPrinterSchema = z
  .object({
    modelName: z.string().trim().min(1).max(120),
    buildVolume: buildVolumeSchema,
    materials: z.array(materialSchema).min(1),
    pricePerCm3: z.number().finite().gt(0).lte(1000),
    minimumOrder: z.number().finite().min(0),
  })
  .strict();

const coordinateFields = {
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  exactLatitude: z.number().finite().min(-90).max(90).nullable().optional(),
  exactLongitude: z.number().finite().min(-180).max(180).nullable().optional(),
};

interface CoordinateValues {
  latitude?: number | null;
  longitude?: number | null;
  exactLatitude?: number | null;
  exactLongitude?: number | null;
}

function validateCoordinatePairs(value: CoordinateValues, ctx: z.RefinementCtx): void {
  const pairs: Array<[keyof CoordinateValues, keyof CoordinateValues, string]> = [
    ['latitude', 'longitude', 'latitude and longitude must be provided together'],
    [
      'exactLatitude',
      'exactLongitude',
      'exactLatitude and exactLongitude must be provided together',
    ],
  ];

  for (const [first, second, message] of pairs) {
    const hasFirst = value[first] !== undefined && value[first] !== null;
    const hasSecond = value[second] !== undefined && value[second] !== null;
    if (hasFirst !== hasSecond) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [second], message });
    }
  }
}

const providerFields = {
  type: providerTypeSchema,
  displayName: z.string().trim().min(1).max(120),
  bio: z.string().trim().max(1000).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  photoUrl: z.string().trim().max(1000).nullable().optional(),
  pickupArea: z.string().trim().min(1).max(160),
  pickupAddress: z.string().trim().min(5).max(500),
  ...coordinateFields,
  exactAddress: z.string().trim().max(500).nullable().optional(),
  pickupInstructions: z.string().trim().max(1000).nullable().optional(),
  contactPhone: z.string().trim().max(60).nullable().optional(),
  availability: providerAvailabilitySchema.optional(),
  hours: pickupHoursSchema.optional(),
  printers: z.array(printerInputSchema).optional(),
  printer: legacyPrinterSchema.optional(),
  rates: materialRateMapSchema.optional(),
  agreements: agreementsSchema.optional(),
};

export const onboardProviderSchema = z
  .object(providerFields)
  .strict()
  .superRefine((value, ctx) => {
    validateCoordinatePairs(value, ctx);
  });

/** POST /providers uses the extended onboarding body; /providers/onboard is an alias. */
export const createProviderSchema = onboardProviderSchema;

export const updateProviderSchema = z
  .object({
    type: providerTypeSchema.optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    bio: z.string().trim().max(1000).nullable().optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    photoUrl: z.string().trim().max(1000).nullable().optional(),
    pickupArea: z.string().trim().min(1).max(160).optional(),
    pickupAddress: z.string().trim().min(5).max(500).optional(),
    ...coordinateFields,
    exactAddress: z.string().trim().max(500).nullable().optional(),
    pickupInstructions: z.string().trim().max(1000).nullable().optional(),
    contactPhone: z.string().trim().max(60).nullable().optional(),
    status: providerStatusSchema.optional(),
    turnaroundDays: z.number().int().positive().max(365).optional(),
    maxActiveOrders: z.number().int().positive().max(1000).optional(),
    availability: providerAvailabilitySchema.optional(),
    hours: pickupHoursSchema.optional(),
    printers: z.array(printerInputSchema).optional(),
    printer: legacyPrinterSchema.optional(),
    agreements: agreementsSchema.optional(),
    rates: materialRateMapSchema.optional(),
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

    validateCoordinatePairs(value, ctx);
  });

export const printerMaterialsSchema = z
  .object({
    materials: z.array(materialSchema).min(1),
    rates: materialRateMapSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const missing = value.materials.filter((material) => !(material in value.rates));
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rates'],
        message: `A rate is required for each selected material: ${missing.join(', ')}`,
      });
    }
  });

/** PUT /providers/me/hours accepts either { hours } or the hours map directly. */
export const hoursBodySchema = z.union([
  z
    .object({ hours: pickupHoursSchema })
    .strict()
    .transform((value) => value.hours),
  pickupHoursSchema,
]);

export type OnboardProviderInput = z.infer<typeof onboardProviderSchema>;
export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type PrinterInput = z.infer<typeof printerInputSchema>;
export type PrinterUpdateInput = z.infer<typeof printerUpdateSchema>;
export type PrinterMaterialsInput = z.infer<typeof printerMaterialsSchema>;
export type HoursInput = z.infer<typeof hoursBodySchema>;
