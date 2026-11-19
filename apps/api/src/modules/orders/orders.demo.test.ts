import { projectDemoOrder } from './orders.demo';
import type { OrderRow } from './orders.types';

const startedAt = '2026-11-19T12:00:00.000Z';
const start = Date.parse(startedAt);

function demoOrder(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 'order-1',
    order_number: 'DEMO001',
    user_id: 'customer-1',
    model_id: 'model-1',
    printer_id: 'printer-1',
    material: 'PLA',
    quality: 'STANDARD',
    infill: 20,
    quantity: 1,
    price_snapshot: 100,
    status: 'CONFIRMED',
    progress: 0,
    demo_started_at: startedAt,
    eta: null,
    created_at: startedAt,
    updated_at: startedAt,
    ...overrides,
  };
}

describe('projectDemoOrder', () => {
  it('stays at the beginning immediately after the demo starts', () => {
    const projected = projectDemoOrder(demoOrder(), start);
    expect(projected.status).toBe('CONFIRMED');
    expect(projected.progress).toBe(0);
  });

  it('moves through queue and printing as the clock advances', () => {
    expect(projectDemoOrder(demoOrder(), start + 2_000).status).toBe('IN_QUEUE');
    const printing = projectDemoOrder(demoOrder(), start + 30_000);
    expect(printing.status).toBe('PRINTING');
    expect(printing.progress).toBe(50);
  });

  it('finishes after 60 seconds', () => {
    const projected = projectDemoOrder(demoOrder(), start + 60_000);
    expect(projected.status).toBe('READY_FOR_PICKUP');
    expect(projected.progress).toBe(100);
  });

  it('does not override a declined or cancelled order', () => {
    const declined = demoOrder({ status: 'DECLINED' });
    expect(projectDemoOrder(declined, start + 30_000)).toEqual(declined);
  });

  it('leaves manually controlled orders unchanged', () => {
    const manual = demoOrder({ demo_started_at: null, status: 'PRINTING', progress: 42 });
    expect(projectDemoOrder(manual, start + 30_000)).toEqual(manual);
  });
});
