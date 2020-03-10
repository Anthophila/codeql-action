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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const io = __importStar(require("@actions/io"));
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
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
    return __awaiter(this, void 0, void 0, function* () {
        const configString = JSON.stringify(config);
        yield io.mkdirP(configFolder);
        fs.writeFileSync(path.join(configFolder, 'config'), configString, 'utf8');
        core.debug('Saved config:');
        core.debug(configString);
    });
}
exports.saveConfig = saveConfig;
function loadConfig() {
    const configString = fs.readFileSync(path.join(configFolder, 'config'), 'utf8');
    core.debug('Loaded config:');
    core.debug(configString);
    return JSON.parse(configString);
}
exports.loadConfig = loadConfig;
