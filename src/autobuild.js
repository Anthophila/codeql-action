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
exports.__esModule = true;
var core = require("@actions/core");
var exec = require("@actions/exec");
var path = require("path");
var configUtils = require("./config-utils");
var sharedEnv = require("./shared-environment");
var util = require("./util");
function appendSarifRuns(combinedSarif, newSarifRuns) {
    var _a;
    // Check SARIF version
    if (combinedSarif.version === null) {
        combinedSarif.version = newSarifRuns.version;
    }
    else if (combinedSarif.version !== newSarifRuns.version) {
        throw "Different SARIF versions encountered: " + combinedSarif.version + " and " + newSarifRuns.version;
    }
    (_a = combinedSarif.runs).push.apply(_a, newSarifRuns.runs);
}
function autobuild(codeqlCmd, databaseFolder) {
    return __awaiter(this, void 0, void 0, function () {
        var scannedLanguages, _loop_1, _i, _a, language, languages, _b, _c, language;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    scannedLanguages = process.env[sharedEnv.CODEQL_ACTION_LANGUAGES];
                    if (!scannedLanguages) return [3 /*break*/, 4];
                    _loop_1 = function (language) {
                        var extractorPath_1, ext, traceCommand;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    core.startGroup('Autobuilding ' + language);
                                    if (!(language == "javascript" || language == "python" || language == "go")) return [3 /*break*/, 1];
                                    core.info(language + " does not require any additional build steps. ");
                                    return [3 /*break*/, 4];
                                case 1:
                                    extractorPath_1 = '';
                                    return [4 /*yield*/, exec.exec(codeqlCmd, ['resolve', 'extractor', '--format=json', '--language=' + language], {
                                            silent: true,
                                            listeners: {
                                                stdout: function (data) { extractorPath_1 += data.toString(); },
                                                stderr: function (data) { process.stderr.write(data); }
                                            }
                                        })];
                                case 2:
                                    _a.sent();
                                    ext = process.platform === 'win32' ? '.cmd' : '.sh';
                                    traceCommand = path.resolve(JSON.parse(extractorPath_1), 'tools', 'autobuild' + ext);
                                    // Run trace command
                                    return [4 /*yield*/, exec.exec(codeqlCmd, ['database', 'trace-command', path.join(databaseFolder, language), '--', traceCommand])];
                                case 3:
                                    // Run trace command
                                    _a.sent();
                                    core.endGroup();
                                    _a.label = 4;
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, _a = scannedLanguages.split(',');
                    _d.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    language = _a[_i];
                    return [5 /*yield**/, _loop_1(language)];
                case 2:
                    _d.sent();
                    _d.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    languages = process.env[sharedEnv.CODEQL_ACTION_LANGUAGES] || '';
                    _b = 0, _c = languages.split(',');
                    _d.label = 5;
                case 5:
                    if (!(_b < _c.length)) return [3 /*break*/, 8];
                    language = _c[_b];
                    core.startGroup('Finalizing ' + language);
                    return [4 /*yield*/, exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, language)])];
                case 6:
                    _d.sent();
                    core.endGroup();
                    _d.label = 7;
                case 7:
                    _b++;
                    return [3 /*break*/, 5];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var config, codeqlCmd, resultsFolder, databaseFolder, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    if (util.should_abort('finish')) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, configUtils.loadConfig()];
                case 1:
                    config = _a.sent();
                    core.exportVariable(sharedEnv.ODASA_TRACER_CONFIGURATION, '');
                    delete process.env[sharedEnv.ODASA_TRACER_CONFIGURATION];
                    codeqlCmd = process.env[sharedEnv.CODEQL_ACTION_CMD] || 'CODEQL_ACTION_CMD';
                    resultsFolder = process.env[sharedEnv.CODEQL_ACTION_RESULTS] || 'CODEQL_ACTION_RESULTS';
                    databaseFolder = path.join(resultsFolder, 'db');
                    core.info('Starting autobuild');
                    return [4 /*yield*/, autobuild(codeqlCmd, databaseFolder)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    core.setFailed(error_1.message);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
void run();
