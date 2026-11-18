// 実行: node --test
// js/case-sections.js（一覧・練習のグループ / 覚える順の段階の区切り）
const test = require('node:test');
const assert = require('node:assert/strict');
const CS = require('../js/case-sections.js');

// 覚える順番の無いデータ（グループだけ）
const GROUPED = [
  { name: 'Ua', group: 'Edges only' },
  { name: 'Ub', group: 'Edges only' },
  { name: 'Aa', group: 'Corners only' },
  { name: 'T', group: 'Adjacent swap' },
  { name: 'Ab', group: 'Corners only' }, // 離れていても同じグループにまとめる
];
// 覚える順番のあるデータ（Megaminx の名前の形）
const STAGED = [
  { name: 'F1+', group: 'F', stage: 2, order: 3 },
  { name: 'F1-', group: 'F', stage: 2, order: 4 },
  { name: 'A1+', group: 'A', stage: 1, order: 2 },
  { name: 'B1+', group: 'B', stage: 1, order: 1 },
];

test('stageLabel：+/− を除いた名前の文字と番号の範囲', () => {
  assert.equal(CS.stageLabel(['F1+', 'F1-']), 'F1');
  assert.equal(CS.stageLabel(['F2+', 'F3+', 'F2-', 'F3-', 'F4+', 'F5+', 'F4-', 'F5-']), 'F2–5');
  assert.equal(CS.stageLabel(['E1', 'E2', 'E3']), 'E1–3');
  assert.equal(CS.stageLabel(['D+', 'D-']), 'D');
  assert.equal(CS.stageLabel(['M']), 'M');
  assert.equal(CS.stageLabel(['A1+', 'B1+']), 'A1・B1');
  // 3x3 の PLL：最後の小文字を除いた種類の名前
  assert.equal(CS.stageLabel(['Ua', 'Ub'], 1), 'U');
  assert.equal(CS.stageLabel(['Ga', 'Gb', 'Gc', 'Gd'], 12), 'G');
  assert.equal(CS.stageLabel(['T'], 2), 'T');
  // OLL（番号の名前）：段階の番号を A〜M に
  assert.equal(CS.stageLabel(['21', '22'], 1), 'A');
  assert.equal(CS.stageLabel(['29', '30', '41', '42'], 13), 'M');
  // ZBLL（OCLL-名前）：その OCLL
  assert.equal(CS.stageLabel(['T-2GLL1', 'T-Diag3', 'T-SO1'], 1), 'T');
  assert.equal(CS.stageLabel(['Sune-SS1', 'Sune-2GLL2'], 6), 'Sune');
});

test('hasStages：全ケースに stage・order があるデータだけ覚える順番がある', () => {
  assert.equal(CS.hasStages(STAGED), true);
  assert.equal(CS.hasStages(GROUPED), false);
  assert.equal(CS.hasStages(STAGED.concat([{ name: 'X', group: 'X' }])), false);
  assert.equal(CS.hasStages([]), false);
});

test('list：グループ順はデータに出てきた順', () => {
  const groups = CS.list(GROUPED, false);
  assert.deepEqual(groups.map((s) => s.key), ['Edges only', 'Corners only', 'Adjacent swap']);
  assert.deepEqual(groups.map((s) => s.label), ['Edges only', 'Corners only', 'Adjacent swap']);
  assert.deepEqual(groups[1].cases.map((c) => c.name), ['Aa', 'Ab']);
  assert.equal(groups[0].stage, null);
  assert.equal(groups.reduce((n, s) => n + s.cases.length, 0), GROUPED.length);
  assert.equal(CS.keyOf(GROUPED[0], false), 'Edges only');
});

test('list：覚える順は段階ごとで、中も覚える順。覚える順番の無いデータはグループ順のまま', () => {
  const stages = CS.list(STAGED, true);
  assert.deepEqual(stages.map((s) => s.key), ['s1', 's2']);
  assert.deepEqual(stages.map((s) => s.stage), [1, 2]);
  assert.deepEqual(stages.map((s) => s.label), ['B1・A1', 'F1']);
  assert.deepEqual(stages[0].cases.map((c) => c.name), ['B1+', 'A1+']);
  assert.equal(CS.keyOf(STAGED[0], true), 's2');
  assert.deepEqual(CS.list(GROUPED, true).map((s) => s.key), CS.list(GROUPED, false).map((s) => s.key));
});

// 番号の名前のデータ（3x3 の OLL の形。データの並びはグループ順）
const NUMBERED = [
  { name: '2', group: 'Dot' },
  { name: '17', group: 'Dot' },
  { name: '5', group: 'Square' },
  { name: '10', group: 'Awkward' },
];

test('isNumbered：名前がすべて番号のデータだけ', () => {
  assert.equal(CS.isNumbered(NUMBERED), true);
  assert.equal(CS.isNumbered(GROUPED), false);
  assert.equal(CS.isNumbered([]), false);
});

test('list：番号のデータは、覚える順でなければ区切り1つに番号順（見出しなし）', () => {
  const all = CS.list(NUMBERED, false);
  assert.deepEqual(all.map((s) => [s.key, s.label]), [['all', '']]);
  assert.deepEqual(all[0].cases.map((c) => c.name), ['2', '5', '10', '17']);
  assert.equal(CS.keyOf(NUMBERED[0], false, true), 'all');
  // 覚える順番があれば、覚える順では段階ごと（名前は A〜）
  const staged = NUMBERED.map((c, i) => Object.assign({ stage: i < 2 ? 1 : 2, order: i + 1 }, c));
  assert.deepEqual(CS.list(staged, true).map((s) => [s.key, s.label]), [['s1', 'A'], ['s2', 'B']]);
  assert.deepEqual(CS.list(staged, false).map((s) => s.key), ['all']);
});
