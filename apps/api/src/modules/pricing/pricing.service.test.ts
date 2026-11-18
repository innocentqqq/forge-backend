import { estimatePrice, MATERIAL_RATES, QUALITY_FACTORS } from './pricing.service';

type Material = keyof typeof MATERIAL_RATES;
type Quality = keyof typeof QUALITY_FACTORS;

const MATERIALS = Object.keys(MATERIAL_RATES) as Material[];
const QUALITIES = Object.keys(QUALITY_FACTORS) as Quality[];

describe('pricing formula', () => {
  it('uses the documented constants', () => {
    expect(QUALITY_FACTORS).toEqual({ DRAFT: 0.8, STANDARD: 1, HIGH: 1.3 });
    expect(MATERIAL_RATES).toEqual({ PLA: 0.05, ABS: 0.07, PETG: 0.08, TPU: 0.12 });
  });

  it.each(MATERIALS)('uses the %s rate', (material) => {
    expect(
      estimatePrice({ material, volumeCm3: 100, quantity: 1, quality: 'STANDARD' }),
    ).toBeCloseTo(MATERIAL_RATES[material] * 100, 10);
  });

  it.each(QUALITIES)('applies the %s quality factor', (quality) => {
    expect(estimatePrice({ material: 'PLA', volumeCm3: 100, quantity: 1, quality })).toBeCloseTo(
      0.05 * 100 * QUALITY_FACTORS[quality],
      10,
    );
  });

  it.each(
    MATERIALS.flatMap((material) => QUALITIES.map((quality) => [material, quality] as const)),
  )('computes %s/%s exactly', (material, quality) => {
    const volumeCm3 = 37.5;
    const quantity = 3;
    expect(estimatePrice({ material, volumeCm3, quantity, quality })).toBeCloseTo(
      MATERIAL_RATES[material] * volumeCm3 * quantity * QUALITY_FACTORS[quality],
      10,
    );
  });

  it('scales linearly with quantity above 1', () => {
    const one = estimatePrice({ material: 'PETG', volumeCm3: 25, quantity: 1, quality: 'HIGH' });
    const four = estimatePrice({ material: 'PETG', volumeCm3: 25, quantity: 4, quality: 'HIGH' });
    expect(four).toBeCloseTo(one * 4, 10);
  });

  it('returns 0 only when the volume is 0, which the schema rejects', () => {
    expect(() =>
      estimatePrice({ material: 'PLA', volumeCm3: 0, quantity: 1, quality: 'STANDARD' }),
    ).toThrow();
  });

  it.each([
    { material: 'PLA', volumeCm3: -1, quantity: 1, quality: 'STANDARD' },
    { material: 'PLA', volumeCm3: 10, quantity: 0, quality: 'STANDARD' },
    { material: 'PLA', volumeCm3: 10, quantity: 1.5, quality: 'STANDARD' },
    { material: 'UNKNOWN', volumeCm3: 10, quantity: 1, quality: 'STANDARD' },
    { material: 'PLA', volumeCm3: 10, quantity: 1, quality: 'ULTRA' },
  ])('rejects invalid input %#', (input) => {
    expect(() => estimatePrice(input as never)).toThrow();
  });
});
