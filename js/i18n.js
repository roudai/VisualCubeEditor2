/*
 * 日本語・英語の切り替え（全ページ共通）。
 *
 *   I18N.lang                    今の言語（'en' / 'ja'）
 *   I18N.t(key, params)          訳した文（{name} のような部分を params で埋める）
 *   I18N.set(el, key, params, attr)
 *                                el に訳した文を入れ、言語を切り替えたときに入れ直せるよう data-i18n* に覚えておく
 *                                attr: 'text'（既定）/ 'title' / 'placeholder' / 'aria-label'
 *   I18N.setLang(lang)           言語を変えて画面全体を入れ直し、onChange の関数を呼ぶ
 *   I18N.onChange(fn)            言語を変えたときに呼ぶ関数を登録する（件数など毎回作る文の作り直し用）
 *   I18N.error(message)          cube-state.js の解析エラー（英語）を訳す
 *
 * 英語で数によって形が変わる文は { one: '{n} case', other: '{n} cases' } のように書き、params.n が 1 なら one を使う。
 * HTML では <span data-i18n="key">English</span> のように書く（属性は data-i18n-title / -placeholder / -aria-label）。
 * エディタ（index.html）の Vue の中（#app）は Vue が描き直すので data-i18n を使わず、{{ t('key') }} と書く
 * （js/main.js の t。言語を切り替えると I18N.onChange で描き直す）。
 * 言語は store.js の 'lang'（localStorage 'visualcube-editor:lang'）に保存する。無ければブラウザの言語（ja なら日本語、それ以外は英語）。
 * ナビバーの #langSwitch に EN / JA の切り替えを作る。
 */
(function () {
  'use strict';


  const DICT = {
    en: {
      // ナビバー・共通
      'nav.editor': 'Editor',
      'nav.menu': 'Menu',
      'nav.pllList': 'PLL List',
      'nav.ollList': 'OLL List',
      'common.reset': 'Reset',
      'common.prev': '‹ Prev',
      'common.next': 'Next ›',
      // エディタ
      'title.editor': 'VisualCube Editor 2.0',
      'editor.download': 'Download',
      'editor.fileName': 'File Name',
      'editor.imageSize': 'Size of generated image',
      'editor.algorithm': 'Algorithm',
      'editor.typeAlg': 'Algorithm to apply',
      'editor.typeCase': 'Algorithm to solve case',
      'editor.typeState': 'Defines the cube state',
      'editor.clear': 'Clear',
      'editor.colorPreset': 'Color Preset',
      'editor.presetStandard': 'Standard',
      'editor.presetOll': 'OLL (U color only)',
      'editor.presetCustom': 'Custom',
      'editor.faceColors': 'Face Colors',
      'editor.bgColor': 'Background Color of image',
      'editor.background': 'Background',
      'editor.transparent': 'Transparent',
      'editor.opaque': 'Opaque',
      'editor.groupAria': '{set} group',
      'editor.caseAria': '{set} case',
      'editor.navAria': '{set} navigation',
      // エディタにもともとある項目（index.html の #app の中。{{ t('…') }} で使う）
      'editor.showParameter': 'Show Parameter',
      'editor.puzzleType': 'Puzzle Type',
      'editor.stateLegendN': 'n : a blank face (gray)',
      'editor.stateLegendO': "o : an 'oriented' face (silver)",
      'editor.stateLegendT': 't : a transparent face (cube color)',
      'editor.arrows': 'Arrow Definition',
      'editor.arrowFace': 'Face',
      'editor.arrowFrom': 'From',
      'editor.arrowTo': 'To',
      'editor.arrowPass': 'Pass',
      'editor.arrowScale': 'Scale',
      'editor.arrowInfluence': 'Influence',
      'editor.arrowColor': 'Color',
      'editor.add': 'Add',
      'editor.specialView': 'Special View',
      'editor.viewNormal': 'Normal',
      'editor.viewPlan': 'Plan',
      'editor.stageMask': 'Stage Mask',
      'editor.colorSchemes': 'Color Schemes',
      'editor.rotation': 'Rotation Sequence',
      'editor.cubeColor': 'Cube Color',
      'editor.maskColor': 'Mask Color',
      'editor.cubeOpacity': 'Cube Opacity',
      'editor.stickerOpacity': 'Sticker Opacity',
      'editor.dist': 'Projection Distance',
      // 自分の手順
      'myAlg.default': 'default',
      'myAlg.custom': 'custom',
      'myAlg.save': 'Save',
      'myAlg.resetToDefault': 'Reset to default',
      'myAlg.edited': 'edited',
      'myAlg.caseOnly': 'Available in "Algorithm to solve case" mode',
      'myAlg.saved': '✓ Saved.',
      'myAlg.stripped': 'Removed the final AUF / rotation.',
      'myAlg.setup': 'Setup: {setup}',
      'myAlg.resetDone': 'Reset to the default algorithm.',
      'myAlg.undo': 'Undo',
      'myAlg.undone': 'Undone.',
      'myAlg.sameAsDefault': 'Same as the default algorithm.',
      'myAlg.err.empty': 'Enter an algorithm.',
      'myAlg.err.notSolved': 'This algorithm does not solve {name}.',
      'myAlg.err.solvesOther': 'This algorithm does not solve {name} (it solves {other}).',
      // 解析エラー
      'parse.invalid': 'Invalid move: {move}',
      'parse.missing': 'Missing closing parenthesis',
      'parse.unmatched': 'Unmatched ")"',
      'parse.tooLong': 'Too many moves after expanding repeats (max {max})',
      // 一覧ページ
      'title.pllList': 'PLL List - VisualCube Editor 2.0',
      'title.ollList': 'OLL List - VisualCube Editor 2.0',
      'list.pllHeading': 'PLL List',
      'list.ollHeading': 'OLL List',
      'list.count': '{n} cases',
      'list.pllIntro': 'Click a case to open it in the editor; tap the circle to mark your progress.',
      'list.ollIntro': 'Click a case to open it in the editor; tap the circle to mark your progress.',
      'list.download': 'Download ZIP',
      'list.downloadTitle': '{n} cases as PNG, with the colors shown here and the image settings saved in the editor',
      'list.creating': 'Creating... {i}/{n}',
      'list.orderAria': 'Order',
      'list.orderGroup': 'By group',
      'list.orderLearn': 'Learning order',
      'list.orderGroupTitle': 'Show the cases by group',
      'list.orderLearnTitle': 'Show the cases in a suggested order to learn them',
      'list.filterAria': 'Filter by status',
      'list.filterAll': 'All',
      'list.progressAria': 'Learning progress',
      'list.empty': 'No cases with this status.',
      'list.openTitle': 'Open {name} in the editor',
      'list.customTag': 'custom',
      'list.customTitle': 'Your own algorithm (saved in the editor)',
      'list.resetAll': 'Reset all progress',
      'list.resetAllTitle': 'Set every {set} case back to To learn',
      'list.resetConfirm': 'Reset all {set} progress? This clears {learned} learned and {learning} learning.',
      'list.resetYes': 'Reset',
      'list.resetDone': { one: 'Reset {n} case to To learn.', other: 'Reset {n} cases to To learn.' },
      'list.resetRestored': { one: 'Restored {n} case.', other: 'Restored {n} cases.' },
      'status.new': 'To learn',
      'status.learning': 'Learning',
      'status.learned': 'Learned',
      'status.legend.new': '{n} to learn',
      'status.legend.learning': '{n} learning',
      'status.legend.learned': '{n} learned',
      'status.badgeTitle': '{status} (click to change)',
      'status.badgeAria': '{name}: {status}. Click to change',
      // ログイン・クラウド保存（cloud-sync.js）
      'account.signIn': 'Sign in',
      'account.signOut': 'Sign out',
      'account.privacyPolicy': 'Privacy policy',
      'account.terms': 'Terms of use',
      'title.terms': 'Terms of Use - VisualCube Editor 2.0',
      // 練習（practice.html・practice.js）
      'nav.practice': 'Practice',
      'title.practice': 'Practice - VisualCube Editor 2.0',
      'practice.heading': 'Practice',
      'practice.scramble': 'Scramble',
      'practice.generating': 'Generating a scramble…',
      'practice.hint': 'Space to start, any key to stop (tap on phones)',
      'practice.dnf': "Couldn't solve",
      'practice.skip': 'Skip',
      'practice.full': 'Full solve',
      'practice.inspection': 'Inspection (15s)',
      'practice.on': 'On',
      'practice.off': 'Off',
      'practice.hintInspection': 'Space: inspection → hold and release to start, any key to stop',
      'practice.hintFull': 'Hold and release space to start, any key to stop',
      'practice.penaltyOk': 'OK',
      'practice.delete': 'Delete',
      'practice.deleted': 'Deleted.',
      'practice.ao5': 'ao5',
      'practice.ao12': 'ao12',
      'practice.bestSingle': 'Best',
      'practice.bestAo5': 'Best ao5',
      'practice.bestAo12': 'Best ao12',
      'practice.hintButton': 'Hint',
      'practice.hintHide': 'Hide hint',
      'practice.verdict.hint': 'Learning (used a hint)',
      'practice.empty': 'No cases match. Change the target.',
      'practice.target': 'Target',
      'practice.groups': 'Groups',
      'practice.groupsAll': 'All groups',
      'practice.groupsClear': 'Clear selection',
      'practice.stages': 'Stages',
      'practice.stagesAll': 'All stages',
      'practice.stageTitle': 'stage {n}',
      'practice.threshold': 'Learned within',
      'practice.seconds': '{n}s',
      'practice.customSeconds': 'Seconds to count as learned',
      'practice.verdict.learned': '✓ Learned (within {t}s)',
      'practice.verdict.learning': 'Learning (over {t}s)',
      'practice.verdict.dnf': "Learning (couldn't solve)",
      'practice.undo': 'Undo',
      'practice.undone': 'Undone.',
      'practice.caseStats': 'Recent: best {best} / average {avg} ({n} solves)',
      'practice.history': 'Recent results',
      'practice.listButton': 'Practice',
      'practice.listButtonTitle': 'Practice the cases shown here with a timer',
      // 記録（stats.html・stats.js）
      'nav.stats': 'Stats',
      'title.stats': 'Stats - VisualCube Editor 2.0',
      'practice.allStats': 'See all stats',
      'stats.heading': 'Stats',
      'stats.days': '{n} days',
      'stats.allTime': 'All time',
      'stats.count': 'Solves',
      'stats.average': 'Average (s)',
      'stats.best': 'Best {t}',
      'stats.dnf': "Couldn't solve",
      'stats.learned': 'Learned',
      'stats.trend': 'Times',
      'stats.legendSingle': 'Single',
      'stats.legendTarget': 'Target {t}s',
      'stats.byCase': 'By case',
      'stats.solves': 'Solves',
      'stats.dnfCount': '{n} DNF',
      'stats.current': 'Current {t}',
      'stats.col.date': 'Date',
      'stats.col.time': 'Time',
      'stats.show': 'Show',
      'stats.hide': 'Hide',
      'stats.selectAll': 'Select all shown records',
      'stats.selectAllShort': 'All',
      'stats.selectRow': 'Select the record of {date}',
      'stats.deleteRow': 'Delete the record of {date}',
      'stats.deleteSelected': 'Delete selected ({n})',
      'stats.deleteConfirm': 'Delete {n} records? This also changes your averages.',
      'stats.deleteYes': 'Delete',
      'stats.cancel': 'Cancel',
      'stats.deletedN': 'Deleted {n} records.',
      'stats.restored': 'Restored {n} records.',
      'stats.undo': 'Undo',
      'stats.csv': 'Export CSV',
      'stats.empty': 'No records yet.',
      'stats.col.case': 'Case',
      'stats.col.group': 'Group',
      'stats.col.status': 'Status',
      'stats.col.count': 'Solves',
      'stats.col.best': 'Best',
      'stats.col.avg': 'Average',
      'stats.col.last': 'Last',
      'stats.practiceThis': 'Practice {name}',
      // プライバシーポリシー（privacy.html・privacy.js）
      'title.privacy': 'Privacy Policy - VisualCube Editor 2.0',
      'privacy.deleteTitle': 'Delete my account data',
      'privacy.checking': 'Checking your sign-in status…',
      'privacy.unavailable': 'Sign-in is not available right now.',
      'privacy.signInFirst': 'Sign in (top right) with the account whose data you want to delete.',
      'privacy.signedInAs': 'Signed in as {name}. Your saved data on this site and on Megaminx Image Editor, and your sign-in account, will be permanently deleted.',
      'privacy.deleteButton': 'Delete my account data',
      'privacy.confirm': 'Are you sure? Your data on Megaminx Image Editor will be deleted too. This cannot be undone.',
      'privacy.deleteConfirm': 'Delete',
      'privacy.cancel': 'Cancel',
      'privacy.deleting': 'Deleting…',
      'privacy.deleted': 'Your account data has been deleted.',
      'privacy.reauthCancelled': 'Deletion was cancelled. To delete, please sign in again when asked.',
      'privacy.failed': 'Could not delete your data ({code}). Please try again or contact us.',
      'account.menuLabel': 'Account: {name}',
      'account.via': 'Signed in with {provider}',
      'account.withGoogle': 'Sign in with Google',
      'account.withGithub': 'Sign in with GitHub',
      'account.withFacebook': 'Sign in with Facebook',
      'account.synced': 'Saved to your account',
      'account.syncing': 'Saving…',
      'account.error': 'Could not save to your account',
      'account.signInFailed': 'Could not sign in. Please try again.',
      'account.linkPrompt': '{email} is already registered with another sign-in method. Sign in with that method to link {provider} to it.',
      'account.linked': 'Linked {provider}. You can now sign in with it too.',
      'account.linkFailed': 'Signed in, but could not link {provider}.',
      'account.linkOtherEmail': 'Signed in with an account of a different email, so nothing was linked.',
    },
    ja: {
      'nav.editor': 'エディタ',
      'nav.menu': 'メニュー',
      'nav.pllList': 'PLL一覧',
      'nav.ollList': 'OLL一覧',
      'common.reset': 'リセット',
      'common.prev': '‹ 前へ',
      'common.next': '次へ ›',
      'title.editor': 'VisualCube Editor 2.0',
      'editor.download': 'ダウンロード',
      'editor.fileName': 'ファイル名',
      'editor.imageSize': '画像サイズ (px)',
      'editor.algorithm': '手順',
      'editor.typeAlg': '手順を回した状態',
      'editor.typeCase': 'この手順で揃う状態',
      'editor.typeState': '色を直接指定',
      'editor.clear': 'クリア',
      'editor.colorPreset': '配色プリセット',
      'editor.presetStandard': '標準',
      'editor.presetOll': 'OLL（U面の色のみ）',
      'editor.presetCustom': 'カスタム',
      'editor.faceColors': '面の色',
      'editor.bgColor': '画像の背景色',
      'editor.background': '背景',
      'editor.transparent': '透明',
      'editor.opaque': '不透明',
      'editor.groupAria': '{set} のグループ',
      'editor.caseAria': '{set} のケース',
      'editor.navAria': '{set} の前後へ移動',
      'editor.showParameter': 'パラメータを表示',
      'editor.puzzleType': 'パズルの種類',
      'editor.stateLegendN': 'n : 空白の面（グレー）',
      'editor.stateLegendO': 'o : 向きが合っている面（シルバー）',
      'editor.stateLegendT': 't : 透明な面（キューブの色）',
      'editor.arrows': '矢印',
      'editor.arrowFace': '面',
      'editor.arrowFrom': '始点',
      'editor.arrowTo': '終点',
      'editor.arrowPass': '経由',
      'editor.arrowScale': '大きさ',
      'editor.arrowInfluence': '曲がり具合',
      'editor.arrowColor': '色',
      'editor.add': '追加',
      'editor.specialView': '表示',
      'editor.viewNormal': '通常',
      'editor.viewPlan': '上面図（Plan）',
      'editor.stageMask': 'ステージマスク',
      'editor.colorSchemes': '配色',
      'editor.rotation': '見る角度（回転）',
      'editor.cubeColor': 'キューブの色',
      'editor.maskColor': 'マスクの色',
      'editor.cubeOpacity': 'キューブの不透明度',
      'editor.stickerOpacity': 'ステッカーの不透明度',
      'editor.dist': '投影距離',
      'myAlg.default': '既定',
      'myAlg.custom': 'カスタム',
      'myAlg.save': '保存',
      'myAlg.resetToDefault': '既定に戻す',
      'myAlg.edited': '編集中',
      'myAlg.caseOnly': '保存は「この手順で揃う状態」で使えます',
      'myAlg.saved': '✓ 保存しました。',
      'myAlg.stripped': '最後の AUF・持ち替えを外しました。',
      'myAlg.setup': 'セットアップ: {setup}',
      'myAlg.resetDone': '既定の手順に戻しました。',
      'myAlg.undo': '元に戻す',
      'myAlg.undone': '元に戻しました。',
      'myAlg.sameAsDefault': '既定の手順と同じです。',
      'myAlg.err.empty': '手順を入力してください。',
      'myAlg.err.notSolved': 'この手順では {name} が揃いません。',
      'myAlg.err.solvesOther': 'この手順では {name} が揃いません（{other} が揃います）。',
      'parse.invalid': '読めない記号があります: {move}',
      'parse.missing': '閉じ括弧 ) が足りません',
      'parse.unmatched': '対応する ( の無い ) があります',
      'parse.tooLong': '繰り返しを展開すると手数が多すぎます（{max} 手まで）',
      'title.pllList': 'PLL一覧 - VisualCube Editor 2.0',
      'title.ollList': 'OLL一覧 - VisualCube Editor 2.0',
      'list.pllHeading': 'PLL一覧',
      'list.ollHeading': 'OLL一覧',
      'list.count': '{n} ケース',
      'list.pllIntro': '画像を押すとエディタで開きます。右上の丸で覚えた度を記録できます。',
      'list.ollIntro': '画像を押すとエディタで開きます。右上の丸で覚えた度を記録できます。',
      'list.download': 'ZIP でダウンロード',
      'list.downloadTitle': '{n} ケースを PNG で。色はこのページと同じ、画像の設定はエディタで保存したもの',
      'list.creating': '作成中… {i}/{n}',
      'list.orderAria': '並び',
      'list.orderGroup': 'グループ順',
      'list.orderLearn': '覚える順',
      'list.orderGroupTitle': 'グループごとに並べる',
      'list.orderLearnTitle': '覚えるとよい順番に並べる',
      'list.filterAria': '覚えた度で絞り込む',
      'list.filterAll': 'すべて',
      'list.progressAria': '覚えた度の進み具合',
      'list.empty': 'この状態のケースはありません。',
      'list.openTitle': '{name} をエディタで開く',
      'list.customTag': 'カスタム',
      'list.customTitle': '自分の手順（エディタで保存したもの）',
      'list.resetAll': 'すべて未習得に戻す',
      'list.resetAllTitle': '{set} のすべてのケースを未習得に戻す',
      'list.resetConfirm': '{set} のすべてのケースを未習得に戻しますか？（習得済み {learned}・練習中 {learning} が消えます）',
      'list.resetYes': '未習得に戻す',
      'list.resetDone': '{n} ケースを未習得に戻しました。',
      'list.resetRestored': '{n} ケースを元に戻しました。',
      'status.new': '未習得',
      'status.learning': '練習中',
      'status.learned': '習得済み',
      'status.legend.new': '未習得 {n}',
      'status.legend.learning': '練習中 {n}',
      'status.legend.learned': '習得済み {n}',
      'status.badgeTitle': '{status}（押すと切り替え）',
      'status.badgeAria': '{name}: {status}。押すと切り替え',
      'account.signIn': 'ログイン',
      'account.signOut': 'ログアウト',
      'account.privacyPolicy': 'プライバシーポリシー',
      'account.terms': '利用規約',
      'title.terms': '利用規約 - VisualCube Editor 2.0',
      'nav.practice': '練習',
      'title.practice': '練習 - VisualCube Editor 2.0',
      'practice.heading': '練習',
      'practice.scramble': 'スクランブル',
      'practice.generating': 'スクランブルを作成中…',
      'practice.hint': 'スペースでスタート、もう一度押すとストップ（スマホはタップ）',
      'practice.dnf': '解けなかった',
      'practice.skip': 'スキップ',
      'practice.full': '通し',
      'practice.inspection': 'インスペクション（15秒）',
      'practice.on': 'あり',
      'practice.off': 'なし',
      'practice.hintInspection': 'スペースでインスペクション、長押しして離すとスタート、もう一度押すとストップ',
      'practice.hintFull': 'スペースを長押しして離すとスタート、もう一度押すとストップ',
      'practice.penaltyOk': 'OK',
      'practice.delete': '削除',
      'practice.deleted': '削除しました。',
      'practice.ao5': 'ao5',
      'practice.ao12': 'ao12',
      'practice.bestSingle': 'ベスト',
      'practice.bestAo5': 'ベスト ao5',
      'practice.bestAo12': 'ベスト ao12',
      'practice.hintButton': 'ヒント',
      'practice.hintHide': 'ヒントを隠す',
      'practice.verdict.hint': '練習中（ヒントを見た）',
      'practice.empty': '対象のケースがありません。対象を変えてください。',
      'practice.target': '対象',
      'practice.groups': 'グループ',
      'practice.groupsAll': 'すべてのグループ',
      'practice.groupsClear': '選択を解除',
      'practice.stages': 'グループ',
      'practice.stagesAll': 'すべてのグループ',
      'practice.stageTitle': '覚える順の {n} 番目',
      'practice.threshold': '習得の目安',
      'practice.seconds': '{n}秒',
      'practice.customSeconds': '習得とみなす秒数',
      'practice.verdict.learned': '✓ 習得済み（{t}秒以内）',
      'practice.verdict.learning': '練習中（{t}秒を超えた）',
      'practice.verdict.dnf': '練習中（解けなかった）',
      'practice.undo': '取り消す',
      'practice.undone': '取り消しました。',
      'practice.caseStats': '最近：ベスト {best} / 平均 {avg}（{n} 回）',
      'practice.history': '直近の記録',
      'practice.listButton': '練習する',
      'practice.listButtonTitle': 'ここに表示しているケースをタイマーで練習する',
      'nav.stats': '記録',
      'title.stats': '記録 - VisualCube Editor 2.0',
      'practice.allStats': 'すべての記録を見る',
      'stats.heading': '記録',
      'stats.days': '{n}日',
      'stats.allTime': 'すべて',
      'stats.count': '練習回数',
      'stats.average': '平均（秒）',
      'stats.best': 'ベスト {t}',
      'stats.dnf': '解けなかった',
      'stats.learned': '習得済み',
      'stats.trend': 'タイムの推移',
      'stats.legendSingle': '1回ごと',
      'stats.legendTarget': '目安 {t} 秒',
      'stats.byCase': 'ケースごと',
      'stats.solves': '記録の一覧',
      'stats.dnfCount': 'DNF {n} 回',
      'stats.current': '今 {t}',
      'stats.col.date': '日時',
      'stats.col.time': 'タイム',
      'stats.show': '見る',
      'stats.hide': '閉じる',
      'stats.selectAll': '表示中の記録をすべて選ぶ',
      'stats.selectAllShort': 'すべて',
      'stats.selectRow': '{date} の記録を選ぶ',
      'stats.deleteRow': '{date} の記録を削除',
      'stats.deleteSelected': '選択した記録を削除（{n}）',
      'stats.deleteConfirm': '{n} 件の記録を削除しますか？平均なども変わります。',
      'stats.deleteYes': '削除する',
      'stats.cancel': 'キャンセル',
      'stats.deletedN': '{n} 件の記録を削除しました。',
      'stats.restored': '{n} 件の記録を元に戻しました。',
      'stats.undo': '元に戻す',
      'stats.csv': 'CSV で書き出す',
      'stats.empty': 'まだ記録がありません。',
      'stats.col.case': 'ケース',
      'stats.col.group': 'グループ',
      'stats.col.status': '覚えた度',
      'stats.col.count': '回数',
      'stats.col.best': 'ベスト',
      'stats.col.avg': '平均',
      'stats.col.last': '最後に練習',
      'stats.practiceThis': '{name} を練習する',
      'title.privacy': 'プライバシーポリシー - VisualCube Editor 2.0',
      'privacy.deleteTitle': 'アカウントのデータを削除',
      'privacy.checking': 'ログインの状態を確認しています…',
      'privacy.unavailable': '今はログインの機能を使えません。',
      'privacy.signInFirst': '削除したいアカウントで、右上からログインしてください。',
      'privacy.signedInAs': '{name} でログイン中です。本サイトと Megaminx Image Editor に保存した内容と、ログインのアカウントが完全に削除されます。',
      'privacy.deleteButton': 'アカウントのデータを削除',
      'privacy.confirm': '本当に削除しますか？Megaminx Image Editor に保存した内容も削除されます。元に戻すことはできません。',
      'privacy.deleteConfirm': '削除する',
      'privacy.cancel': 'キャンセル',
      'privacy.deleting': '削除しています…',
      'privacy.deleted': 'アカウントのデータを削除しました。',
      'privacy.reauthCancelled': '削除を中止しました。削除するには、求められたときにもう一度ログインしてください。',
      'privacy.failed': '削除できませんでした（{code}）。もう一度お試しいただくか、お問い合わせください。',
      'account.menuLabel': 'アカウント: {name}',
      'account.via': '{provider} でログイン中',
      'account.withGoogle': 'Google でログイン',
      'account.withGithub': 'GitHub でログイン',
      'account.withFacebook': 'Facebook でログイン',
      'account.synced': 'アカウントに保存済み',
      'account.syncing': '保存中…',
      'account.error': 'アカウントに保存できませんでした',
      'account.signInFailed': 'ログインできませんでした。もう一度お試しください。',
      'account.linkPrompt': '{email} は別のログイン方法で登録されています。前に使った方法でログインすると、{provider} でもログインできるようにつなげます。',
      'account.linked': '{provider} をつなげました。これからは {provider} でもログインできます。',
      'account.linkFailed': 'ログインしましたが、{provider} をつなげられませんでした。',
      'account.linkOtherEmail': '別のメールアドレスのアカウントでログインしたので、つなげませんでした。',
    },
  };

  function initialLang() {
    const saved = window.Store ? window.Store.get('lang') : null;
    if (saved === 'en' || saved === 'ja') return saved;
    return /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
  }

  let lang = initialLang();
  const listeners = [];

  function t(key, params) {
    let text = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
    // 単数・複数（英語の「1 case / 2 cases」）
    if (typeof text === 'object') text = params && Number(params.n) === 1 ? text.one : text.other;
    return text.replace(/\{(\w+)\}/g, (m, name) => (params && params[name] != null ? String(params[name]) : m));
  }

  const ATTRS = { text: 'i18n', title: 'i18nTitle', placeholder: 'i18nPlaceholder', 'aria-label': 'i18nAriaLabel' };

  function render(el, attr) {
    const key = el.dataset[ATTRS[attr]];
    if (!key) return;
    let params;
    try {
      params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : undefined;
    } catch (e) {
      params = undefined;
    }
    const text = t(key, params);
    if (attr === 'text') el.textContent = text;
    else el.setAttribute(attr, text);
  }

  function set(el, key, params, attr) {
    const a = attr || 'text';
    el.dataset[ATTRS[a]] = key;
    if (params) el.dataset.i18nParams = JSON.stringify(params);
    render(el, a);
  }

  function apply(root) {
    const base = root || document;
    Object.keys(ATTRS).forEach((attr) => {
      const name = 'data-' + ATTRS[attr].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
      base.querySelectorAll('[' + name + ']').forEach((el) => render(el, attr));
    });
    document.documentElement.lang = lang;
    const titleKey = document.documentElement.dataset.i18nTitlePage;
    if (titleKey) document.title = t(titleKey);
    updateSwitch();
  }

  function setLang(next) {
    if (next !== 'en' && next !== 'ja') return;
    lang = next;
    if (window.Store) window.Store.set('lang', next);
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  // cube-state.js の解析エラー（英語の文）を訳す
  function error(message) {
    const m = /^Invalid move: (.*)$/.exec(message);
    if (m) return t('parse.invalid', { move: m[1] });
    if (message === 'Missing closing parenthesis') return t('parse.missing');
    if (message === 'Unmatched ")"') return t('parse.unmatched');
    const long = /^Too many moves \(max (\d+)\)$/.exec(message);
    if (long) return t('parse.tooLong', { max: long[1] });
    return message;
  }

  // ---- ナビバーの切り替え（EN / 日本語）----
  function buildSwitch() {
    const box = document.getElementById('langSwitch');
    if (!box) return;
    box.className = 'lang-switch';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Language / 言語');
    [
      ['en', 'EN'],
      ['ja', 'JA'],
    ].forEach(([code, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lang-option';
      b.dataset.lang = code;
      b.lang = code;
      b.textContent = label;
      b.addEventListener('click', () => setLang(code));
      box.append(b);
    });
  }

  function updateSwitch() {
    document.querySelectorAll('#langSwitch [data-lang]').forEach((b) => {
      const on = b.dataset.lang === lang;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  window.I18N = {
    get lang() {
      return lang;
    },
    t: t,
    set: set,
    apply: apply,
    setLang: setLang,
    onChange: (fn) => listeners.push(fn),
    error: error,
  };

  buildSwitch();
  apply();
})();
