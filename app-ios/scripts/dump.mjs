// Despeja as elipses e textos do SVG do quadro para diagnostico.
import { spawn } from "node:child_process";
import { join } from "node:path";
import WebSocket from "ws";

const url = process.argv[2] || "http://localhost:8082";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9500 + Math.floor(Math.random() * 200);
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
  { stdio: "ignore" },
);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() {
  for (let i = 0; i < 40; i++) {
    try {
      return await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    } catch {
      await wait(250);
    }
  }
  throw new Error("chrome");
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
await evaluate(`(() => {
  const nodes = [...document.querySelectorAll('div,span')];
  const el = nodes.reverse().find((n) => n.childElementCount === 0 && (n.textContent || '').trim() === 'Ver a aula de exemplo');
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
})()`);
await wait(6000);
const dump = await evaluate(`(() => {
  const svg = document.querySelector('svg');
  const r = svg.getBoundingClientRect();
  return {
    box: [r.x, r.y, r.width, r.height],
    viewBox: svg.getAttribute('viewBox'),
    ellipses: [...svg.querySelectorAll('ellipse')].map((e) => ({
      cx: e.getAttribute('cx'), cy: e.getAttribute('cy'), rx: e.getAttribute('rx'), ry: e.getAttribute('ry'), fill: e.getAttribute('fill')
    })),
    texts: [...svg.querySelectorAll('text')].map((t) => t.textContent),
  };
})()`);
console.log(JSON.stringify(dump, null, 2));
ws.close();
proc.kill();
process.exit(0);
