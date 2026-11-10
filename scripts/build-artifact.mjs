// Gera dist/finance-os.html: a versão do Finance OS publicada como página privada
// no claude.ai (dados no banco privado da página, consultor via Claude da conta).
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const r = (p) => path.join(root, p);

const ALIASES = {
  "next/link": r("src/artifact/shims/next-link.tsx"),
  "next/navigation": r("src/artifact/shims/next-navigation.ts"),
  "server-only": r("src/artifact/shims/empty.ts"),
  "@/app/actions": r("src/artifact/actions-shim.ts"),
  "@/lib/data": r("src/artifact/data-shim.ts"),
  "@/components/chat": r("src/artifact/chat.tsx"),
  "@/components/print-button": r("src/artifact/shims/empty.ts"),
  "@/lib/supabase/server": r("src/artifact/shims/empty.ts"),
};

const aliasPlugin = {
  name: "finance-os-aliases",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => (ALIASES[args.path] ? { path: ALIASES[args.path] } : undefined));
  },
};

const result = await build({
  entryPoints: [r("src/artifact/main.tsx")],
  bundle: true, minify: true, write: false, format: "iife", target: "es2020",
  jsx: "automatic", platform: "browser", legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  tsconfig: r("tsconfig.json"),
  plugins: [aliasPlugin],
  logLevel: "warning",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

mkdirSync(r("dist"), { recursive: true });
execFileSync(process.execPath, [r("node_modules/@tailwindcss/cli/dist/index.mjs"), "-i", r("src/artifact/artifact.css"), "-o", r("dist/artifact.css"), "--minify"], { stdio: "inherit" });
const css = readFileSync(r("dist/artifact.css"), "utf8");

const html = `<title>Finance OS</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script>${js}</script>
`;
writeFileSync(r("dist/finance-os.html"), html);

// Versão para o GitHub Pages: documento completo (o claude.ai adiciona o esqueleto sozinho; aqui não).
const page = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0c0e11"><style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
${html}</head-placeholder>`.replace("</head-placeholder>", "");
writeFileSync(r("index.html"), page.replace('<div id="root"></div>', '</head><body><div id="root"></div>') + "</body></html>\n");
console.log(`dist/finance-os.html — ${(html.length / 1024).toFixed(0)} KiB`);
