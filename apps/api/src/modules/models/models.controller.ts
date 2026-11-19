import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { supabaseAdmin } from '../../config/supabase';
import { getAuthUser } from '../../middleware/auth';
import { AppError, asyncHandler } from '../../middleware/error';

/**
 * Model uploads.
 * The server — not the client — picks the storage path: `<userId>/<modelId>`.
 * A user can therefore only create and process objects in their own folder.
 * The 50 MB size cap is enforced by the `models` bucket (see the storage migration).
 */

export const MODELS_BUCKET = 'models';
export const ALLOWED_MODEL_EXTENSIONS = ['stl', '3mf', 'obj'] as const;
export const MAX_MODEL_BYTES = 50 * 1024 * 1024;

export function modelObjectPath(userId: string, modelId: string): string {
  return `${userId}/${modelId}`;
}

const uploadUrlSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine(
      (name) =>
        (ALLOWED_MODEL_EXTENSIONS as readonly string[]).includes(
          name.split('.').pop()?.toLowerCase() ?? '',
        ),
      { message: 'File must be an STL, 3MF, or OBJ model' },
    ),
  size: z.number().int().positive().max(MAX_MODEL_BYTES, 'File is larger than 50 MB').optional(),
});

const processSchema = z.object({
  material: z.enum(['PLA', 'ABS', 'PETG', 'TPU']),
  fileName: z.string().trim().min(1).max(200).optional(),
});

export const getUploadUrl = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const { fileName } = uploadUrlSchema.parse(req.body);

  const id = randomUUID();
  const path = modelObjectPath(user.id, id);
  const { data, error } = await supabaseAdmin.storage
    .from(MODELS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new AppError(500, 'UPLOAD_URL_ERROR', 'Could not create an upload link');
  }

  res.json({ id, fileName, url: data.signedUrl, token: data.token, path: data.path });
});

export const processModel = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) {
    throw new AppError(404, 'NOT_FOUND', 'Model not found');
  }
  const { material, fileName } = processSchema.parse(req.body);

  // Only the caller's own folder is ever read.
  const { data: file, error: downloadError } = await supabaseAdmin.storage
    .from(MODELS_BUCKET)
    .download(modelObjectPath(user.id, id.data));
  if (downloadError || !file) {
    throw new AppError(404, 'NOT_FOUND', 'Model not found');
  }
  if (file.size > MAX_MODEL_BYTES) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'File is larger than 50 MB');
  }

  // Placeholder geometry until a real STL/3MF/OBJ parser exists (tracked separately).
  const dimensions = { x: 10, y: 10, z: 10 }; // mm
  const volume = 12.5; // cm³

  const { error: insertError } = await supabaseAdmin.from('model_files').insert({
    id: id.data,
    user_id: user.id,
    file_name: fileName ?? id.data,
    material,
    volume_cm3: volume,
    dimensions,
  });
  if (insertError) {
    throw new AppError(500, 'PROCESS_MODEL_ERROR', 'Could not save model details');
  }

  res.json({ id: id.data, dimensions, volume });
});
