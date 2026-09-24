import saveTask from './saveTask.js';
import notifyDiscord from './notifyDiscord.js';

export const registry = [saveTask, notifyDiscord].reduce((acc, tool) => {
  acc[tool.name] = tool;
  return acc;
}, {});

export const declarations = Object.values(registry).map((tool) => tool.declaration);
