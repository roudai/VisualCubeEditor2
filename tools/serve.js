#!/usr/bin/env node
// ローカルで確かめるための配信（依存なし）。公開先（GitHub Pages）と同じく、.html の無い URL でページを返す。
//   node tools/serve.js [port]   → http://localhost:8000/ 、/pll 、/practice?set=oll など
// /pll → pll.html、/ → index.html。ファイルがあればそのまま返す。リポジトリの外は返さない。
//
// テストデータで動かす：node tools/serve.js --demo [port]（既定 8001）→ http://localhost:8001/stats
//   - 練習の記録（PLL・OLL・COLL・ZBLL・通し）・最近のタイム・習得状況にテストデータ（tools/demo-data.js）を入れた状態で開く
//     （ページを開いたときにまだ入れていなければ入れる。/__demo/reset で入れ直す）
//   - ログインは使えなくする（js/firebase-config.js の代わりに FIREBASE_CONFIG = null を返す）。テストデータがアカウントに送られないように
//   - ポートを普段（8000）と分けるので、ブラウザの保存（localStorage）も普段のものとは別になる
//   - 画面の右下に「テストデータ」の印とリセットのリンクを出す。本番（GitHub Pages）には関係しない
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PREFIX = 'visualcube-editor:'; // js/store.js の Store.PREFIX
const DEMO_MARK = PREFIX + 'demo-seeded'; // テストデータを入れたか（store.js の名前ではないので保存の対象にならない）
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

// ---- テストデータ（--demo） ----
let demoCache = null; // 作るのに数秒かかる（通しのスクランブル）ので、起動して最初に使うときに1回だけ作る

// 各ページの <head> の最初に入れるスクリプト：まだ入れていなければテストデータを入れ、右下に印を出す
function demoScript(data) {
  if (!data && !demoCache) demoCache = require('./demo-data.js').build({ now: Date.now() });
  return `(function () {
  var P = ${JSON.stringify(PREFIX)}, MARK = ${JSON.stringify(DEMO_MARK)};
  try {
    if (!localStorage.getItem(MARK)) {
      var data = ${JSON.stringify(data || demoCache)};
      Object.keys(data).forEach(function (k) { localStorage.setItem(P + k, JSON.stringify(data[k])); });
      localStorage.setItem(MARK, String(Date.now()));
    }
  } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:9999;padding:4px 10px;border-radius:999px;background:#fff3cd;color:#664d03;border:1px solid #ffe69c;font:12px/1.4 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.1)';
    b.innerHTML = 'テストデータ（ログインなし） · <a href="/__demo/reset" style="color:inherit">入れ直す</a>';
    document.body.appendChild(b);
  });
})();
`;
}

// /__demo/reset：このサイトの保存をすべて消してから、テストデータを入れ直して記録のページを開く
const DEMO_RESET = `<!DOCTYPE html><meta charset="utf-8"><script>
try {
  Object.keys(localStorage).forEach(function (k) { if (k.indexOf(${JSON.stringify(PREFIX)}) === 0) localStorage.removeItem(k); });
} catch (e) {}
location.replace('/stats');
</script>`;

/** --demo のときだけ返すもの。返したら true */
function sendDemo(res, pathname, file, data) {
  const send = (type, body) => {
    res.writeHead(200, { 'Content-Type': TYPES[type], 'Cache-Control': 'no-store' });
    res.end(body);
    return true;
  };
  if (pathname === '/__demo/seed.js') return send('.js', demoScript(data));
  if (pathname === '/__demo/reset') return send('.html', DEMO_RESET);
  if (file && path.relative(ROOT, file) === path.join('js', 'firebase-config.js')) {
    return send('.js', 'window.FIREBASE_CONFIG = null; // node tools/serve.js --demo：ログインは使わない\n');
  }
  if (file && path.extname(file) === '.html') {
    return send('.html', fs.readFileSync(file, 'utf8').replace(/<head>/i, '<head>\n  <script src="/__demo/seed.js"></script>'));
  }
  return false;
}

/** options.demo: テストデータで動かす（上の説明）。options.demoData: 入れるデータ（テスト用。無ければ demo-data.js で作る） */
function createServer(options) {
  const demo = !!(options && options.demo);
  const demoData = options && options.demoData;
  return http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = resolveFile(pathname);
    if (demo && sendDemo(res, pathname, file, demoData)) return;
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

module.exports = { resolveFile, createServer, demoScript, ROOT, PREFIX };

if (require.main === module) {
  const args = process.argv.slice(2);
  const demo = args.includes('--demo');
  const port = Number(args.find((a) => /^\d+$/.test(a))) || (demo ? 8001 : 8000);
  createServer({ demo: demo }).listen(port, () => {
    console.log(`http://localhost:${port}/`);
    if (demo) console.log(`テストデータで動かしています（ログインなし）。記録のページ：http://localhost:${port}/stats　入れ直す：http://localhost:${port}/__demo/reset`);
  });
}
