// Serves the production build and proxies /api/* to the backend, so the app and the API share one
// origin. Needed behind a single tunnel or domain: the refresh cookie is sameSite=strict.
// Build first with: ng build --configuration production,same-origin
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = join(import.meta.dirname, '../dist/same-origin/browser');
const PORT = Number(process.env.PORT ?? 8080);
const API = new URL(process.env.API_URL ?? 'http://127.0.0.1:4000');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function proxyToApi(req, res) {
  const upstream = request(
    {
      host: API.hostname,
      port: API.port,
      method: req.method,
      path: req.url.slice('/api'.length),
      headers: { ...req.headers, host: API.host },
    },
    (apiRes) => {
      // The backend scopes the refresh cookie to /auth; from the browser's side that is /api/auth.
      const cookies = apiRes.headers['set-cookie']?.map((c) => c.replace(/Path=\//i, 'Path=/api/'));
      res.writeHead(apiRes.statusCode, { ...apiRes.headers, ...(cookies && { 'set-cookie': cookies }) });
      apiRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502).end('Backend unreachable');
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  let file;
  try {
    file = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  } catch {
    res.writeHead(400).end();
    return;
  }
  // Anything that is not a real file inside the build is an app route: fall back to index.html.
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    file = join(ROOT, 'index.html');
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    proxyToApi(req, res);
  } else {
    serveStatic(req, res);
  }
}).listen(PORT, () => {
  console.log(`StaffAway on http://localhost:${PORT} (API -> ${API.origin})`);
});
