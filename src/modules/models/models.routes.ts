import { Router } from 'express';
import { getUploadUrl, processModel } from './models.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.post('/upload-url', requireAuth, getUploadUrl);
router.post('/:id/process', requireAuth, processModel);

export default router;
