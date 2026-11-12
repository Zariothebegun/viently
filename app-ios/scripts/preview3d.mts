/*
  Gera o HTML da cena 3D em .preview/ para se poder abrir num browser
  (ou fotografar com Chrome headless) e valida a sintaxe do módulo.
  Uso: npx tsx scripts/preview3d.mts
*/
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildModelHtml, MODELS, type ModelId } from "../src/three/scene";

const out = join(process.cwd(), ".preview");
mkdirSync(out, { recursive: true });

const ids = Object.keys(MODELS) as ModelId[];
for (const id of ids) {
  const html = buildModelHtml(id);
  const file = join(out, `${id}.html`);
  writeFileSync(file, html, "utf8");

  const mod = html.split('<script type="module">')[1].split("</script>")[0];
  const mjs = join(out, `${id}.mjs`);
  writeFileSync(mjs, mod, "utf8");
  try {
    execFileSync("node", ["--check", mjs], { stdio: "pipe" });
    console.log("ok  ", id, html.length, "bytes, sintaxe válida");
  } catch (e: any) {
    console.log("ERRO", id, String(e.stderr ?? e.message));
  }
}
