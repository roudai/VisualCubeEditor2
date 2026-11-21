// 3x3x3 の上面図（U 面 9 枚＋側面上段 12 枚）を描く（入力欄に依存しない描画だけ）。
// 一覧ページ（cases.js）・練習ページ（practice.js）・記録のページ（stats.js）で使う。
// 描画は library/srVisualizer.min.js の cubeSVG（Plan 表示）に任せるので、エディタの Plan 表示と同じ見た目になる。
//
//   CubeDraw.draw(container, ucolor, scolor, { size, border, background })
//     container（div など）の中身を、その画像の <svg> 1 つに入れ替える。size は表示する大きさ（px。既定 128）、
//     border はキューブの色（省略時は黒）、background は背景色（省略・null なら透明）
//   CubeDraw.pngBlob(ucolor, scolor, { size, border, background })
//     同じ画像を PNG にした Blob を返す Promise（一括ダウンロード用。SVG → Image → canvas）
//   CubeDraw.stickerColors(ucolor, scolor, fill)
//     srVisualizer に渡す 54 枚の色（上面図に出ない場所は fill）
//
// ucolor・scolor は js/cube-state.js の toImageColors の結果（色は #rrggbb）:
//   ucolor[0..8]   U 面（B を上にして左上から右へ・上から下へ）
//   scolor[0..11]  側面の上段を上から見て時計回りに（B → R → F → L。それぞれ U 面から見て左から右の逆順）
(function () {
  'use strict';

  const DEFAULT_SIZE = 128;
  // srVisualizer の並び（U, R, F, D, L, B の順に 9 枚ずつ）での各面の先頭
  const BASE = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
  // scolor の並び（cube-state.js の SIDE_RING と同じ）
  const SIDE_RING = [];
  ['B', 'R', 'F', 'L'].forEach((face) => {
    [2, 1, 0].forEach((col) => SIDE_RING.push(BASE[face] + col));
  });

  function stickerColors(ucolor, scolor, fill) {
    const out = new Array(54).fill(fill);
    ucolor.forEach((c, i) => {
      out[i] = c;
    });
    SIDE_RING.forEach((index, i) => {
      out[index] = scolor[i];
    });
    return out;
  }

  function draw(container, ucolor, scolor, options) {
    const opts = options || {};
    const size = opts.size || DEFAULT_SIZE;
    const border = opts.border || '#000000';
    const params = {
      view: 'plan',
      width: size,
      height: size,
      cubeColor: border,
      stickerColors: stickerColors(ucolor, scolor, border),
    };
    if (opts.background) params.backgroundColor = opts.background;
    container.replaceChildren();
    window['sr-visualizer'].cubeSVG(container, params);
    return container.querySelector('svg');
  }

  function pngBlob(ucolor, scolor, options) {
    const size = (options && options.size) || DEFAULT_SIZE;
    const svg = draw(document.createElement('div'), ucolor, scolor, options);
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(image, 0, 0, size, size);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image'))), 'image/png');
      };
      image.onerror = () => reject(new Error('Could not create the image'));
      image.src = 'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    });
  }

  window.CubeDraw = { draw: draw, pngBlob: pngBlob, stickerColors: stickerColors };
})();
