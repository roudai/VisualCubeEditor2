#!/usr/bin/env node
// ローカルで確かめるための配信（依存なし）。公開先（GitHub Pages）と同じく、.html の無い URL でページを返す。
//   node tools/serve.js [port]   → http://localhost:8000/ 、/pll 、/practice?set=oll など
// /pll → pll.html、/ → index.html。ファイルがあればそのまま返す。リポジトリの外は返さない。
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

/** URL のパス → 返すファイル（無ければ null）。/ → index.html、/pll → pll.html */
function resolveFile(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch (e) {
    return null;
  }
  const full = path.resolve(ROOT, '.' + rel);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  const candidates = rel.endsWith('/') ? [path.join(full, 'index.html')] : [full, full + '.html'];
  return candidates.find((f) => fs.existsSync(f) && fs.statSync(f).isFile()) || null;
}

function createServer() {
  return http.createServer((req, res) => {
    const file = resolveFile(new URL(req.url, 'http://localhost').pathname);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store', // 直したファイルがすぐ反映されるように
    });
    fs.createReadStream(file).pipe(res);
  });
}

module.exports = { resolveFile, createServer, ROOT };

if (require.main === module) {
  const port = Number(process.argv[2]) || 8000;
  createServer().listen(port, () => console.log(`http://localhost:${port}/`));
}
