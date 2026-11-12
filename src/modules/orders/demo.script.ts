import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'dummy-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runDemo() {
  console.log('Starting order tracking demo script...');

  // 1. Fetch a printer
  const { data: printers, error: pError } = await supabase.from('printers').select('*').limit(1);
  if (pError || !printers || printers.length === 0) {
    console.error('No printers found. Please run seedPrinters first.');
    return;
  }
  const printer = printers[0];

  // Create a dummy model_id or fetch one
  const { data: models } = await supabase.from('model_files').select('*').limit(1);
  const modelId = models && models.length > 0 ? models[0].id : '00000000-0000-0000-0000-000000000000';

  const orderNumber = 'DEMO' + Math.floor(100 + Math.random() * 900);
  const { data: order, error: oError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      model_id: modelId,
      printer_id: printer.id,
      material: 'PLA',
      quality: 'STANDARD',
      infill: 20,
      quantity: 1,
      price_snapshot: 150.00,
      status: 'CONFIRMED',
      progress: 10
    })
    .select()
    .single();

  if (oError || !order) {
    console.error('Failed to create demo order:', oError?.message);
    return;
  }

  console.log(`Created demo order ${order.order_number} (ID: ${order.id})`);

  const statuses = [
    { status: 'IN_QUEUE', notes: 'Order placed in print queue.' },
    { status: 'PRINTING', notes: 'Print job started on printer.' },
    { status: 'READY_FOR_PICKUP', notes: 'Print completed successfully. Ready for pickup!' }
  ];

  for (const step of statuses) {
    await sleep(4000); // Wait 4 seconds between transitions
    console.log(`Advancing order ${order.order_number} to ${step.status}...`);
    
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: step.status,
        progress: step.status === 'IN_QUEUE' ? 30 : step.status === 'PRINTING' ? 75 : 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Failed to update status:', updateError.message);
    } else {
      await supabase.from('order_status_events').insert({
        order_id: order.id,
        status: step.status,
        notes: step.notes
      });
      console.log(`Order ${order.order_number} is now ${step.status}`);
    }
  }

  console.log('Demo finished successfully!');
}

if (require.main === module) {
  runDemo().catch(console.error);
}
