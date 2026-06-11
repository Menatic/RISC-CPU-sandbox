import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

if (typeof crypto.hash !== "function") {
  crypto.hash = (algorithm, data, outputEncoding = "hex") =>
    crypto.createHash(algorithm).update(data).digest(outputEncoding);
}

const vitePackageJson = require.resolve("vite/package.json", {
  paths: [process.cwd()],
});
const viteCliPath = path.join(path.dirname(vitePackageJson), "bin", "vite.js");

await import(pathToFileURL(viteCliPath).href);
