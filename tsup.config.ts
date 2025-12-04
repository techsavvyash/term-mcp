import { defineConfig } from "tsup";

export default defineConfig([
  // Library entry (no shebang)
  {
    entry: {
      index: "src/index.ts",
    },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node18",
    splitting: false,
    external: ["node-pty"],
  },
  // MCP server (runs with node for node-pty compatibility)
  {
    entry: {
      server: "src/server.ts",
    },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    target: "node18",
    splitting: false,
    external: ["node-pty"],
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  // Web server (requires Bun for Bun.serve)
  {
    entry: {
      "web-server": "src/web-server.ts",
    },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    target: "node18",
    splitting: false,
    external: ["node-pty"],
    banner: {
      js: "#!/usr/bin/env bun",
    },
  },
]);
