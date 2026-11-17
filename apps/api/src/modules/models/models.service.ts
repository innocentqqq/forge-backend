import crypto from 'node:crypto';
import type { ModelFormat, ModelMetadata } from '@forge/types';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { parseModel } from './parser';

export interface ModelDetails extends ModelMetadata {
  viewUrl: string;
}

export function extractFormat(fileNameOrPath: string): ModelFormat {
  const ext = fileNameOrPath.split('.').pop()?.toLowerCase();
  if (ext === 'stl' || ext === 'obj' || ext === '3mf') {
    return ext;
  }
  throw new AppError(400, 'INVALID_FORMAT', 'Only .stl, .obj, and .3mf files are supported');
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function createUploadUrl(
  userId: string,
  fileName: string,
  sizeBytes: number,
): Promise<{ path: string; signedUrl: string }> {
  // Validate format
  extractFormat(fileName);
  if (sizeBytes <= 0 || sizeBytes > 52428800) {
    throw new AppError(400, 'INVALID_FILE_SIZE', 'File size must be between 1 byte and 50 MB');
  }

  const cleanName = sanitizeFileName(fileName);
  const storagePath = `${userId}/${crypto.randomUUID()}-${cleanName}`;

  const { data, error } = await supabaseAdmin.storage
    .from('models')
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    throw new AppError(
      500,
      'UPLOAD_URL_ERROR',
      error?.message ?? 'Could not create signed upload URL',
    );
  }

  return {
    path: storagePath,
    signedUrl: data.signedUrl,
  };
}

export async function processAndSaveModel(
  userId: string,
  storagePath: string,
): Promise<ModelMetadata> {
  const format = extractFormat(storagePath);

  const { data: blob, error: downloadError } = await supabaseAdmin.storage
    .from('models')
    .download(storagePath);

  if (downloadError || !blob) {
    throw new AppError(404, 'FILE_NOT_FOUND', 'Uploaded file could not be retrieved from storage');
  }

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let parsed;
  try {
    parsed = parseModel(format, bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not parse 3D model';
    throw new AppError(400, 'PARSE_ERROR', msg);
  }

  // Extract base file name from path
  const fileName = storagePath.split('/').pop() ?? storagePath;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('models')
    .insert({
      user_id: userId,
      owner: userId,
      file_name: fileName,
      format,
      size_bytes: bytes.byteLength,
      storage_path: storagePath,
      triangle_count: parsed.triangleCount,
      bounding_box: parsed.boundingBox,
      volume_cm3: parsed.volumeCm3,
      units: 'mm',
      is_watertight: parsed.isWatertight,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw new AppError(
      500,
      'DATABASE_ERROR',
      insertError?.message ?? 'Could not save model metadata',
    );
  }

  return {
    id: inserted.id,
    fileName: inserted.file_name,
    format: inserted.format as ModelFormat,
    sizeBytes: Number(inserted.size_bytes),
    storagePath: inserted.storage_path,
    triangleCount: Number(inserted.triangle_count),
    boundingBox: inserted.bounding_box,
    volumeCm3: Number(inserted.volume_cm3),
    units: 'mm',
    isWatertight: Boolean(inserted.is_watertight),
    createdAt: inserted.created_at,
  };
}

export async function getModelById(userId: string, modelId: string): Promise<ModelDetails> {
  const { data: model, error } = await supabaseAdmin
    .from('models')
    .select('*')
    .eq('id', modelId)
    .maybeSingle();

  if (error || !model) {
    throw new AppError(404, 'NOT_FOUND', 'Model not found');
  }

  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from('models')
    .createSignedUrl(model.storage_path, 3600);

  if (signedError || !signed) {
    throw new AppError(
      500,
      'STORAGE_ERROR',
      signedError?.message ?? 'Could not generate download URL',
    );
  }

  return {
    id: model.id,
    fileName: model.file_name,
    format: model.format as ModelFormat,
    sizeBytes: Number(model.size_bytes),
    storagePath: model.storage_path,
    triangleCount: Number(model.triangle_count),
    boundingBox: model.bounding_box,
    volumeCm3: Number(model.volume_cm3),
    units: 'mm',
    isWatertight: Boolean(model.is_watertight),
    createdAt: model.created_at,
    viewUrl: signed.signedUrl,
  };
}
