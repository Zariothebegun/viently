// Captura o app web em tamanho de iPhone e clica na aula de exemplo.
// Uso: node scripts/shot.mjs [url] [prefixo]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";

const url = process.argv[2] || "http://localhost:8082";
const prefix = process.argv[3] || "shot";
const out = join(process.cwd(), ".preview");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9333 + Math.floor(Math.random() * 200);

const proc = spawn(
  chrome,
  [
    "--headless=new",
    "--hide-scrollbars",
    "--disable-gpu",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(process.cwd(), ".preview", `chrome-${port}`)}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      return await res.json();
    } catch {
      await wait(250);
    }
  }
  throw new Error("chrome não respondeu");
}

const list = await targets();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.once("open", r));

let id = 0;
const pending = new Map();
ws.on("message", (raw) => {
  const msg = JSON.parse(String(raw));
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result?.value;
}

async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const file = join(out, `${prefix}-${name}.png`);
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log(file);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await send("Page.navigate", { url });
await wait(8000);
await shot("00");
const clicked = await evaluate(`(() => {
  const nodes = [...document.querySelectorAll('div,span')];
  const el = nodes.reverse().find((n) => n.childElementCount === 0 && (n.textContent || '').trim() === 'Ver a aula de exemplo');
  if (!el) return 'nao encontrado';
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return 'clicado';
})()`);
console.log("clique:", clicked);
await wait(4000);
await shot("01");
await wait(7000);
await shot("02");
await wait(8000);
await shot("03");
await wait(8000);
await shot("04");

// espera que a lição acabe e que os botões de recomendação apareçam
let finished = false;
for (let i = 0; i < 40; i++) {
  finished = await evaluate(
    `[...document.querySelectorAll('div,span')].some((n) => n.childElementCount === 0 && (n.textContent || '').trim() === 'Ver as fases ao pormenor')`,
  );
  if (finished) break;
  await wait(1500);
}
console.log("lição terminada:", finished);
await wait(600);
await shot("05");

// desce até ao fim para ver os botões
await evaluate(`(() => {
  const all = [...document.querySelectorAll('div')];
  const sc = all.find((d) => d.scrollHeight > d.clientHeight + 40);
  if (!sc) return 'sem scroll';
  sc.scrollTop = sc.scrollHeight;
  return sc.scrollTop + '/' + sc.scrollHeight;
})()`);
await wait(700);
await shot("06");

ws.close();
proc.kill();
process.exit(0);
