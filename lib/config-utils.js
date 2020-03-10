"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Config {
    constructor() {
        this.name = "";
        this.queries = [];
        this.pathsIgnore = [];
        this.paths = [];
    }
}
exports.Config = Config;
const configFolder = process.env['RUNNER_WORKSPACE'] || '/tmp/codeql-action';
function saveConfig(config) {
    const configString = JSON.stringify(config);
    io.mkdirP(configFolder);
    fs.writeFileSync(path.join(configFolder, 'config'), configString, 'utf8');
    core.debug('Saved config:');
    core.debug(configString);
}
exports.saveConfig = saveConfig;
function loadConfig() {
    const configString = fs.readFileSync(path.join(configFolder, 'config'), 'utf8');
    core.debug('Loaded config:');
    core.debug(configString);
    return JSON.parse(configString);
}
exports.loadConfig = loadConfig;
