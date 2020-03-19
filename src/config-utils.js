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
var io = require("@actions/io");
var fs = require("fs");
var yaml = require("js-yaml");
var path = require("path");
var ExternalQuery = /** @class */ (function () {
    function ExternalQuery(repository, ref) {
        this.path = '';
        this.repository = repository;
        this.ref = ref;
    }
    return ExternalQuery;
}());
exports.ExternalQuery = ExternalQuery;
var Config = /** @class */ (function () {
    function Config() {
        this.name = "";
        this.inRepoQueries = [];
        this.externalQueries = [];
        this.pathsIgnore = [];
        this.paths = [];
    }
    Config.prototype.addQuery = function (queryUses) {
        // The logic for parsing the string is based on what actions does for
        // parsing the 'uses' actions in the workflow file
        if (queryUses === "") {
            throw '"uses" value for queries cannot be blank';
        }
        if (queryUses.startsWith("./")) {
            this.inRepoQueries.push(queryUses.slice(2));
            return;
        }
        var tok = queryUses.split('@');
        if (tok.length !== 2) {
            throw '"uses" value for queries must be a path, or owner/repo@ref \n Found: ' + queryUses;
        }
        var ref = tok[1];
        tok = tok[0].split('/');
        // The first token is the owner
        // The second token is the repo
        // The rest is a path, if there is more than one token combine them to form the full path
        if (tok.length > 3) {
            tok = [tok[0], tok[1], tok.slice(2).join('/')];
        }
        if (tok.length < 2) {
            throw '"uses" value for queries must be a path, or owner/repo@ref \n Found: ' + queryUses;
        }
        var external = new ExternalQuery(tok[0] + '/' + tok[1], ref);
        if (tok.length === 3) {
            external.path = tok[2];
        }
        this.externalQueries.push(external);
    };
    return Config;
}());
exports.Config = Config;
var configFolder = process.env['RUNNER_WORKSPACE'] || '/tmp/codeql-action';
function initConfig() {
    var configFile = core.getInput('config-file');
    var config = new Config();
    // If no config file was provided create an empty one
    if (configFile === '') {
        core.debug('No configuration file was provided');
        return config;
    }
    try {
        var parsedYAML = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'));
        if (parsedYAML.name && typeof parsedYAML.name === "string") {
            config.name = parsedYAML.name;
        }
        var queries = parsedYAML.queries;
        if (queries && queries instanceof Array) {
            queries.forEach(function (query) {
                if (query.uses && typeof query.uses === "string") {
                    config.addQuery(query.uses);
                }
            });
        }
        var pathsIgnore = parsedYAML['paths-ignore'];
        if (pathsIgnore && queries instanceof Array) {
            pathsIgnore.forEach(function (path) {
                if (typeof path === "string") {
                    config.pathsIgnore.push(path);
                }
            });
        }
        var paths = parsedYAML.paths;
        if (paths && paths instanceof Array) {
            paths.forEach(function (path) {
                if (typeof path === "string") {
                    config.paths.push(path);
                }
            });
        }
    }
    catch (err) {
        core.setFailed(err);
    }
    return config;
}
function saveConfig(config) {
    return __awaiter(this, void 0, void 0, function () {
        var configString;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    configString = JSON.stringify(config);
                    return [4 /*yield*/, io.mkdirP(configFolder)];
                case 1:
                    _a.sent();
                    fs.writeFileSync(path.join(configFolder, 'config'), configString, 'utf8');
                    core.debug('Saved config:');
                    core.debug(configString);
                    return [2 /*return*/];
            }
        });
    });
}
function loadConfig() {
    return __awaiter(this, void 0, void 0, function () {
        var configFile, configString, config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    configFile = path.join(configFolder, 'config');
                    if (!fs.existsSync(configFile)) return [3 /*break*/, 1];
                    configString = fs.readFileSync(configFile, 'utf8');
                    core.debug('Loaded config:');
                    core.debug(configString);
                    return [2 /*return*/, JSON.parse(configString)];
                case 1:
                    config = initConfig();
                    core.debug('Initialized config:');
                    core.debug(JSON.stringify(config));
                    return [4 /*yield*/, saveConfig(config)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, config];
            }
        });
    });
}
exports.loadConfig = loadConfig;
