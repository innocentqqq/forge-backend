import { z } from 'zod';

export const pricingSchema = z.object({
    material: z.enum(['PLA', 'ABS', 'PETG', 'TPU']),
    volumeCm3: z.number().positive(),
    quantity: z.number().int().positive(),
    quality: z.enum(['DRAFT', 'STANDARD', 'HIGH'])
});

export const estimatePrice = ({ material, volumeCm3, quantity, quality }: z.infer<typeof pricingSchema>): number => {
    const rates = {
        PLA: 0.05,
        ABS: 0.07,
        PETG: 0.08,
        TPU: 0.12,
    };

    const baseFee = 5.0;
    const qualityMultipliers = {
        DRAFT: 1.0,
        STANDARD: 1.3,
        HIGH: 1.7,
    };

    const rate = rates[material];
    const multiplier = qualityMultipliers[quality];

    return baseFee + volumeCm3 * rate * multiplier * quantity;
};