import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
});

export const getUploadUrl = async (req: Request, res: Response) => {
  try {
    const { fileName } = uploadUrlSchema.parse(req.body);
    const { data, error } = await supabase.storage
      .from('models')
      .createSignedUrl(fileName, 60 * 10); // 10 minutes

    if (error) throw error;

    res.json({ url: data.signedUrl });
  } catch (error) {
    res.status(400).json({
      error: {
        code: 'UPLOAD_URL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};

const processSchema = z.object({
  material: z.enum(['PLA', 'ABS', 'PETG', 'TPU']),
});

export const processModel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { material } = processSchema.parse(req.body);

    const { data: file, error: getError } = await supabase.storage
      .from('models')
      .download(id || '');

    if (getError || !file) throw new Error('File not found');

    // Mock parser (replace with actual STL/3MF/OBJ parser later)
    const dimensions = { x: 10, y: 10, z: 10 }; // mm
    const volume = 12.5; // cm³, placeholder calculation

    await supabase.from('model_files').insert({
      id,
      user_id: req.user?.id || '',
      file_name: id,
      material,
      volume_cm3: volume,
      dimensions,
    });

    res.json({ id, dimensions, volume });
  } catch (error) {
    res.status(400).json({
      error: {
        code: 'PROCESS_MODEL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};
