import { Router } from 'express';
import { getPrinters, getPrinterById } from './printers.controller';

const router = Router();

router.get('/', getPrinters);
router.get('/:id', getPrinterById);

export default router;
