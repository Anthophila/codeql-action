"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
class Config {
    constructor() {
        this.name = "";
        this.queries = [];
        this.pathsIgnore = [];
        this.paths = [];
    }
}
exports.Config = Config;
const configPath = '/tmp/codeql-action/config';
function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config), 'utf8');
}
exports.saveConfig = saveConfig;
function loadConfig() {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}
exports.loadConfig = loadConfig;
