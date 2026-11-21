// Firebase の設定値（ログインとクラウド保存に使う。js/cloud-sync.js が読む）。
// null にするとログインのボタンを出さず、今までどおりブラウザの中だけに保存する。
// 設定の手順: reference/CLOUD_SYNC_SPEC.md
// Firebase コンソール → プロジェクトの設定 → マイアプリ（ウェブ）に出る firebaseConfig をそのまま貼る。
// これらの値は公開してよい（データは firestore.rules で本人だけが読み書きできるようにしている）。
//
// 例:
// window.FIREBASE_CONFIG = {
//   apiKey: '...',
//   authDomain: '<project-id>.firebaseapp.com',
//   projectId: '<project-id>',
//   storageBucket: '<project-id>.appspot.com',
//   messagingSenderId: '...',
//   appId: '...',
// };
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA_BQiMR5LPxQGfPVatxUxQiU2liUFOfwA',
  authDomain: 'roudainet-cube-tools.firebaseapp.com',
  projectId: 'roudainet-cube-tools',
  storageBucket: 'roudainet-cube-tools.firebasestorage.app',
  messagingSenderId: '969154712169',
  appId: '1:969154712169:web:7e00c85d358f28856f88f8',
};
