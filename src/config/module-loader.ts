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
const MODULE_ENTRY_EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs'];

function resolveModuleEntry(moduleDir: string): string | null {
  for (const extension of MODULE_ENTRY_EXTENSIONS) {
    const candidate = path.join(moduleDir, `index${extension}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
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
    const entry = resolveModuleEntry(path.join(MODULES_DIR, name));
    if (!entry) {
      continue;
    }

    const loaded = require(entry) as ModuleExports;
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
