// ログイン（Google / GitHub / Facebook）とクラウド保存（Firebase Authentication + Firestore）。
// 全ページ共通。<script type="module"> で、ほかのスクリプトのあとに読み込む。仕様: reference/CLOUD_SYNC_SPEC.md
//   - js/firebase-config.js の window.FIREBASE_CONFIG が null なら何もしない（ログインのボタンも出さない）
//   - Firestore の users/{uid}/apps/visualcube-editor の1文書に、store.js の snapshot を JSON 文字列で保存する（{ json, savedAt }）。
//     PLL・OLL・COLL・ZBLL の練習の記録（各最大 5000 件）は 1 文書に入らないので、短い形にして種類ごとの文書
//     users/{uid}/apps/visualcube-editor-log-pll・-log-oll・-log-coll・-log-zbll に分ける（Store.toCloud・fromCloud）。中身が変わった文書だけ書く。
//     ソルブ・LL の記録（それぞれ最大 5000 件）も -log-full・-log-ll に分ける（本体に fullSplit: true・llSplit: true）。
//     Firestore のルール（firestore.rules の logDoc）はこの 6 種類の名前だけを許すので、種類を増やしたらルールにも足して貼り直す
//     同じ Firebase プロジェクトのほかのアプリ（Megaminx Image Editor など）は users/{uid}/apps/<アプリ名> に保存し、ログインは共通
//   - 新しくログインしたとき：アカウントにデータがあれば、その内容で手元を上書きする（ログイン前にこのブラウザで使った分は捨てる。
//     合算はしない）。アカウントが空なら、手元の内容をアカウントに入れる（Store.resolveLogin）。
//     捨てた内容があれば、読み直したあとに画面の下に知らせる（NOTICE_KEY・toast）
//   - ログインしたままページを開いたとき：クラウドを読み → Store.merge で手元と合わせ（名前ごとに新しい方。練習の記録は両方）→ 両方に書く
//     （まだクラウドに書けていなかった手元の変更を失わないため）
//   - 「ログインしたまま」かは SESSION_KEY（ログイン中 'in'、ログアウトの状態が分かったら 'out'）と、
//     手元のデータがどのアカウントのものかを覚えた SYNCED_KEY で決める。手元の内容が変わったら、画面に反映するためにページを1回読み直す
//   - ログイン中は store-change を受けて、少しまとめてからクラウドに書く。ページを離れるときはすぐ書く。
//     書く前に本体を読み、同じアカウントの別の端末が書いていたら Store.merge で合わせてから書く（sync。練習の記録は両方を残す）
//   - ログアウトのボタンでは、まだクラウドに書いていない変更を書いてからログアウトし、このブラウザのデータを消す（言語だけ残す）。
//     書けなかったとき（オフライン・ログインの同期が済んでいない）はログアウトせずにメニューで知らせる（消すと失うため）。
//     同じブラウザのほかのタブには LOGOUT_KEY の storage イベントで伝え、読み直して空にする（古いデータを書き戻さないように）。
//     ログインの期限切れ・ほかのタブでのログアウトなど、ボタンを通らないログアウトでは消さない
//   - ログイン中はアイコンの右上に、ログインに使ったサービス（Google / GitHub）のロゴを小さく出す
//   - window.CloudSync：ほかのページ（privacy.html のデータ削除）から使う
//       CloudSync.state()        { available, known, signedIn, name }
//       CloudSync.deleteAccount({ clearLocal }) アカウントのデータ（users/{uid}/apps の全アプリの文書）とログインのアカウントを削除する。
//         clearLocal が true なら、このブラウザの保存（store.js の全データ。言語だけは残す）も消して最初の状態にする
//         （消さないと、もう一度ログインしたときに新しいアカウントとして手元のデータが入り、元に戻ったように見える）
//       ログイン状態が変わると window に 'cloud-sync-change' を通知する
const CONFIG = window.FIREBASE_CONFIG;
const Store = window.Store;
const I = window.I18N;
const box = document.getElementById('accountBox');

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const APP_ID = 'visualcube-editor'; // users/{uid}/apps/<APP_ID> に保存する
const SYNCED_KEY = 'visualcube-editor:synced-uid'; // この端末でクラウドと合わせたことのあるアカウント
const SESSION_KEY = 'visualcube-editor:session'; // 'in'：ログインしたまま / 'out'：ログアウトの状態だった（次のログインは新しいログイン） /
// 'kept'：保存できずにデータを残してログアウトした（次に同じアカウントで入ると合わせる）
const NOTICE_KEY = 'visualcube-editor:login-notice'; // 読み直したあとに知らせる文のキー（sessionStorage。ログイン前のデータを捨てた・ログアウトして消した）
const SYNC_RELOAD_KEY = 'visualcube-editor:sync-reload'; // 同期の内容を反映するために読み直す時刻（sessionStorage。練習のページが読み直す前の問題をそのまま出すのに使う。js/practice.js）
const LOGOUT_KEY = 'visualcube-editor:signed-out-at'; // ログアウトでこのブラウザのデータを消したこと（ほかのタブが storage イベントで読み直す）
const PUSH_DELAY = 1500;

const readLocal = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};
const writeLocal = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // 保存できなくても続ける
  }
};
const el = (tag, className) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
};

async function main() {
  if (!CONFIG || !box || !Store) return;
  // SDK は下で読み込む（その前に、前回ログインしていたアカウントのアイコンを先に出しておく）
  let authSdk = null;
  let dbSdk = null;
  let auth = null;
  let db = null;
  let authKnown = false; // ログイン状態が分かったか（分かるまではログインボタンを出さない）
  const providers = {
    google: () => new authSdk.GoogleAuthProvider(),
    github: () => new authSdk.GithubAuthProvider(),
    facebook: () => new authSdk.FacebookAuthProvider(),
  };

  // 前回ログインしていたアカウントの表示用の情報（ページを切り替えたときにボタンがちらつかないように、
  // ログイン状態が分かる前からアイコンを出しておく。ログアウトしたら消す）
  const HINT_KEY = 'visualcube-editor:account-hint';
  function readHint() {
    try {
      const h = JSON.parse(readLocal(HINT_KEY));
      return h && typeof h === 'object' ? h : null;
    } catch (e) {
      return null;
    }
  }
  function saveHint(u) {
    try {
      if (!u) localStorage.removeItem(HINT_KEY);
      else {
        const p = (u.providerData || []).find((d) => d.providerId) || {};
        writeLocal(HINT_KEY, JSON.stringify({ displayName: u.displayName, email: u.email, photoURL: u.photoURL, providerId: p.providerId }));
      }
    } catch (e) {
      // 保存できなくても続ける
    }
  }
  const hint = readHint();

  // pending: 前回の情報で仮に出しているあいだ（メニューは開かない）
  let user = hint
    ? { pending: true, displayName: hint.displayName, email: hint.email, photoURL: hint.photoURL, providerData: [{ providerId: hint.providerId }] }
    : null;
  let ready = false; // ログイン後の最初の合わせ込みが終わるまではクラウドに書かない
  let status = hint ? 'syncing' : 'synced'; // synced / syncing / error
  let message = null; // メニューに出す文 { key, params, ok }（ok: 成功の知らせ。無ければエラー）
  // 同じメールアドレスが別のログイン方法で登録済みだったときの、つなげる待ちの情報（メモリだけ。保存しない）
  //   { key: 新しい方法, credential: その資格情報, email }
  let linkPending = null;
  let errorCode = ''; // 保存に失敗したときの Firebase のエラーコード（メニューとコンソールに出す）
  let timer = null;

  const docRef = () => dbSdk.doc(db, 'users', user.uid, 'apps', APP_ID);
  const logRef = (set) => dbSdk.doc(db, 'users', user.uid, 'apps', APP_ID + '-log-' + set);
  const saveDoc = (ref, json) => dbSdk.setDoc(ref, { json: json, savedAt: dbSdk.serverTimestamp() });
  // 種類ごとの記録の文書に最後に書いた（読んだ）中身。変わっていなければ書かない（1 文書 十数万文字あるため）
  const lastLog = {};
  // 本体の文書に最後に書いた（読んだ）中身。書く前に読んで違っていたら、同じアカウントの別の端末が書いたので、合わせてから書く
  let lastMain = null;
  // 記録を種類ごとの文書に書いてから本体を書く（本体の logsSplit を見て、読むときに種類ごとの文書を使う）。
  // 種類ごとの文書に書けなかったら（Firestore のルールが古いなど）、記録を本体に入れた以前の形（PLL・OLL・COLL・ZBLL は合わせて、ソルブはそれぞれ最新 2000 件）で本体だけ書き、
  // そのエラーを返す（本体の保存はできているので、ほかの変更は失わない）
  async function write(snap) {
    const cloud = Store.toCloud(snap);
    try {
      for (const set of Store.LOG_SETS) {
        const json = JSON.stringify({ rows: cloud.logs[set] });
        if (lastLog[set] === json) continue;
        await saveDoc(logRef(set), json);
        lastLog[set] = json;
      }
    } catch (e) {
      const inline = JSON.stringify(cloud.inline);
      await saveDoc(docRef(), inline);
      lastMain = inline;
      return e;
    }
    const main = JSON.stringify(cloud.main);
    await saveDoc(docRef(), main);
    lastMain = main;
    return null;
  }
  // 本体を読み、記録を分けた形なら種類ごとの文書も読んで 1 つの snapshot に戻す（無ければ null）
  async function read() {
    Object.keys(lastLog).forEach((set) => delete lastLog[set]); // 別のアカウントで入り直したときに前の中身で比べない
    const got = await dbSdk.getDoc(docRef());
    lastMain = got.exists() ? got.data().json : null;
    if (!got.exists()) return null;
    let main;
    try {
      main = JSON.parse(got.data().json);
    } catch (e) {
      return null; // 壊れていれば手元の内容で上書きする
    }
    const logs = {};
    if (main && main.logsSplit) {
      // ソルブ・LL の記録の文書は、本体が分けた形（fullSplit・llSplit）のときだけ読む
      for (const set of Store.LOG_SETS.filter((x) => (x !== 'full' || main.fullSplit) && (x !== 'll' || main.llSplit))) {
        const doc = await dbSdk.getDoc(logRef(set));
        if (!doc.exists()) continue;
        try {
          const json = doc.data().json;
          logs[set] = JSON.parse(json).rows;
          lastLog[set] = json;
        } catch (e) {
          // 壊れていればその種類の記録は無いものとして、次に書くときに書き直す
        }
      }
    }
    return Store.fromCloud(main, logs);
  }

  // 手元をクラウドに書く。書く前に本体を読み、最後に書いた（読んだ）ものと違えば、同じアカウントの別の端末が書いているので、
  // クラウドを読んで手元と合わせてから（Store.merge。練習の記録は両方、設定などは新しい方）書く（別の端末の記録を上書きしないように）
  // 同時に 2 つ走らないように順番に（ページを離れるときの書き込みと、まとめて書く書き込みが重なったときなど）
  let queue = Promise.resolve();
  function sync() {
    const run = queue.then(syncOnce, syncOnce);
    queue = run.catch(() => {});
    return run;
  }
  async function syncOnce() {
    // 手元が言語だけなら書かない。ログイン中にそうなるのは、ほかのタブでログアウトしてデータを消した直後だけ
    // （習得状況を全部戻しても、記録を全部消しても名前は残る）。そのままアカウントを空で上書きしないように
    if (!Object.keys(Store.snapshot().data).some((name) => name !== 'lang')) return null;
    const got = await dbSdk.getDoc(docRef());
    const now = got.exists() ? got.data().json : null;
    let snap = Store.snapshot();
    if (now !== lastMain) {
      const remote = await read();
      // 読んでいるあいだの手元の変更も入れるため、読み終えてから手元を取り直して合わせる（ここから書き換えまで await しない）
      snap = Store.merge(Store.snapshot(), remote);
      if (JSON.stringify(snap.data) !== JSON.stringify(Store.snapshot().data)) Store.replace(snap);
    }
    return write(snap);
  }

  async function push() {
    timer = null;
    if (!user || !ready) return;
    setStatus('syncing');
    try {
      const partial = await sync();
      if (partial) fail(partial);
      else setStatus('synced');
    } catch (e) {
      fail(e);
    }
  }
  const schedule = () => {
    if (!user || !ready) return;
    clearTimeout(timer);
    timer = setTimeout(push, PUSH_DELAY);
  };
  window.addEventListener('store-change', schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer);
      push();
    }
  });

  // ログインの同期。できたら true、失敗したら false（ready は false のまま）。
  // options.reload が false なら、手元が変わっても読み直さない（ログアウトの前のやり直し）
  let loginSyncing = false;
  async function syncOnLogin(options) {
    const reload = !options || options.reload !== false;
    const me = user;
    loginSyncing = true;
    setStatus('syncing');
    try {
      const remote = await read();
      if (user !== me) return false; // 読んでいるあいだにログアウトした
      const local = Store.snapshot();
      // 新しいログインなら、アカウントの内容で上書きする（アカウントが空なら手元を入れる）。store.js の resolveLogin
      const who = { owner: readLocal(SYNCED_KEY), uid: user.uid, fresh: readLocal(SESSION_KEY) === 'out' };
      const merged = Store.resolveLogin(local, remote, who);
      const discarded = Store.discardsLocal(local, remote, who);
      const localChanged = JSON.stringify(merged.data) !== JSON.stringify(local.data);
      if (localChanged) Store.replace(merged);
      const partial = JSON.stringify(merged) !== JSON.stringify(remote) ? await write(merged) : null;
      writeLocal(SYNCED_KEY, user.uid);
      writeLocal(SESSION_KEY, 'in');
      ready = true;
      if (partial) fail(partial);
      else setStatus('synced');
      if (discarded) setNotice('account.localReplaced');
      if (!localChanged || !reload) showNotice();
      if (localChanged && reload) {
        if (signInDone) await signInDone; // ログインの処理（Facebook の写真の保存）が終わってから
        try {
          sessionStorage.setItem(SYNC_RELOAD_KEY, String(Date.now()));
        } catch (e) {
          // 印を残せなくても読み直す（練習のページは新しい問題になるだけ）
        }
        location.reload(); // クラウドの内容を画面に反映する
      }
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      loginSyncing = false;
    }
  }

  // 読み直したあとのページで、メニューを開いて 1 回だけ知らせる（ログイン前のデータを捨てた・ログアウトしてデータを消した）
  function setNotice(key) {
    try {
      sessionStorage.setItem(NOTICE_KEY, key);
    } catch (e) {
      // 知らせを出せなくても続ける
    }
  }
  function showNotice() {
    let key = null;
    try {
      key = sessionStorage.getItem(NOTICE_KEY);
      sessionStorage.removeItem(NOTICE_KEY);
    } catch (e) {
      key = null;
    }
    if (key !== 'account.localReplaced' && key !== 'account.signedOutCleared') return;
    toast(key);
  }
  // 画面の下の知らせ（css/common.css の .site-toast。移植元の練習ページのバッジの知らせと同じ形）。× か 10 秒で閉じる
  function toast(key) {
    let box = document.getElementById('siteToast');
    if (!box) {
      box = el('div', 'site-toast');
      box.id = 'siteToast';
      box.setAttribute('role', 'status');
      document.body.append(box);
    }
    const text = el('div', 'site-toast-text');
    I.set(text, key);
    const close = el('button', 'site-toast-close');
    close.type = 'button';
    close.textContent = '×';
    I.set(close, 'account.toastClose', null, 'aria-label');
    const hide = () => {
      box.classList.remove('show');
      if (box.contains(document.activeElement)) document.activeElement.blur();
    };
    close.addEventListener('click', hide);
    box.replaceChildren(close, text);
    requestAnimationFrame(() => box.classList.add('show'));
    clearTimeout(box.hideTimer);
    box.hideTimer = setTimeout(hide, 10000);
  }

  function fail(e) {
    errorCode = (e && (e.code || e.message)) || 'unknown';
    console.warn('[cloud-sync] could not save to the account:', e);
    setStatus('error');
  }

  // ログアウト：まだクラウドに書いていない変更を書いてからログアウトし、このブラウザのデータを消す（言語だけ残す）。
  // 書けなかったら（オフライン）ログアウトせずに知らせる（消すと失うため）。ログインの同期の途中も同じ。
  // ページを開いたときの同期が失敗していたら、まずやり直す。やり直しても失敗したら（原因が続くもの。上限を超えた文書など）、
  // ログアウトはするが、このブラウザのデータは消さずに残す（SESSION_KEY を 'kept'。次に同じアカウントで入ると合わせる）
  let signingOut = false;
  const withTimeout = (p) =>
    Promise.race([p, new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 15000))]);
  async function signOutNow() {
    if (signingOut) return;
    message = null;
    clearTimeout(timer);
    timer = null;
    if (loginSyncing) {
      // ログインの同期の途中：終わってからもう一度押してもらう
      message = { key: 'account.signOutFailed' };
      render();
      return;
    }
    signingOut = true;
    if (!ready) {
      let ok = false;
      try {
        ok = await withTimeout(syncOnLogin({ reload: false }));
      } catch (e) {
        ok = false; // 15 秒で返ってこない（オフラインなど）
      }
      if (!ok) {
        ready = false;
        writeLocal(SESSION_KEY, 'kept'); // onAuthStateChanged(null) より先に（'out' にしないように）
        await authSdk.signOut(auth);
        signingOut = false;
        toast('account.signedOutKept');
        return;
      }
    }
    setStatus('syncing');
    try {
      // 記録を分けて書けないとき（ルールが古い）は本体だけに書けていれば続ける。
      // オフラインだと Firestore の書き込みは返ってこないので、15 秒で書けなかったことにする
      await withTimeout(sync());
    } catch (e) {
      signingOut = false;
      fail(e);
      message = { key: 'account.signOutFailed' };
      render();
      return;
    }
    ready = false; // ここから先はクラウドに書かない
    await authSdk.signOut(auth);
    const lang = Store.get('lang');
    Store.replace(lang === null ? { data: {}, updated: {} } : { data: { lang: lang }, updated: { lang: Date.now() } });
    writeLocal(LOGOUT_KEY, String(Date.now())); // ほかのタブに伝える
    setNotice('account.signedOutCleared');
    location.reload(); // 画面に残っているデータも消す
  }
  // ほかのタブでログアウトしてデータを消したら、このタブも読み直す（画面のデータを書き戻さないように）
  window.addEventListener('storage', (e) => {
    if (e.key === LOGOUT_KEY && e.newValue) {
      ready = false; // 読み直すまでのあいだに、空になった手元をクラウドに書かないように
      clearTimeout(timer);
      timer = null;
      location.reload();
    }
  });

  // ログインのポップアップが開けない・この環境ではログインできないときのエラー。アプリの中のブラウザ（独自の WebView）で起きるので、
  // 「Chrome や Safari で開いてください」の案内と URL をコピーするボタンを出す（端末の判定はしない。Android の X のアプリは中身が Chrome で
  // ログインできるため、最初から案内は出さず、失敗したときだけ）
  const IN_APP_ERRORS = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'];

  // ログインの処理（Facebook の写真の取得まで）が終わるまでの Promise。
  // ログインの直後にクラウドの内容でページを読み直すときは、これを待つ（途中で読み直すと写真が保存されないため）
  let signInDone = null;

  // 新しい方法で入ろうとして、同じメールアドレスが別の方法で登録済みだったら（Firebase の「同じメールアドレスを使用する
  // アカウントをリンク」）、新しい方法の資格情報を覚えておき、前に使った方法を本人に選んでもらう
  // （メールの列挙対策で、どの方法で登録したかは調べられない）。前の方法でログインできたら、新しい方法をつなげる
  async function signIn(key) {
    message = null;
    const linking = linkPending && linkPending.key !== key ? linkPending : null;
    let finish;
    signInDone = new Promise((resolve) => {
      finish = resolve;
    });
    try {
      const result = await authSdk.signInWithPopup(auth, providers[key]());
      if (linking) {
        linkPending = null;
        await linkTo(result.user, linking);
      } else {
        linkPending = null;
      }
      if (key === 'facebook') await refreshFacebookPhoto(result);
    } catch (e) {
      if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return;
      if (e && e.code === 'auth/account-exists-with-different-credential') {
        const credential = PROVIDER_CLASS[key]().credentialFromError(e);
        const email = e.customData && e.customData.email;
        linkPending = credential && email ? { key: key, credential: credential, email: email } : null;
        message = linkPending ? null : { key: 'account.signInFailed' };
      } else if (e && IN_APP_ERRORS.includes(e.code)) {
        message = { key: 'account.openInBrowser', copyUrl: true };
      } else {
        message = { key: 'account.signInFailed' };
      }
      menuOpen = true; // メニューの中に案内・エラーを出す
      render();
    } finally {
      finish();
      signInDone = null;
    }
  }

  // 前の方法でログインした user に、覚えておいた新しい方法をつなげる。メールアドレスが違えばつなげない
  async function linkTo(current, linking) {
    const name = PROVIDER_NAMES[linking.key];
    if ((current.email || '').toLowerCase() !== linking.email.toLowerCase()) {
      message = { key: 'account.linkOtherEmail' };
    } else {
      try {
        await authSdk.linkWithCredential(current, linking.credential);
        user = auth.currentUser;
        message = { key: 'account.linked', params: { provider: name }, ok: true };
      } catch (e) {
        console.warn('[cloud-sync] could not link the sign-in method:', e);
        message = { key: 'account.linkFailed', params: { provider: name } };
      }
    }
    menuOpen = true;
    render();
  }

  // Facebook のプロフィール写真：Firebase が受け取る写真の URL（graph.facebook.com/<id>/picture）は、
  // アクセストークンが無いと Facebook の既定の人型の画像になる。ログインした直後だけ手に入るトークンで
  // 本人の写真の URL を Graph API から受け取り、Firebase のプロフィールに保存しておく（トークンは保存しない）。
  // この URL は Facebook 側でいずれ期限が切れるので、読めなくなったら頭文字の丸にする（次に Facebook でログインしたときに更新）
  async function refreshFacebookPhoto(result) {
    try {
      const credential = authSdk.FacebookAuthProvider.credentialFromResult(result);
      const token = credential && credential.accessToken;
      if (!token) return;
      const res = await fetch(
        'https://graph.facebook.com/me/picture?type=large&redirect=false&access_token=' + encodeURIComponent(token)
      );
      const json = await res.json();
      const picture = json && json.data;
      if (!picture || !picture.url || picture.is_silhouette) return;
      await authSdk.updateProfile(result.user, { photoURL: picture.url });
      user = auth.currentUser;
      saveHint(user);
      render();
    } catch (e) {
      // 写真が取れなくてもログインはそのまま
    }
  }

  function setStatus(next) {
    status = next;
    render();
  }

  // ---- ナビバーの表示 ----
  // ログイン前：人のアイコン付きの丸いボタン → Google / GitHub のロゴ付きのメニュー
  // ログイン中：アイコン（写真か頭文字）だけを出し、右下の小さな点で保存の状態を示す → 押すと名前・状態・ログアウトのメニュー
  let menuOpen = false;
  const svg = (markup) => {
    const span = el('span', 'account-icon');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = markup;
    return span;
  };
  const ICON_PERSON =
    '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="5.2" r="2.9" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
    '<path d="M2.6 14c.6-2.9 2.8-4.4 5.4-4.4s4.8 1.5 5.4 4.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const ICON_GOOGLE =
    '<svg viewBox="0 0 18 18" width="16" height="16"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>' +
    '<path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>' +
    '<path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/>' +
    '<path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';
  const ICON_GITHUB =
    '<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';
  const ICON_FACEBOOK =
    '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="12" fill="#1877F2"/>' +
    '<path fill="#fff" d="M16.67 15.47 17.2 12h-3.33V9.75c0-.95.47-1.88 1.95-1.88h1.51V4.92s-1.37-.23-2.68-.23c-2.74 0-4.53 1.66-4.53 4.66V12H7.08v3.47h3.04V24a12.1 12.1 0 0 0 3.75 0v-8.53h2.8z"/></svg>';

  // ログインに使ったサービス（Google / GitHub）
  const PROVIDERS = {
    'google.com': { name: 'Google', icon: ICON_GOOGLE },
    'github.com': { name: 'GitHub', icon: ICON_GITHUB },
    'facebook.com': { name: 'Facebook', icon: ICON_FACEBOOK },
  };
  const PROVIDER_NAMES = { google: 'Google', github: 'GitHub', facebook: 'Facebook' };
  const PROVIDER_CLASS = {
    google: () => authSdk.GoogleAuthProvider,
    github: () => authSdk.GithubAuthProvider,
    facebook: () => authSdk.FacebookAuthProvider,
  };
  function providerOf(u) {
    const p = (u.providerData || []).find((d) => PROVIDERS[d.providerId]);
    return p ? PROVIDERS[p.providerId] : null;
  }

  // 写真が無ければ名前の頭文字の丸
  function avatar(size) {
    const wrap = el('span', 'account-avatar');
    wrap.style.width = wrap.style.height = size + 'px';
    const initial = () => {
      wrap.replaceChildren();
      wrap.textContent = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
      wrap.style.fontSize = Math.round(size * 0.45) + 'px';
    };
    // Facebook の graph.facebook.com の URL はトークン無しでは既定の人型になるので使わない（refreshFacebookPhoto）
    const usable = user.photoURL && !/^https:\/\/graph\.facebook\.com\//.test(user.photoURL);
    if (usable) {
      const img = el('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', initial); // 期限切れなどで読めなければ頭文字
      img.src = user.photoURL;
      wrap.append(img);
    } else {
      initial();
    }
    return wrap;
  }

  function toggle(e) {
    e.stopPropagation();
    if (user && user.pending) return; // ログイン状態が分かるまではメニューを開かない
    if (menuOpen) closeMenu();
    else {
      menuOpen = true;
      render();
    }
  }

  // メニューを閉じたら、案内・エラーとつなげる待ちも捨てる
  function closeMenu() {
    menuOpen = false;
    message = null;
    linkPending = null;
    render();
  }

  function messageBox() {
    const m = el('div', 'account-menu-message' + (message.ok ? ' ok' : ''));
    I.set(m, message.key, message.params);
    if (!message.copyUrl) return m;
    // ページの URL をコピーするボタン（Chrome や Safari に貼って開けるように）。コピーできない環境では、URL を選んだ状態の欄を出す
    // （押したボタンは消さない。消すとメニューの外を押したことになって閉じるため）
    const wrap = el('div', 'account-menu-copy');
    const button = el('button', 'btn btn-sm btn-outline-secondary');
    button.type = 'button';
    I.set(button, 'account.copyUrl');
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        I.set(button, 'account.urlCopied');
      } catch (e) {
        let field = wrap.querySelector('input');
        if (!field) {
          field = el('input', 'form-control form-control-sm account-url-field'); // タッチの端末では 16px（css/common.css）
          field.readOnly = true;
          field.value = location.href;
          I.set(field, 'account.copyUrl', null, 'aria-label');
          wrap.append(field);
        }
        field.focus();
        field.select();
      }
    });
    wrap.append(button);
    const box = el('div');
    box.append(m, wrap);
    return box;
  }

  function menuItem(icon, labelKey, onClick, className) {
    const b = el('button', 'account-menu-item' + (className ? ' ' + className : ''));
    b.type = 'button';
    if (icon) b.append(svg(icon));
    const label = el('span');
    I.set(label, labelKey);
    b.append(label);
    b.addEventListener('click', () => {
      menuOpen = false;
      render();
      onClick();
    });
    return b;
  }

  function render() {
    window.dispatchEvent(new CustomEvent('cloud-sync-change'));
    box.replaceChildren();
    box.className = 'account-box';
    if (!user && !authKnown) return; // ログイン状態が分かるまでは何も出さない（ログインボタンが一瞬出ないように）
    const menu = el('div', 'account-menu');
    menu.hidden = !menuOpen;

    if (!user) {
      const button = el('button', 'account-signin');
      button.type = 'button';
      button.setAttribute('aria-expanded', String(menuOpen));
      button.setAttribute('aria-haspopup', 'true');
      const label = el('span');
      I.set(label, 'account.signIn');
      button.append(svg(ICON_PERSON), label);
      button.addEventListener('click', toggle);
      if (linkPending) {
        // 前に使った方法を選んでもらう（新しい方法のボタンは出さない）
        const note = el('div', 'account-menu-note');
        I.set(note, 'account.linkPrompt', { email: linkPending.email, provider: PROVIDER_NAMES[linkPending.key] });
        menu.append(note);
      }
      // よく使われる順（GitHub は主に開発者向けなので最後）
      [
        ['google', ICON_GOOGLE, 'account.withGoogle'],
        ['facebook', ICON_FACEBOOK, 'account.withFacebook'],
        ['github', ICON_GITHUB, 'account.withGithub'],
      ]
        .filter(([key]) => !linkPending || key !== linkPending.key)
        .forEach(([key, icon, label]) => menu.append(menuItem(icon, label, () => signIn(key))));
      menu.append(
        el('div', 'account-menu-divider'),
        menuItem(null, 'account.guide', () => {
          location.href = '/guide';
        }, 'muted'),
        menuItem(null, 'account.privacyPolicy', () => {
          location.href = '/privacy';
        }, 'muted'),
        menuItem(null, 'account.terms', () => {
          location.href = '/terms';
        }, 'muted')
      );
      if (message) menu.append(messageBox());
      box.append(button, menu);
      return;
    }

    const button = el('button', 'account-avatar-button');
    button.type = 'button';
    button.setAttribute('aria-expanded', String(menuOpen));
    button.setAttribute('aria-haspopup', 'true');
    I.set(button, 'account.menuLabel', { name: user.displayName || user.email || '' }, 'aria-label');
    const dot = el('span', `sync-dot ${status}`);
    const provider = providerOf(user);
    // マウスを乗せると「Google でログイン中 · アカウントに保存済み」のように出す
    button.title = (provider ? I.t('account.via', { provider: provider.name }) + ' · ' : '') + I.t('account.' + status);
    button.append(avatar(26), dot);
    if (provider) {
      const mark = svg(provider.icon);
      mark.classList.add('account-provider-badge');
      button.append(mark);
    }
    button.addEventListener('click', toggle);

    const head = el('div', 'account-menu-head');
    const who = el('div', 'account-menu-who');
    const name = el('div', 'account-menu-name');
    name.textContent = user.displayName || '';
    const email = el('div', 'account-menu-email');
    email.textContent = user.email || '';
    who.append(name, email);
    if (provider) {
      const via = el('div', 'account-menu-via');
      const text = el('span');
      I.set(text, 'account.via', { provider: provider.name });
      via.append(svg(provider.icon), text);
      who.append(via);
    }
    head.append(avatar(36), who);
    const state = el('div', 'account-menu-status');
    const stateText = el('span');
    I.set(stateText, 'account.' + status);
    state.append(el('span', `sync-dot inline ${status}`), stateText);
    if (status === 'error' && errorCode) {
      const code = el('span', 'account-menu-code');
      code.textContent = errorCode.replace(/^firestore\//, '');
      state.append(code);
    }
    menu.append(head, state);
    if (message) menu.append(messageBox());
    menu.append(
      el('div', 'account-menu-divider'),
      menuItem(null, 'account.guide', () => {
        location.href = '/guide';
      }, 'muted'),
      menuItem(null, 'account.privacyPolicy', () => {
        location.href = '/privacy';
      }, 'muted'),
      menuItem(null, 'account.terms', () => {
        location.href = '/terms';
      }, 'muted'),
      menuItem(null, 'account.signOut', signOutNow, 'signout')
    );
    box.append(button, menu);
  }
  document.addEventListener('click', (e) => {
    if (menuOpen && !box.contains(e.target)) closeMenu();
  });
  I.onChange(() => render()); // 言語を切り替えたらツールチップなども作り直す
  document.addEventListener('keydown', (e) => {
    if (menuOpen && e.key === 'Escape') closeMenu();
  });

  // ---- アカウントのデータの削除（privacy.html から使う）----
  const PROVIDER_KEYS = { 'google.com': 'google', 'github.com': 'github', 'facebook.com': 'facebook' };
  async function deleteAccount(options) {
    const clearLocal = !!(options && options.clearLocal);
    const current = auth && auth.currentUser;
    if (!current) throw new Error('not signed in');
    ready = false; // 削除中・削除後にクラウドへ書き戻さない
    clearTimeout(timer);
    timer = null;
    // 同じアカウントで使っているアプリの保存先（users/{uid}/apps の下）をすべて消す
    const docs = await dbSdk.getDocs(dbSdk.collection(db, 'users', current.uid, 'apps'));
    await Promise.all(docs.docs.map((d) => dbSdk.deleteDoc(d.ref)));
    // ログインのアカウントを消す（しばらく前にログインした場合は、もう一度ログインしてもらってから）
    try {
      await authSdk.deleteUser(current);
    } catch (e) {
      if (!e || e.code !== 'auth/requires-recent-login') throw e;
      const p = (current.providerData || []).map((d) => PROVIDER_KEYS[d.providerId]).find(Boolean);
      await authSdk.reauthenticateWithPopup(current, providers[p || 'google']());
      await authSdk.deleteUser(current);
    }
    try {
      localStorage.removeItem(SYNCED_KEY);
    } catch (e) {
      // 消せなくても続ける
    }
    saveHint(null);
    // このブラウザのデータも消す（言語の選択だけは残す。表示が急に変わらないように）
    if (clearLocal) {
      const lang = Store.get('lang');
      Store.replace(lang === null ? { data: {}, updated: {} } : { data: { lang: lang }, updated: { lang: Date.now() } });
    }
  }
  window.CloudSync = {
    state: () => ({
      available: true,
      known: authKnown,
      signedIn: !!(user && !user.pending),
      name: user ? user.displayName || user.email || '' : '',
    }),
    deleteAccount: deleteAccount,
  };

  render(); // 前回ログインしていたならアイコンを先に出す

  const [appSdk, authModule, dbModule] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  authSdk = authModule;
  dbSdk = dbModule;
  const app = appSdk.initializeApp(CONFIG);
  auth = authSdk.getAuth(app);
  db = dbSdk.getFirestore(app);

  authSdk.onAuthStateChanged(auth, (next) => {
    authKnown = true;
    user = next;
    ready = false;
    saveHint(next);
    // ログアウトの状態なら、次のログインは新しいログイン（アカウントの内容で上書きする）。
    // 保存できずにデータを残してログアウトしたとき（'kept'）は、次に同じアカウントでログインしたときに合わせるので変えない
    if (!next && readLocal(SESSION_KEY) !== 'kept') writeLocal(SESSION_KEY, 'out');
    render();
    if (!next) showNotice(); // ログアウトしてデータを消したあとの知らせ
    if (user) syncOnLogin();
  });
}

main().catch(() => {
  // 読み込めなければ（オフラインなど）ログインのボタンを出さずに今までどおり動く
  if (box) box.replaceChildren();
});
