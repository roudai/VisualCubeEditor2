// ナビバー（全ページ共通）：スマホの幅ではメニューのボタンで、言語の切り替えとページへのリンクを開く・閉じる。
// 広い画面では css/common.css で1行に並べるので、ここでは何もしない。i18n.js のあと、ほかのスクリプトより先に読み込む
(function () {
  'use strict';
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  if (!toggle || !menu) return;

  function setOpen(open) {
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!menu.classList.contains('open'));
  });
  // メニューの外を押す・Esc で閉じる
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('open') && !menu.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      setOpen(false);
      toggle.focus();
    }
  });
})();
