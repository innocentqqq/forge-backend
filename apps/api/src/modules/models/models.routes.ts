import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { createModel, getModel, getUploadUrl } from './models.controller';

const router = Router();

router.use(requireAuth);

router.post('/upload-url', asyncHandler(getUploadUrl));
router.post('/', asyncHandler(createModel));
router.get('/:id', asyncHandler(getModel));

export default router;
