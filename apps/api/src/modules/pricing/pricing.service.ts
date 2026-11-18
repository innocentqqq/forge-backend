import { z } from 'zod';

export const QUALITY_FACTORS = {
  DRAFT: 0.8,
  STANDARD: 1.0,
  HIGH: 1.3,
} as const;

export const MATERIAL_RATES = {
  PLA: 0.05,
  ABS: 0.07,
  PETG: 0.08,
  TPU: 0.12,
} as const;

export const pricingSchema = z.object({
  material: z.enum(['PLA', 'ABS', 'PETG', 'TPU']),
  volumeCm3: z.number().positive(),
  quantity: z.number().int().positive(),
  quality: z.enum(['DRAFT', 'STANDARD', 'HIGH']),
});

export const estimatePrice = (input: z.infer<typeof pricingSchema>): number => {
  const parsed = pricingSchema.parse(input);
  const rate = MATERIAL_RATES[parsed.material];
  const multiplier = QUALITY_FACTORS[parsed.quality];
  return rate * parsed.volumeCm3 * parsed.quantity * multiplier;
};
