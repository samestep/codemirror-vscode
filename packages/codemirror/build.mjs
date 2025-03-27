import * as esbuild from "esbuild";
import * as fs from "node:fs/promises";
import all from "./src/modules.json" with { type: "json" };

const modules = async () =>
  await Promise.all(
    Object.entries(all).flatMap(([organization, packages]) =>
      Object.entries(packages).map(([name, dependencies]) =>
        esbuild.build({
          stdin: {
            contents: `export * from "@${organization}/${name}";`,
            resolveDir: ".",
          },
          bundle: true,
          format: "esm",
          external: Object.entries(dependencies).flatMap(([org, deps]) =>
            deps.map((dep) => `@${org}/${dep}`),
          ),
          outfile: `dist/${organization}/${name}.js`,
        }),
      ),
    ),
  );

const extensions = async () =>
  await Promise.all(
    (await fs.readdir("src/extensions")).map((file) =>
      esbuild.build({
        entryPoints: [`src/extensions/${file}`],
        bundle: true,
        format: "esm",
        external: ["@codemirror", "@lezer"],
        outdir: "dist/extensions",
      }),
    ),
  );

const webview = async () =>
  await esbuild.build({
    entryPoints: ["src/webview.ts"],
    bundle: true,
    format: "esm",
    external: ["@codemirror", "@lezer"],
    outdir: "dist",
  });

const extension = async () =>
  await esbuild.build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    external: ["vscode"],
    outdir: "dist",
  });

await Promise.all([modules(), extensions(), webview(), extension()]);
