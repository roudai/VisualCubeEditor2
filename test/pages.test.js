// 各ページ（html）と画面のスクリプトのつながりを確かめる：読み込むファイルがあるか、訳のキーがあるか、
// 移植元（Megaminx）固有の名前が残っていないか。
// 実行: node --test test/pages.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const PAGES = ['index.html', 'pll.html', 'oll.html', 'coll.html', 'zbll.html', 'practice.html', 'stats.html', 'guide.html', 'privacy.html', 'terms.html'];
const SCREEN_JS = ['cases.js', 'practice.js', 'stats.js', 'editor-cases.js', 'main.js', 'cube-draw.js', 'cloud-sync.js', 'privacy.js', 'navbar.js', 'legal.js'];

// js/i18n.js の DICT の en・ja それぞれのキー
function dictKeys() {
  const src = read('js/i18n.js');
  const en = src.indexOf('    en: {');
  const ja = src.indexOf('    ja: {');
  const end = src.indexOf('  function initialLang');
  assert.ok(en > 0 && ja > en && end > ja, 'i18n.js の形が変わった');
  const keys = (text) => new Set([...text.matchAll(/^\s*'([\w.]+)':/gm)].map((m) => m[1]));
  return { en: keys(src.slice(en, ja)), ja: keys(src.slice(ja, end)) };
}

const localRefs = (html) =>
  [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((ref) => !/^(https?:)?\/\//.test(ref));

test('各ページが読み込むスクリプト・スタイルシート・アイコンがある', () => {
  PAGES.forEach((page) => {
    const refs = localRefs(read(page));
    assert.ok(refs.length > 0, page);
    refs.forEach((ref) => assert.ok(fs.existsSync(path.join(ROOT, ref)), `${page}: ${ref} が無い`));
  });
});

test('ナビバーのリンク先のページがある', () => {
  PAGES.forEach((page) => {
    [...read(page).matchAll(/<a href="([\w-]+\.html)"/g)].forEach((m) => {
      assert.ok(fs.existsSync(path.join(ROOT, m[1])), `${page}: ${m[1]} が無い`);
    });
  });
});

test('訳のキー：英語と日本語で同じキーがそろっている', () => {
  const { en, ja } = dictKeys();
  assert.deepEqual([...en].filter((k) => !ja.has(k)), [], '日本語に無いキー');
  assert.deepEqual([...ja].filter((k) => !en.has(k)), [], '英語に無いキー');
});

test('訳のキー：html と画面のスクリプトで使うキーがある', () => {
  const { en } = dictKeys();
  const used = [];
  PAGES.forEach((page) => {
    const html = read(page);
    [...html.matchAll(/data-i18n(?:-title-page|-title|-placeholder|-aria-label)?="([\w.]+)"/g)].forEach((m) => used.push([page, m[1]]));
    // エディタの Vue の中：{{ t('key') }}、:title="t('key')" など
    [...html.matchAll(/\bt\('([\w.]+)'/g)].forEach((m) => used.push([page, m[1]]));
  });
  SCREEN_JS.forEach((file) => {
    const src = read('js/' + file);
    // 'practice.hint' のように「名前.名前」の形の文字列のうち、訳のキーの先頭（nav. editor. など）で始まるもの
    [...src.matchAll(/'((?:nav|common|title|editor|myAlg|parse|list|status|account|practice|stats|privacy)\.[\w.]*\w)'/g)]
      .filter((m) => !/\.html$/.test(m[1])) // 'privacy.html' のようなファイル名は除く
      .forEach((m) => used.push([file, m[1]]));
  });
  assert.ok(used.length > 150, `使っているキーが少なすぎる（${used.length}）`);
  const missing = used.filter(([, key]) => !en.has(key)).map(([file, key]) => `${file}: ${key}`);
  assert.deepEqual(missing, []);
});

test('画面のスクリプト・スタイル・ページに、移植元（Megaminx）固有の名前が残っていない', () => {
  const files = SCREEN_JS.map((f) => 'js/' + f)
    .concat(['css/common.css', 'css/cases.css', 'css/practice.css', 'css/stats.css'])
    .concat(PAGES.filter((p) => !['privacy.html', 'terms.html'].includes(p))); // 法的ページは Megaminx Image Editor の名前を文面に書く
  const patterns = [/megaminx-image-editor/, /MegaminxState|MegaminxDraw/, /megaminx-(state|draw)\.js/, /megaminx\(\)/, /megaminx-[\w$<{-]*\.(zip|csv|png)/, /\bND\b|No Dot|algset/];
  files.forEach((file) => {
    const src = read(file);
    patterns.forEach((re) => assert.ok(!re.test(src), `${file}: ${re} が残っている`));
  });
});

test('一覧・練習・記録のページは、描画に使うスクリプトを正しい順で読み込む', () => {
  const order = (page) => localRefs(read(page)).filter((r) => r.endsWith('.js'));
  ['pll.html', 'oll.html', 'practice.html', 'stats.html'].forEach((page) => {
    const list = order(page);
    const at = (name) => {
      const i = list.findIndex((r) => r.endsWith(name));
      assert.ok(i >= 0, `${page}: ${name} を読み込んでいない`);
      return i;
    };
    assert.ok(at('store.js') < at('i18n.js'), `${page}: store.js は i18n.js より先`);
    assert.ok(at('srVisualizer.min.js') < at('cube-draw.js'), page);
    assert.ok(at('cube-state.js') < at('case-check.js') && at('case-check.js') < at('custom-algs.js') && at('custom-algs.js') < at('progress.js'), page);
  });
  const practice = order('practice.html');
  assert.ok(practice.findIndex((r) => r.endsWith('cube-solver.js')) < practice.findIndex((r) => r.endsWith('wca-scramble.js')), 'cube-solver.js は wca-scramble.js より先');
  const editor = order('index.html');
  assert.ok(editor.findIndex((r) => r.endsWith('editor-cases.js')) < editor.findIndex((r) => r.endsWith('main.js')), 'editor-cases.js は main.js より先');
});

// ページの URL は .html を付けない（/、/pll など。公開先の GitHub Pages が pll.html を返す）
const PAGE_URLS = { '/': 'index.html', '/pll': 'pll.html', '/oll': 'oll.html', '/coll': 'coll.html', '/zbll': 'zbll.html', '/practice': 'practice.html', '/stats': 'stats.html', '/guide': 'guide.html', '/privacy': 'privacy.html', '/terms': 'terms.html' };

test('ページへのリンクに .html を付けない（/、/pll、/practice?… の形）', () => {
  const pageName = /\b(index|pll|oll|practice|stats|privacy|terms)\.html\b/;
  const found = [];
  PAGES.forEach((page) => {
    [...read(page).matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].forEach((m) => {
      if (pageName.test(m[1])) found.push(`${page}: ${m[1]}`);
    });
  });
  SCREEN_JS.forEach((file) => {
    // コメントを除いた行で、文字列の中にページのファイル名があるもの
    read('js/' + file)
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .forEach((line) => {
        const m = /['"`][^'"`]*\b(index|pll|oll|practice|stats|privacy|terms)\.html\b/.exec(line);
        if (m) found.push(`js/${file}: ${line.trim()}`);
      });
  });
  assert.deepEqual(found, []);
  // 使っているページの URL は、どれも実際のページになる
  const used = new Set();
  PAGES.forEach((page) => [...read(page).matchAll(/<a\b[^>]*\bhref="(\/[\w-]*)[?#"]/g)].forEach((m) => used.add(m[1])));
  assert.deepEqual([...used].filter((u) => !PAGE_URLS[u]), []);
  assert.ok(used.size >= 6, `ナビバーのリンクが見つからない（${[...used]}）`);
});

test('tools/serve.js：.html の無い URL でページを返し、リポジトリの外は返さない', () => {
  const { resolveFile } = require('../tools/serve.js');
  Object.entries(PAGE_URLS).forEach(([url, file]) => assert.equal(resolveFile(url), path.join(ROOT, file), url));
  assert.equal(resolveFile('/pll.html'), path.join(ROOT, 'pll.html')); // 古いリンク
  assert.equal(resolveFile('/js/navbar.js'), path.join(ROOT, 'js/navbar.js'));
  assert.equal(resolveFile('/data/pll/algs_info.json'), path.join(ROOT, 'data/pll/algs_info.json'));
  assert.equal(resolveFile('/nope'), null);
  assert.equal(resolveFile('/../PROGRESS.md'), null);
  assert.equal(resolveFile('/%2e%2e/PROGRESS.md'), null);
});

test('ルートにページと同じ名前のフォルダを置かない（GitHub Pages で /pll が pll/ フォルダの方を見てしまう）', () => {
  const clash = Object.keys(PAGE_URLS)
    .filter((u) => u !== '/')
    .map((u) => u.slice(1))
    .filter((name) => fs.existsSync(path.join(ROOT, name)));
  assert.deepEqual(clash, []);
});

test('覚える順の段階（PLL は U〜N、OLL は A〜M）には、どれも名前の訳（stage.<set>.<記号>）が英語・日本語ともある', () => {
  const CS = require('../js/case-sections.js');
  const { en, ja } = dictKeys();
  ['pll', 'oll'].forEach((set) => {
    const labels = CS.list(require(`../js/${set}-data.js`), true).map((s) => s.label);
    assert.equal(labels.length, 13, set);
    labels.forEach((l) => {
      assert.ok(en.has(`stage.${set}.${l}`), `en: stage.${set}.${l}`);
      assert.ok(ja.has(`stage.${set}.${l}`), `ja: stage.${set}.${l}`);
    });
  });
});
