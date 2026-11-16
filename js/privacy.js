// プライバシーポリシーのページ（privacy.html）：アカウントのデータの削除（本文の言語の切り替えは legal.js）。
// 削除は js/cloud-sync.js の CloudSync.deleteAccount() を使う（ログイン中だけ）。
// 押し間違えを防ぐため、1回目で確認を出し、「削除する」をもう一度押したときに削除する（ブラウザの確認ダイアログは使わない）。
(function () {
  'use strict';
  const I = window.I18N;
  const $ = (id) => document.getElementById(id);

  let confirming = false;
  let busy = false;

  const button = (key, className, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-sm ' + className;
    I.set(b, key);
    b.disabled = busy;
    b.addEventListener('click', onClick);
    return b;
  };

  function setMessage(key, kind, params) {
    const m = $('deleteMessage');
    if (!key) {
      m.textContent = '';
      delete m.dataset.i18n;
      return;
    }
    m.className = `small mt-2 ${kind === 'error' ? 'text-danger' : 'text-success'}`;
    I.set(m, key, params);
  }

  function renderDelete() {
    const sync = window.CloudSync ? window.CloudSync.state() : null;
    const status = $('deleteStatus');
    const actions = $('deleteActions');
    actions.replaceChildren();
    if (!sync || !sync.known) {
      I.set(status, sync ? 'privacy.checking' : 'privacy.unavailable');
      return;
    }
    if (!sync.signedIn) {
      confirming = false;
      I.set(status, 'privacy.signInFirst');
      return;
    }
    if (!confirming) {
      I.set(status, 'privacy.signedInAs', { name: sync.name });
      actions.append(
        button('privacy.deleteButton', 'btn-outline-danger', () => {
          confirming = true;
          setMessage('');
          renderDelete();
        })
      );
      return;
    }
    I.set(status, 'privacy.confirm');
    actions.append(
      button('privacy.deleteConfirm', 'btn-danger', deleteNow),
      button('privacy.cancel', 'btn-outline-secondary', () => {
        confirming = false;
        renderDelete();
      })
    );
  }

  async function deleteNow() {
    busy = true;
    renderDelete();
    setMessage('privacy.deleting');
    try {
      await window.CloudSync.deleteAccount();
      confirming = false;
      setMessage('privacy.deleted');
    } catch (e) {
      const code = (e && (e.code || e.message)) || 'unknown';
      setMessage(code === 'auth/popup-closed-by-user' ? 'privacy.reauthCancelled' : 'privacy.failed', 'error', { code: code });
    } finally {
      busy = false;
      renderDelete();
    }
  }

  renderDelete();
  I.onChange(renderDelete);
  window.addEventListener('cloud-sync-change', renderDelete);
  // Firebase を使わない設定（firebase-config.js が null）や読み込みに失敗した場合
  setTimeout(() => {
    if (!window.CloudSync) renderDelete();
  }, 4000);
  if (location.hash === '#delete') $('delete').scrollIntoView();
})();
