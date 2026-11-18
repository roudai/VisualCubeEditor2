/*
 * ケースの区切り（一覧ページの見出し・練習ページのグループを選ぶ欄で共通）。DOM 非依存。
 * 仕様: reference/PLL_SPEC.md「覚える順番」
 *
 *   CaseSections.hasStages(data)        覚える順番（各ケースの stage・order。pll-data.js にだけある）があるか
 *   CaseSections.isNumbered(data)       名前がすべて番号か（OLL の "1"〜"57"）。番号のデータは、覚える順でないとき番号順の1列にする
 *   CaseSections.list(data, byStage)    区切りの配列 [{ key, label, stage, cases }]
 *     byStage = false：グループ（c.group）ごと。並びはデータの順。key・label はグループ名（"A"）
 *                      番号のデータ（isNumbered）は、区切り1つ（key 'all'、label ''）に番号順で入れる
 *     byStage = true ：覚える順番の段階（c.stage）ごと。段階の中も覚える順（c.order）。
 *                      key は "s<段階>"（"s9"）、label は中のケースから作る短い名前（stageLabel）
 *   CaseSections.stageLabel(names, stage) 段階の短い名前
 *                                       番号の名前（OLL）：段階の番号を A〜M の文字にする（Cube Voyage「OLLを覚える順番」のカテゴリの記号）
 *                                       3x3 の PLL の名前（Ua・Ub、Ga〜Gd）：最後の小文字を除いた種類（"U"、"G"）。T・Y なども種類の名前
 *                                       ZBLL の名前（T-2GLL1 など、すべて同じ「X-」で始まる）：その X（"T"、"Sune"）
 *                                       それ以外（Megaminx の名前）：+/− を除いた名前の文字と番号の範囲
 *                                       例：[F2+, F3+, F2-, F3-, F4+, …] → "F2–5"、[E1, E2, E3] → "E1–3"、[D+, D-] → "D"、[K2+, K2-] → "K2"
 *   CaseSections.keyOf(c, byStage, numbered) そのケースが入る区切りの key（numbered は isNumbered(data)）
 *   CaseSections.orderKeys(set, data)  並びの切り替えの文言（i18n のキー）と段階の見出しの形
 *     { group: { key, title }, learn: { key, title, titleParams }, heading: 'number' | 'label' | 'name' }
 *     PLL・COLL：グループ順 / 覚える順（覚える順の説明には {set}）。見出しは「1. U-perm」（number）
 *     OLL（番号のデータ）：番号順 / 覚える順。見出しは「A. 十字完成」（label）
 *     ZBLL：小グループ順 / OCLL ごと。見出しは「T-ZBLL」（name。段階は覚える順ではなく OCLL なので番号を付けない）
 *
 * 並びの選び方は store.js の 'list-filter' の pllOrder（'learn' なら覚える順。一覧と練習で共通）。
 * ブラウザでは window.CaseSections、node では module.exports として公開する。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CaseSections = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const hasStages = (data) => data.length > 0 && data.every((c) => c.stage > 0 && c.order > 0);
  const isNumbered = (data) => data.length > 0 && data.every((c) => /^\d+$/.test(String(c.name)));

  function stageLabel(names, stage) {
    if (names.length && names.every((n) => /^\d+$/.test(String(n)))) return stage > 0 && stage <= 26 ? String.fromCharCode(64 + stage) : '';
    // ZBLL：名前がすべて「OCLL-…」の形（T-2GLL1 など）なら、その OCLL（T）
    if (names.length && names.every((n) => /^[A-Za-z]+-/.test(String(n)))) {
      const heads = names.map((n) => String(n).split('-')[0]).filter((h, i, all) => all.indexOf(h) === i);
      if (heads.length === 1) return heads[0];
    }
    // 3x3 の PLL：Ua・Ub → U、Ga〜Gd → G（大文字1つ＋小文字1つまで。T・Y などはそのまま）
    if (names.length && names.every((n) => /^[A-Z][a-d]?$/.test(String(n)))) {
      const kinds = names.map((n) => String(n)[0]).filter((k, i, all) => all.indexOf(k) === i);
      return kinds.join('・');
    }
    const bases = names.map((n) => String(n).replace(/[+-]$/, '')).filter((b, i, all) => all.indexOf(b) === i);
    const parts = bases.map((b) => /^([A-Z]+)(\d*)$/.exec(b));
    const letters = parts.map((m) => (m ? m[1] : null)).filter((l, i, all) => all.indexOf(l) === i);
    // 文字が1種類で、番号が付いていればその範囲（付いていなければ文字だけ）
    if (letters.length === 1 && letters[0]) {
      const nums = parts.map((m) => m[2]).filter(Boolean).map(Number);
      if (!nums.length) return letters[0];
      const lo = Math.min(...nums);
      const hi = Math.max(...nums);
      return lo === hi ? `${letters[0]}${lo}` : `${letters[0]}${lo}–${hi}`;
    }
    return bases.join('・');
  }

  const keyOf = (c, byStage, numbered) => (byStage ? 's' + c.stage : numbered ? 'all' : c.group);

  function list(data, byStage) {
    const stage = byStage && hasStages(data);
    if (!stage && isNumbered(data)) {
      return [{ key: 'all', label: '', stage: null, cases: data.slice().sort((a, b) => Number(a.name) - Number(b.name)) }];
    }
    const cases = stage ? data.slice().sort((a, b) => a.order - b.order) : data;
    const sections = [];
    const at = {};
    cases.forEach((c) => {
      const key = keyOf(c, stage);
      if (!at[key]) {
        at[key] = { key: key, label: stage ? '' : c.group, stage: stage ? c.stage : null, cases: [] };
        sections.push(at[key]);
      }
      at[key].cases.push(c);
    });
    if (stage) sections.forEach((s) => (s.label = stageLabel(s.cases.map((c) => c.name), s.stage)));
    return sections;
  }

  function orderKeys(set, data) {
    if (set === 'zbll') {
      return {
        group: { key: 'list.orderSubset', title: 'list.orderSubsetTitle' },
        learn: { key: 'list.orderOcll', title: 'list.orderOcllTitle' },
        heading: 'name',
      };
    }
    const numbered = isNumbered(data);
    return {
      group: numbered ? { key: 'list.orderNumber', title: 'list.orderNumberTitle' } : { key: 'list.orderGroup', title: 'list.orderGroupTitle' },
      learn: { key: 'list.orderLearn', title: 'list.orderLearnTitle', titleParams: { set: String(set).toUpperCase() } },
      heading: numbered ? 'label' : 'number',
    };
  }

  return { hasStages: hasStages, isNumbered: isNumbered, list: list, stageLabel: stageLabel, keyOf: keyOf, orderKeys: orderKeys };
});
