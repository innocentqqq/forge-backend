import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../middleware/error';
import { createUploadUrl, getModelById, processAndSaveModel } from './models.service';

export const uploadUrlSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .refine(
      (name) => /\.(stl|obj|3mf)$/i.test(name),
      'Only .stl, .obj, and .3mf files are supported',
    ),
  sizeBytes: z
    .number()
    .int('File size must be an integer')
    .positive('File size must be positive')
    .max(52428800, 'File size exceeds maximum limit of 50 MB'),
});

export const createModelSchema = z.object({
  path: z.string().min(1, 'Storage path is required'),
});

export async function getUploadUrl(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const { fileName, sizeBytes } = uploadUrlSchema.parse(req.body);
  const result = await createUploadUrl(userId, fileName, sizeBytes);

  res.status(200).json(result);
}

export async function createModel(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const { path } = createModelSchema.parse(req.body);
  const metadata = await processAndSaveModel(userId, path);

  res.status(201).json(metadata);
}

export async function getModel(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const { id } = req.params;
  if (!id) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Model ID is required');
  }

  const model = await getModelById(userId, id);
  res.status(200).json(model);
}
