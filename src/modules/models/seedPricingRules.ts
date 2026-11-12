import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const seedPricingRules = async () => {
  const { data, error } = await supabase.from('pricing_rules').upsert([
    { material: 'PLA', rate: 0.05 },
    { material: 'ABS', rate: 0.07 },
    { material: 'PETG', rate: 0.08 },
    { material: 'TPU', rate: 0.12 },
  ]);

  if (error) {
    console.error('Error seeding pricing rules:', error.message);
  } else {
    console.log('Pricing rules seeded successfully:', data);
  }
};

seedPricingRules();
