import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
/** Compile repository sources in this CLI process, reusing the app's actual modules.
 * Hooks are restored immediately; no emitted code or changes to application files. */
export function loadRepoModules(files) {
  const require = createRequire(path.join(root, "package.json"));
  const resolve = Module._resolveFilename;
  const extension = Module._extensions[".ts"];
  try {
    Module._resolveFilename = function (request, ...args) {
      if (request === "server-only") request = path.join(root, "src/test/server-only.ts");
      if (request.startsWith("@/")) request = path.join(root, "src", request.slice(2));
      return resolve.call(this, request, ...args);
    };
    Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename);
    return Object.assign({}, ...files.map((file) => require(path.join(root, file))));
  } finally {
    Module._resolveFilename = resolve;
    if (extension) Module._extensions[".ts"] = extension;
    else delete Module._extensions[".ts"];
  }
}

/** The tutor's actual prompt, catalog, contracts and providers. */
export function loadTutorRuntime() {
  return loadRepoModules([
    "src/features/tutor/prompts.ts",
    "src/features/tutor/catalog.ts",
    "src/features/tutor/contract.ts",
    "src/features/plan/contract.ts",
    "src/features/tutor/types.ts",
    "src/lib/cards/registry.ts",
  ]);
}
