/*
 * 無圧縮（store）の zip を作る（DOM非依存）。PNG はすでに圧縮されているので圧縮しない。
 *
 *   ZipStore.create([{ name: 'a.png', data: Uint8Array }, ...], date?) → Uint8Array（zip ファイルの中身）
 *
 * ファイル名は UTF-8（汎用フラグ bit 11）。ZIP64 には対応しない（4GB・65535ファイルまで）。
 * ブラウザでは window.ZipStore、node では module.exports として公開する。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ZipStore = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
  }

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // MS-DOS 形式の日時（2秒単位、1980年以降）
  function dosDateTime(date) {
    const year = Math.max(date.getFullYear(), 1980);
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
  }

  const UTF8 = 0x0800;

  function create(files, date) {
    const dt = dosDateTime(date || new Date());
    const encoder = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;

    files.forEach((file) => {
      const name = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); // ローカルファイルヘッダ
      local.setUint16(4, 20, true); // 展開に必要なバージョン
      local.setUint16(6, UTF8, true);
      local.setUint16(8, 0, true); // 無圧縮
      local.setUint16(10, dt.time, true);
      local.setUint16(12, dt.date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true); // 圧縮後サイズ
      local.setUint32(22, data.length, true); // 元のサイズ
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true); // 拡張フィールド長
      locals.push(new Uint8Array(local.buffer), name, data);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true); // セントラルディレクトリ
      central.setUint16(4, 20, true); // 作成バージョン
      central.setUint16(6, 20, true); // 展開に必要なバージョン
      central.setUint16(8, UTF8, true);
      central.setUint16(10, 0, true);
      central.setUint16(12, dt.time, true);
      central.setUint16(14, dt.date, true);
      central.setUint32(16, crc, true);
      central.setUint32(20, data.length, true);
      central.setUint32(24, data.length, true);
      central.setUint16(28, name.length, true);
      // 30: 拡張フィールド長, 32: コメント長, 34: ディスク番号, 36: 内部属性, 38: 外部属性 = 0
      central.setUint32(42, offset, true); // ローカルヘッダの位置
      centrals.push(new Uint8Array(central.buffer), name);

      offset += 30 + name.length + data.length;
    });

    const centralSize = centrals.reduce((s, part) => s + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); // セントラルディレクトリの終端
    end.setUint16(8, files.length, true); // このディスクのエントリ数
    end.setUint16(10, files.length, true); // 全エントリ数
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true); // セントラルディレクトリの位置

    const parts = locals.concat(centrals, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(parts.reduce((s, part) => s + part.length, 0));
    let pos = 0;
    parts.forEach((part) => {
      out.set(part, pos);
      pos += part.length;
    });
    return out;
  }

  return { create: create, crc32: crc32 };
});
