import fs from 'node:fs';
import path from 'node:path';
import type { Router } from 'express';

export interface RegisteredModule {
  basePath: string;
  router: Router;
}

interface ModuleExports {
  router?: Router;
  default?: Router;
  basePath?: string;
}

const MODULES_DIR = path.join(__dirname, '..', 'modules');

function isModuleNotFoundFor(error: unknown, entry: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'MODULE_NOT_FOUND' && error.message.includes(entry);
}

export function loadModuleRouters(): RegisteredModule[] {
  if (!fs.existsSync(MODULES_DIR)) {
    return [];
  }

  const moduleNames = fs
    .readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const modules: RegisteredModule[] = [];

  for (const name of moduleNames) {
    const entry = path.join(MODULES_DIR, name, 'index');
    let loaded: ModuleExports;

    try {
      loaded = require(entry) as ModuleExports;
    } catch (error) {
      if (isModuleNotFoundFor(error, entry)) {
        continue;
      }
      throw error;
    }

    const router = loaded.router ?? loaded.default;
    if (!router) {
      throw new Error(`Module "${name}" must export an Express router as "router" or default`);
    }

    modules.push({
      basePath: loaded.basePath ?? `/${name}`,
      router,
    });
  }

  return modules;
}
