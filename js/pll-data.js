// 自動生成ファイル。手で編集しないこと。
// 元データ: data/pll/algs_info.json / 生成: node tools/build-pll-data.js
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.PLL_DATA = data;
})(typeof self !== 'undefined' ? self : this, [
  {"name":"Ua","group":"Edges only","stage":1,"order":1,"alg":"R2 U R U R' U' R' U' R' U R'","setup":"R U' R U R U R U' R' U' R2","inverse":"Ub"},
  {"name":"Ub","group":"Edges only","stage":1,"order":2,"alg":"R U' R U R U R U' R' U' R2","setup":"R2 U R U R' U' R' U' R' U R'","inverse":"Ua"},
  {"name":"H","group":"Edges only","stage":4,"order":5,"alg":"M2' U M2' U2 M2' U M2'","setup":"R2 U2 R' U2 R2 U2 R2 U2 R' U2 R2","inverse":"H"},
  {"name":"Z","group":"Edges only","stage":5,"order":6,"alg":"M' U M'2 U M'2 U M' U2 M'2 U'","setup":"R U R2 U' R' U' R U R' U' R' U R' U R U2","inverse":"Z"},
  {"name":"Aa","group":"Corners only","stage":7,"order":9,"alg":"x' R U' R D2 R' U R D2 R2 x","setup":"R2 F2 R' B' R F2 R' B R'","inverse":"Ab"},
  {"name":"Ab","group":"Corners only","stage":7,"order":10,"alg":"x' R2 D2 R' U' R D2 R' U R' x","setup":"R B' R F2 R' B R F2 R2","inverse":"Aa"},
  {"name":"E","group":"Corners only","stage":11,"order":15,"alg":"x' R U' R' D R U R' D' R U R' D R U' R' D' x","setup":"F R B R' F' R B' R' F R B' R' F' R B R'","inverse":"E"},
  {"name":"T","group":"Adjacent swap","stage":2,"order":3,"alg":"R U R' U' R' F R2 U' R' U' R U R' F'","setup":"F R U' R' U R U R2 F' R U R U' R'","inverse":"T"},
  {"name":"F","group":"Adjacent swap","stage":8,"order":11,"alg":"R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R","setup":"R' U' R U' R' U R U R2 F' R U R U' R' F U R","inverse":"F"},
  {"name":"Ja","group":"Adjacent swap","stage":6,"order":7,"alg":"R' U L' U2 R U' R' U2 L R U'","setup":"U R' L' U2 R U R' U2 L U' R","inverse":"Ja"},
  {"name":"Jb","group":"Adjacent swap","stage":6,"order":8,"alg":"R U R' F' R U R' U' R' F R2 U' R' U'","setup":"U R U R2 F' R U R U' R' F R U' R'","inverse":"Jb"},
  {"name":"Ra","group":"Adjacent swap","stage":10,"order":13,"alg":"R' U2 R U'2 R' F R U R' U' R' F' R2 U'","setup":"U R2 F R U R U' R' F' R U2 R' U2 R","inverse":"Ra"},
  {"name":"Rb","group":"Adjacent swap","stage":10,"order":14,"alg":"R U' R' U' R U R D R' U' R D' R' U'2 R' U'","setup":"U R U2 R D R' U R D' R' U' R' U R U R'","inverse":"Rb"},
  {"name":"Y","group":"Diagonal swap","stage":3,"order":4,"alg":"F R U' R' U' R U R' F' R U R' U' R' F R F'","setup":"F R' F' R U R U' R' F R U' R' U R U R' F'","inverse":"Y"},
  {"name":"V","group":"Diagonal swap","stage":9,"order":12,"alg":"R' U R U' R' Fw' U' R U2 R' U' R U' R' Fw R","setup":"R' B' D R D' R D R2 D' R B R U R' U' R","inverse":"V"},
  {"name":"Na","group":"Diagonal swap","stage":13,"order":20,"alg":"R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'","setup":"R U R' U2 R U R2 F' R U R U' R' F R U' R' U' R U' R'","inverse":"Na"},
  {"name":"Nb","group":"Diagonal swap","stage":13,"order":21,"alg":"R' U R U' R' F' U' F R U R' F R' F' R U' R","setup":"R' U R' F R F' R U' R' F' U F R U R' U' R","inverse":"Nb"},
  {"name":"Ga","group":"G","stage":12,"order":16,"alg":"D' R U R' U' D R2 U' R U' R' U R' U R2 U","setup":"U' R2 U' R U' R U R' U R2 U D' R U' R' D","inverse":"Gb"},
  {"name":"Gb","group":"G","stage":12,"order":17,"alg":"U' R2' U' R U' R U R' U R2 D' U R U' R' D","setup":"D' R U R' U' D R2 U' R U' R' U R' U R2 U","inverse":"Ga"},
  {"name":"Gc","group":"G","stage":12,"order":18,"alg":"D R' U' R U D' R2 U R' U R U' R U' R2' U'","setup":"U R2 U R' U R' U' R U' R2 U' D R' U R D'","inverse":"Gd"},
  {"name":"Gd","group":"G","stage":12,"order":19,"alg":"U R2 U R' U R' U' R U' R2 D U' R' U R D'","setup":"D R' U' R U D' R2 U R' U R U' R U' R2 U'","inverse":"Gc"},
]);
