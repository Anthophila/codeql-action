"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var core = require("@actions/core");
var exec = require("@actions/exec");
var fs = require("fs");
var path = require("path");
var configUtils = require("./config-utils");
var setuptools = require("./setup-tools");
var sharedEnv = require("./shared-environment");
var util = require("./util");
var CRITICAL_TRACER_VARS = new Set(['SEMMLE_PRELOAD_libtrace',
    ,
    'SEMMLE_RUNNER',
    ,
    'SEMMLE_COPY_EXECUTABLES_ROOT',
    ,
    'SEMMLE_DEPTRACE_SOCKET',
    ,
    'SEMMLE_JAVA_TOOL_OPTIONS'
]);
function tracerConfig(codeql, database, compilerSpec) {
    return __awaiter(this, void 0, void 0, function () {
        var compilerSpecArg, envFile, env, config, info, _i, _a, entry, key, value;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    compilerSpecArg = compilerSpec ? ["--compiler-spec=" + compilerSpec] : [];
                    envFile = path.resolve(database, 'working', 'env.tmp');
                    return [4 /*yield*/, exec.exec(codeql.cmd, __spreadArrays(['database', 'trace-command', database], compilerSpecArg, [process.execPath, path.resolve(__dirname, 'tracer-env.js'), envFile]))];
                case 1:
                    _b.sent();
                    env = JSON.parse(fs.readFileSync(envFile, 'utf-8'));
                    config = env['ODASA_TRACER_CONFIGURATION'];
                    info = { spec: config, env: {} };
                    // Extract critical tracer variables from the environment
                    for (_i = 0, _a = Object.entries(env); _i < _a.length; _i++) {
                        entry = _a[_i];
                        key = entry[0];
                        value = entry[1];
                        // skip ODASA_TRACER_CONFIGURATION as it is handled separately
                        if (key === 'ODASA_TRACER_CONFIGURATION') {
                            continue;
                        }
                        // skip undefined values
                        if (typeof value === 'undefined') {
                            continue;
                        }
                        // Keep variables that do not exist in current environment. In addition always keep
                        // critical and CODEQL_ variables
                        if (typeof process.env[key] === 'undefined' || CRITICAL_TRACER_VARS.has(key) || key.startsWith('CODEQL_')) {
                            info.env[key] = value;
                        }
                    }
                    return [2 /*return*/, info];
            }
        });
    });
}
function concatTracerConfigs(configs) {
    // A tracer config is a map containing additional environment variables and a tracer 'spec' file.
    // A tracer 'spec' file has the following format [log_file, number_of_blocks, blocks_text]
    // Merge the environments
    var env = {};
    var envSize = 0;
    for (var _i = 0, _a = Object.values(configs); _i < _a.length; _i++) {
        var v = _a[_i];
        for (var _b = 0, _c = Object.entries(v.env); _b < _c.length; _b++) {
            var e = _c[_b];
            var name_1 = e[0];
            var value = e[1];
            if (name_1 in env) {
                if (env[name_1] !== value) {
                    throw Error('Incompatible values in environment parameter ' +
                        name_1 + ': ' + env[name_1] + ' and ' + value);
                }
            }
            else {
                env[name_1] = value;
                envSize += 1;
            }
        }
    }
    // Concatenate spec files into a new spec file
    var languages = Object.keys(configs);
    var cppIndex = languages.indexOf('cpp');
    // Make sure cpp is the last language, if it's present since it must be concatenated last
    if (cppIndex !== -1) {
        var lastLang = languages[languages.length - 1];
        languages[languages.length - 1] = languages[cppIndex];
        languages[cppIndex] = lastLang;
    }
    var totalLines = [];
    var totalCount = 0;
    for (var _d = 0, languages_1 = languages; _d < languages_1.length; _d++) {
        var lang = languages_1[_d];
        var lines = fs.readFileSync(configs[lang].spec, 'utf8').split(/\r?\n/);
        var count = parseInt(lines[1], 10);
        totalCount += count;
        totalLines.push.apply(totalLines, lines.slice(2));
    }
    var newLogFilePath = path.resolve(workspaceFolder(), 'compound-build-tracer.log');
    var spec = path.resolve(workspaceFolder(), 'compound-spec');
    var newSpecContent = __spreadArrays([newLogFilePath, totalCount.toString(10)], totalLines);
    fs.writeFileSync(spec, newSpecContent.join('\n'));
    // Prepare the content of the compound environment file
    var buffer = Buffer.alloc(4);
    buffer.writeInt32LE(envSize, 0);
    for (var _e = 0, _f = Object.entries(env); _e < _f.length; _e++) {
        var e = _f[_e];
        var key = e[0];
        var value = e[1];
        var lineBuffer = new Buffer(key + '=' + value + '\0', 'utf8');
        var sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeInt32LE(lineBuffer.length, 0);
        buffer = Buffer.concat([buffer, sizeBuffer, lineBuffer]);
    }
    // Write the compound environment
    var envPath = spec + '.environment';
    fs.writeFileSync(envPath, buffer);
    return { env: env, spec: spec };
}
function workspaceFolder() {
    var workspaceFolder = process.env['RUNNER_WORKSPACE'];
    if (!workspaceFolder)
        workspaceFolder = path.resolve('..');
    return workspaceFolder;
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var config, languages, sourceRoot, codeqlSetup, goFlags, codeqlResultFolder, databaseFolder, tracedLanguages, scannedLanguages, _i, languages_2, language, languageDatabase, config_1, tracedLanguageKeys, mainTracerConfig, _a, _b, entry, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 13, , 14]);
                    if (util.should_abort('init')) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, configUtils.loadConfig()];
                case 1:
                    config = _c.sent();
                    languages = core.getInput('languages', { required: true })
                        .split(',')
                        .map(function (x) { return x.trim(); })
                        .filter(function (x) { return x.length > 0; });
                    core.exportVariable(sharedEnv.CODEQL_ACTION_LANGUAGES, languages.join(','));
                    sourceRoot = path.resolve();
                    core.startGroup('Setup CodeQL tools');
                    return [4 /*yield*/, setuptools.setupCodeQL()];
                case 2:
                    codeqlSetup = _c.sent();
                    core.endGroup();
                    goFlags = process.env['GOFLAGS'];
                    if (goFlags) {
                        core.exportVariable('GOFLAGS', goFlags);
                        core.warning("Passing the GOFLAGS env parameter to the codeql/init action is deprecated. Please move this to the codeql/finish action.");
                    }
                    codeqlResultFolder = path.resolve(workspaceFolder(), 'codeql_results');
                    databaseFolder = path.resolve(codeqlResultFolder, 'db');
                    tracedLanguages = {};
                    scannedLanguages = [];
                    _i = 0, languages_2 = languages;
                    _c.label = 3;
                case 3:
                    if (!(_i < languages_2.length)) return [3 /*break*/, 8];
                    language = languages_2[_i];
                    languageDatabase = path.join(databaseFolder, language);
                    // Init language database
                    return [4 /*yield*/, exec.exec(codeqlSetup.cmd, ['database', 'init', languageDatabase, '--language=' + language, '--source-root=' + sourceRoot])];
                case 4:
                    // Init language database
                    _c.sent();
                    if (!['cpp', 'java', 'csharp'].includes(language)) return [3 /*break*/, 6];
                    return [4 /*yield*/, tracerConfig(codeqlSetup, languageDatabase)];
                case 5:
                    config_1 = _c.sent();
                    tracedLanguages[language] = config_1;
                    return [3 /*break*/, 7];
                case 6:
                    scannedLanguages.push(language);
                    _c.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8:
                    core.exportVariable(sharedEnv.CODEQL_ACTION_SCANNED_LANGUAGES, scannedLanguages.join(','));
                    tracedLanguageKeys = Object.keys(tracedLanguages);
                    if (!(tracedLanguageKeys.length > 0)) return [3 /*break*/, 12];
                    mainTracerConfig = concatTracerConfigs(tracedLanguages);
                    if (!mainTracerConfig.spec) return [3 /*break*/, 12];
                    for (_a = 0, _b = Object.entries(mainTracerConfig.env); _a < _b.length; _a++) {
                        entry = _b[_a];
                        core.exportVariable(entry[0], entry[1]);
                    }
                    core.exportVariable('ODASA_TRACER_CONFIGURATION', mainTracerConfig.spec);
                    if (!(process.platform === 'darwin')) return [3 /*break*/, 9];
                    core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlSetup.tools, 'osx64', 'libtrace.dylib'));
                    return [3 /*break*/, 12];
                case 9:
                    if (!(process.platform === 'win32')) return [3 /*break*/, 11];
                    return [4 /*yield*/, exec.exec('powershell', [path.resolve(__dirname, '..', 'src', 'inject-tracer.ps1'),
                            path.resolve(codeqlSetup.tools, 'win64', 'tracer.exe')], { env: { 'ODASA_TRACER_CONFIGURATION': mainTracerConfig.spec } })];
                case 10:
                    _c.sent();
                    return [3 /*break*/, 12];
                case 11:
                    core.exportVariable('LD_PRELOAD', path.join(codeqlSetup.tools, 'linux64', '${LIB}trace.so'));
                    _c.label = 12;
                case 12:
                    // TODO: make this a "private" environment variable of the action
                    core.exportVariable('CODEQL_ACTION_RESULTS', codeqlResultFolder);
                    core.exportVariable('CODEQL_ACTION_CMD', codeqlSetup.cmd);
                    return [3 /*break*/, 14];
                case 13:
                    error_1 = _c.sent();
                    core.setFailed(error_1.message);
                    return [3 /*break*/, 14];
                case 14: return [2 /*return*/];
            }
        });
    });
}
void run();
