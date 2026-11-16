/*
 * ケースの区切り（一覧ページの見出し・練習ページのグループを選ぶ欄で共通）。DOM 非依存。
 * 仕様: reference/PLL_SPEC.md「覚える順番」
 *
 *   CaseSections.hasStages(data)        覚える順番（各ケースの stage・order。pll-data.js にだけある）があるか
 *   CaseSections.list(data, byStage)    区切りの配列 [{ key, label, stage, cases }]
 *     byStage = false：グループ（c.group）ごと。並びはデータの順。key・label はグループ名（"A"）
 *     byStage = true ：覚える順番の段階（c.stage）ごと。段階の中も覚える順（c.order）。
 *                      key は "s<段階>"（"s9"）、label は中のケースから作る短い名前（stageLabel）
 *   CaseSections.stageLabel(names)      段階の短い名前。+/− を除いた名前の文字と番号の範囲
 *                                       例：[F2+, F3+, F2-, F3-, F4+, …] → "F2–5"、[E1, E2, E3] → "E1–3"、[D+, D-] → "D"、[K2+, K2-] → "K2"
 *   CaseSections.keyOf(c, byStage)      そのケースが入る区切りの key
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

  function stageLabel(names) {
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

  const keyOf = (c, byStage) => (byStage ? 's' + c.stage : c.group);

  function list(data, byStage) {
    const stage = byStage && hasStages(data);
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
    if (stage) sections.forEach((s) => (s.label = stageLabel(s.cases.map((c) => c.name))));
    return sections;
  }

  return { hasStages: hasStages, list: list, stageLabel: stageLabel, keyOf: keyOf };
});
