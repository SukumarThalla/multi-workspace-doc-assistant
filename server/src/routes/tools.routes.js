import express from 'express';
import * as toolsController from '../controllers/tools.controller.js';

const router = express.Router({ mergeParams: true });

router.get('/', toolsController.listToolCalls);

export default router;
