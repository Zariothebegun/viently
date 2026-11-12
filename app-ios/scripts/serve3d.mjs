// Servidor estático mínimo para ver as cenas 3D fora do telemóvel.
// Uso: node scripts/serve3d.mjs 8123
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const root = join(process.cwd(), ".preview");
const port = Number(process.argv[2] || 8123);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".png": "image/png" };

createServer((req, res) => {
  const name = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "cell.html";
  const file = join(root, name);
  if (!existsSync(file)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
}).listen(port, "127.0.0.1", () => console.log("http://127.0.0.1:" + port + "/"));
