import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/native-host.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  shims: true,
  splitting: false,
  bundle: true,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
