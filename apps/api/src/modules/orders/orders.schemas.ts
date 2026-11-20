import { z } from 'zod';

const uuid = z.string().uuid();
const material = z.enum(['PLA', 'ABS', 'PETG', 'TPU']);
const quality = z.enum(['DRAFT', 'STANDARD', 'HIGH']);
const status = z.enum([
  'PENDING_ACCEPTANCE',
  'CONFIRMED',
  'IN_QUEUE',
  'PRINTING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
]);

/** Accepts the new camelCase marketplace body and the legacy snake_case body. */
export const createOrderSchema = z
  .object({
    modelId: uuid.optional(),
    model_id: uuid.optional(),
    providerId: uuid.optional(),
    printer_id: uuid.optional(),
    material,
    quality,
    quantity: z.number().int().positive().default(1),
    color: z.string().max(60).optional(),
    payment_method: z.enum(['CASH_ON_PICKUP', 'PROMPTPAY']).optional(),
    infill: z.number().int().min(0).max(100).default(20),
  })
  .refine((value) => Boolean(value.modelId ?? value.model_id), {
    message: 'modelId is required',
    path: ['modelId'],
  })
  .refine((value) => Boolean(value.providerId ?? value.printer_id), {
    message: 'providerId is required',
    path: ['providerId'],
  })
  .transform((value) => ({
    modelId: (value.modelId ?? value.model_id) as string,
    providerOrPrinterId: (value.providerId ?? value.printer_id) as string,
    material: value.material,
    quality: value.quality,
    quantity: value.quantity,
    color: value.color ?? null,
    paymentMethod: value.payment_method ?? 'CASH_ON_PICKUP',
    infill: value.infill,
    usedProviderId: Boolean(value.providerId),
  }));

export const progressSchema = z.object({
  progress: z.number().finite().min(0).max(100),
  status: status.optional(),
});

export const statusSchema = z.object({
  status,
  notes: z.string().max(1000).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
export type StatusInput = z.infer<typeof statusSchema>;
