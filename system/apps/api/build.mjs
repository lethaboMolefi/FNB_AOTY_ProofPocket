// Bundles the API (and the shared TypeScript package) for Cloud Run. npm packages stay external.
import { build } from "esbuild";

const externalPackages = {
  name: "external-packages",
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => (args.path.startsWith("@proofpocket/") ? undefined : { path: args.path, external: true }));
  },
};

await build({
  entryPoints: { server: "src/server.ts", migrate: "src/db/migrate.ts", bootstrap: "src/db/bootstrap.ts", jobs: "src/jobs.ts", "add-admin": "src/db/add-admin.ts", "add-admins": "src/db/add-admins.ts", "demo-reset": "src/db/demo-reset.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node26",
  format: "esm",
  sourcemap: true,
  plugins: [externalPackages],
  logLevel: "info",
});
