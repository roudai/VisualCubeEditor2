// プライバシーポリシー（privacy.html）・利用規約（terms.html）・使い方（guide.html）：本文は日本語・英語の両方を HTML に書いておき、
// 言語（i18n.js）に合わせて片方（data-lang-block="ja" / "en"）を出す
(function () {
  'use strict';
  const I = window.I18N;
  function showArticle() {
    document.querySelectorAll('[data-lang-block]').forEach((el) => {
      el.hidden = el.dataset.langBlock !== I.lang;
    });
  }
  showArticle();
  I.onChange(showArticle);
})();
