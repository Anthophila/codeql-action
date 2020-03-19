"use strict";
exports.__esModule = true;
var fs = require("fs");
var env = {};
for (var _i = 0, _a = Object.entries(process.env); _i < _a.length; _i++) {
    var entry = _a[_i];
    var key = entry[0];
    var value = entry[1];
    if (typeof value !== 'undefined' && key !== '_' && !key.startsWith('JAVA_MAIN_CLASS_')) {
        env[key] = value;
    }
}
process.stdout.write(process.argv[2]);
fs.writeFileSync(process.argv[2], JSON.stringify(env), 'utf-8');
