import type { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../../config/supabase';
import { getAuthUser } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { estimatePrice } from './pricing.service';

export const estimateRequestSchema = z.object({
  modelId: z.string().uuid('modelId must be a UUID'),
  material: z.enum(['PLA', 'ABS', 'PETG', 'TPU']),
  quality: z.enum(['DRAFT', 'STANDARD', 'HIGH']),
  quantity: z.number().int().positive(),
});

/** POST /pricing/estimate — price a saved model without creating an order. */
export async function estimate(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(req);
  const input = estimateRequestSchema.parse(req.body);

  const { data: model, error } = await supabaseAdmin
    .from('models')
    .select('id, user_id, owner, volume_cm3')
    .eq('id', input.modelId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'MODEL_FETCH_FAILED', 'Could not load the model');
  }
  if (!model) {
    throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
  }

  const ownerId = (model.owner as string | null) ?? (model.user_id as string | null);
  if (ownerId && ownerId !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'This model belongs to another user');
  }

  const volumeCm3 = Number(model.volume_cm3);
  if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0) {
    throw new AppError(422, 'INVALID_MODEL_VOLUME', 'The saved model has no usable volume');
  }

  const estimate = estimatePrice({
    material: input.material,
    quality: input.quality,
    quantity: input.quantity,
    volumeCm3,
  });

  res.status(200).json({ estimate });
}
