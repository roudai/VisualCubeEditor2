"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFaceletDefinitions = void 0;
var constants_1 = require("../../constants");
function parseFaceletDefinitions(rawValue) {
    var colors = [];
    for (var i = 0; i < rawValue.length; i++) {
        colors.push(constants_1.FaceletAbbreviateToDefinition[rawValue.charAt(i)]);
    }
    return colors;
}
exports.parseFaceletDefinitions = parseFaceletDefinitions;
