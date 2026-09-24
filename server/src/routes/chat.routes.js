import express from 'express';
import * as chatController from '../controllers/chat.controller.js';

const router = express.Router({ mergeParams: true });

router.get('/', chatController.listMessages);
router.post('/', chatController.postMessage);

export default router;
