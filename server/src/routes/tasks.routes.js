import express from 'express';
import * as tasksController from '../controllers/tasks.controller.js';

const router = express.Router({ mergeParams: true });

router.get('/', tasksController.listTasks);

export default router;
