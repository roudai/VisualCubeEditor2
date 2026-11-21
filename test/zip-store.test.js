// 実行: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('../js/zip-store.js');

const enc = new TextEncoder();
const dec = new TextDecoder();

// zip を読み、セントラルディレクトリから各ファイルの名前と中身を取り出す
function read(zip) {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50);
  const count = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);
  const files = [];
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50);
    const crc = dv.getUint32(p + 16, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const offset = dv.getUint32(p + 42, true);
    const name = dec.decode(zip.subarray(p + 46, p + 46 + nameLen));
    assert.equal(dv.getUint32(offset, true), 0x04034b50);
    const localNameLen = dv.getUint16(offset + 26, true);
    const data = zip.subarray(offset + 30 + localNameLen, offset + 30 + localNameLen + size);
    assert.equal(Z.crc32(data), crc);
    files.push({ name, data: dec.decode(data) });
    p += 46 + nameLen;
  }
  return files;
}

test('crc32 が標準の値になる', () => {
  assert.equal(Z.crc32(enc.encode('123456789')), 0xcbf43926);
  assert.equal(Z.crc32(new Uint8Array(0)), 0);
});

test('入れたファイルを名前・中身・順番どおりに取り出せる（UTF-8 の名前、空ファイルも可）', () => {
  const input = [
    { name: 'pll-A1+.png', data: 'hello' },
    { name: '日本語.txt', data: 'world!\n' },
    { name: 'empty', data: '' },
  ];
  const zip = Z.create(input.map((f) => ({ name: f.name, data: enc.encode(f.data) })), new Date(2026, 10, 14, 12, 0, 0));
  assert.deepEqual(read(zip), input);
});

test('ファイルが無くても空の zip になる', () => {
  const zip = Z.create([]);
  assert.equal(zip.length, 22);
  assert.deepEqual(read(zip), []);
});
