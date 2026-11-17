import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'dummy-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function seedPrinters() {
  const krirkLabs = [
    {
      name: 'Krirk University Lab A',
      lat: 13.8742,
      lng: 100.6075,
      printer_count: 5,
      price_factor: 1.0,
      est_completion_hours_per_unit: 2.0,
      contact_info: { phone: '+66 2 922 3000', email: 'laba@krirk.ac.th' },
      location_details: 'Building 1, Room 101, Main Campus',
    },
    {
      name: 'Krirk University Lab B',
      lat: 13.8755,
      lng: 100.609,
      printer_count: 3,
      price_factor: 0.9,
      est_completion_hours_per_unit: 2.5,
      contact_info: { phone: '+66 2 922 3001', email: 'labb@krirk.ac.th' },
      location_details: 'Building 2, Room 203',
    },
    {
      name: 'Krirk University Lab C',
      lat: 13.872,
      lng: 100.605,
      printer_count: 8,
      price_factor: 1.2,
      est_completion_hours_per_unit: 1.5,
      contact_info: { phone: '+66 2 922 3002', email: 'labc@krirk.ac.th' },
      location_details: 'Engineering Innovation Center, Floor 3',
    },
    {
      name: 'Krirk University Lab D',
      lat: 13.878,
      lng: 100.612,
      printer_count: 4,
      price_factor: 1.1,
      est_completion_hours_per_unit: 1.8,
      contact_info: { phone: '+66 2 922 3003', email: 'labd@krirk.ac.th' },
      location_details: 'Design and Architecture Studio',
    },
  ];

  console.log('Seeding Krirk University Labs printers...');

  for (const lab of krirkLabs) {
    const { error } = await supabase.from('printers').upsert(lab, { onConflict: 'name' }); // Assuming name or unique constraint, or just insert
    if (error) {
      // If no unique constraint on name, try insert
      const { error: insertError } = await supabase.from('printers').insert(lab);
      if (insertError) {
        console.error(`Failed to seed printer ${lab.name}:`, insertError.message);
      } else {
        console.log(`Successfully seeded: ${lab.name}`);
      }
    } else {
      console.log(`Successfully seeded: ${lab.name}`);
    }
  }
}

if (require.main === module) {
  seedPrinters().catch(console.error);
}
