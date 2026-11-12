import { estimatePrice } from '../pricing/pricing.service';

describe('Pricing Service', () => {
    it('calculates price for PLA, DRAFT quality', () => {
        const price = estimatePrice({ material: 'PLA', volumeCm3: 28.5, quantity: 1, quality: 'DRAFT' });
        expect(price).toBeCloseTo(6.42, 2); // Base fee + (28.5 × $0.05 × 1.0)
    });

    it('calculates price for TPU, HIGH quality', () => {
        const price = estimatePrice({ material: 'TPU', volumeCm3: 15, quantity: 3, quality: 'HIGH' });
        expect(price).toBeCloseTo(70.35, 2); // Base fee + (15 × $0.12 × 1.7 × 3)
    });
});