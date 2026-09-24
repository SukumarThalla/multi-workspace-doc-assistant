import express from 'express';
import * as workspacesController from '../controllers/workspaces.controller.js';

const router = express.Router();

router.get('/', workspacesController.listWorkspaces);
router.post('/', workspacesController.createWorkspace);
router.get('/:id', workspacesController.getWorkspace);

export default router;
