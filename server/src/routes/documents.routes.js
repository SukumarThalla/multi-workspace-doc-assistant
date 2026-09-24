import express from 'express';
import multer from 'multer';
import * as documentsController from '../controllers/documents.controller.js';

const router = express.Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', documentsController.listDocuments);
router.post('/', upload.single('file'), documentsController.uploadDocument);

export default router;
