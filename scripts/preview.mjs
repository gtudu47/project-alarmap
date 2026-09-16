// Prévisualisation locale des builds ; ne remplace pas Nginx/Compose.
import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.startsWith('/api/')) {
    const proxy = request({ hostname: '127.0.0.1', port: 3000, path: req.url, method: req.method, headers: req.headers }, (upstream) => {
      res.writeHead(upstream.statusCode ?? 502, upstream.headers); upstream.pipe(res);
    });
    proxy.on('error', () => { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"status":"unavailable"}'); });
    req.pipe(proxy); return;
  }
  const viewer = pathname.startsWith('/viewer/') || pathname.startsWith('/embed/');
  const directory = resolve(root, viewer ? 'viewer/browser' : 'editor/browser');
  let relative;
  try { relative = decodeURIComponent(pathname.replace(/^\/(viewer|embed)\//, '')); }
  catch { res.writeHead(400); res.end(); return; }
  const file = resolve(directory, relative.replace(/^\/+/, '') || 'index.html');
  if (!file.startsWith(directory + sep)) { res.writeHead(403); res.end(); return; }
  try {
    let content; let extension = extname(file);
    try { content = await readFile(file); }
    catch {
      if (extension) { res.writeHead(404); res.end(); return; }
      content = await readFile(resolve(directory, 'index.html')); extension = '.html';
    }
    res.writeHead(200, { 'Content-Type': mime[extension] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { res.writeHead(500); res.end('Build absent. Exécuter npm run build.'); }
});
server.listen(8080, '127.0.0.1', () => console.info('Prévisualisation locale : http://127.0.0.1:8080'));
