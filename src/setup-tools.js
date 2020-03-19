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
var toolcache = require("@actions/tool-cache");
var path = require("path");
var CodeQLSetup = /** @class */ (function () {
    function CodeQLSetup(codeqlDist) {
        this.dist = codeqlDist;
        this.tools = path.join(this.dist, 'tools');
        this.cmd = path.join(codeqlDist, 'codeql');
        // TODO check process.arch ?
        if (process.platform === 'win32') {
            this.platform = 'win64';
            if (this.cmd.endsWith('codeql')) {
                this.cmd += ".cmd";
            }
        }
        else if (process.platform === 'linux') {
            this.platform = 'linux64';
        }
        else if (process.platform === 'darwin') {
            this.platform = 'osx64';
        }
        else {
            throw new Error("Unsupported plaform: " + process.platform);
        }
    }
    return CodeQLSetup;
}());
exports.CodeQLSetup = CodeQLSetup;
function setupCodeQL() {
    return __awaiter(this, void 0, void 0, function () {
        var version, codeqlURL, codeqlFolder, codeqlPath, codeqlExtracted;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    version = '1.0.0';
                    codeqlURL = core.getInput('tools', { required: true });
                    codeqlFolder = toolcache.find('CodeQL', version);
                    if (!codeqlFolder) return [3 /*break*/, 1];
                    core.debug("CodeQL found in cache " + codeqlFolder);
                    return [3 /*break*/, 5];
                case 1: return [4 /*yield*/, toolcache.downloadTool(codeqlURL)];
                case 2:
                    codeqlPath = _a.sent();
                    return [4 /*yield*/, toolcache.extractZip(codeqlPath)];
                case 3:
                    codeqlExtracted = _a.sent();
                    return [4 /*yield*/, toolcache.cacheDir(codeqlExtracted, 'CodeQL', version)];
                case 4:
                    codeqlFolder = _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/, new CodeQLSetup(path.join(codeqlFolder, 'codeql'))];
            }
        });
    });
}
exports.setupCodeQL = setupCodeQL;
