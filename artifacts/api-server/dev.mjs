import { spawn } from "node:child_process";

process.env.NODE_ENV ??= "development";

await new Promise((resolve, reject) => {
  const build = spawn(process.execPath, ["./build.mjs"], {
    cwd: import.meta.dirname,
    env: process.env,
    stdio: "inherit",
  });

  build.on("exit", (code) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(`Build failed with exit code ${code ?? "unknown"}`));
  });

  build.on("error", reject);
});

const child = spawn(
  process.execPath,
  ["--enable-source-maps", "./dist/index.mjs"],
  {
    cwd: import.meta.dirname,
    env: process.env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
