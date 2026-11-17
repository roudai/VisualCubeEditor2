// 自動生成ファイル。手で編集しないこと。
// 元データ: data/pll/algs_info.json / 生成: node tools/build-pll-data.js
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.PLL_DATA = data;
})(typeof self !== 'undefined' ? self : this, [
  {"name":"Ua","group":"Edges only","alg":"R2 U R U R' U' R' U' R' U R'","setup":"R U' R U R U R U' R' U' R2"},
  {"name":"Ub","group":"Edges only","alg":"R U' R U R U R U' R' U' R2","setup":"R2 U R U R' U' R' U' R' U R'"},
  {"name":"H","group":"Edges only","alg":"M2' U M2' U2 M2' U M2'","setup":"R2 U2 R' U2 R2 U2 R2 U2 R' U2 R2"},
  {"name":"Z","group":"Edges only","alg":"M' U M'2 U M'2 U M' U2 M'2 U'","setup":"R U R2 U' R' U' R U R' U' R' U R' U R U2"},
  {"name":"Aa","group":"Corners only","alg":"x' R U' R D2 R' U R D2 R2 x","setup":"R2 F2 R' B' R F2 R' B R'"},
  {"name":"Ab","group":"Corners only","alg":"x' R2 D2 R' U' R D2 R' U R' x","setup":"R B' R F2 R' B R F2 R2"},
  {"name":"E","group":"Corners only","alg":"x' R U' R' D R U R' D' R U R' D R U' R' D' x","setup":"F R B R' F' R B' R' F R B' R' F' R B R'"},
  {"name":"T","group":"Adjacent swap","alg":"R U R' U' R' F R2 U' R' U' R U R' F'","setup":"F R U' R' U R U R2 F' R U R U' R'"},
  {"name":"F","group":"Adjacent swap","alg":"R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R","setup":"R' U' R U' R' U R U R2 F' R U R U' R' F U R"},
  {"name":"Ja","group":"Adjacent swap","alg":"R' U L' U2 R U' R' U2 L R U'","setup":"U R' L' U2 R U R' U2 L U' R"},
  {"name":"Jb","group":"Adjacent swap","alg":"R U R' F' R U R' U' R' F R2 U' R' U'","setup":"U R U R2 F' R U R U' R' F R U' R'"},
  {"name":"Ra","group":"Adjacent swap","alg":"R' U2 R U'2 R' F R U R' U' R' F' R2 U'","setup":"U R2 F R U R U' R' F' R U2 R' U2 R"},
  {"name":"Rb","group":"Adjacent swap","alg":"R U' R' U' R U R D R' U' R D' R' U'2 R' U'","setup":"U R U2 R D R' U R D' R' U' R' U R U R'"},
  {"name":"Y","group":"Diagonal swap","alg":"F R U' R' U' R U R' F' R U R' U' R' F R F'","setup":"F R' F' R U R U' R' F R U' R' U R U R' F'"},
  {"name":"V","group":"Diagonal swap","alg":"R' U R U' R' Fw' U' R U2 R' U' R U' R' Fw R","setup":"R' B' D R D' R D R2 D' R B R U R' U' R"},
  {"name":"Na","group":"Diagonal swap","alg":"R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'","setup":"R U R' U2 R U R2 F' R U R U' R' F R U' R' U' R U' R'"},
  {"name":"Nb","group":"Diagonal swap","alg":"R' U R U' R' F' U' F R U R' F R' F' R U' R","setup":"R' U R' F R F' R U' R' F' U F R U R' U' R"},
  {"name":"Ga","group":"G","alg":"D' R U R' U' D R2 U' R U' R' U R' U R2 U","setup":"U' R2 U' R U' R U R' U R2 U D' R U' R' D"},
  {"name":"Gb","group":"G","alg":"U' R2' U' R U' R U R' U R2 D' U R U' R' D","setup":"D' R U R' U' D R2 U' R U' R' U R' U R2 U"},
  {"name":"Gc","group":"G","alg":"D R' U' R U D' R2 U R' U R U' R U' R2' U'","setup":"U R2 U R' U R' U' R U' R2 U' D R' U R D'"},
  {"name":"Gd","group":"G","alg":"U R2 U R' U R' U' R U' R2 D U' R' U R D'","setup":"D R' U' R U D' R2 U R' U R U' R U' R2 U'"},
]);
