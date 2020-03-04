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
const io = __importStar(require("@actions/io"));
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
class ExternalQuery {
    constructor(repository, ref) {
        this.path = '';
        this.repository = repository;
        this.ref = ref;
    }
}
exports.ExternalQuery = ExternalQuery;
class Config {
    constructor() {
        this.name = "";
        this.inRepoQueries = [];
        this.externalQueries = [];
        this.pathsIgnore = [];
        this.paths = [];
    }
    addQuery(queryUses) {
        // The logic for parsing the string is based on what actions does for 
        // parsing the 'uses' actions in the workflow file
        if (queryUses === "") {
            throw '"uses" value for queries cannot be blank';
        }
        if (queryUses.startsWith("./")) {
            this.inRepoQueries.push(queryUses.slice(2));
            return;
        }
        let tok = queryUses.split('@');
        if (tok.length !== 2) {
            throw '"uses" value for queries must be a path, or owner/repo@ref \n Found: ' + queryUses;
        }
        const ref = tok[1];
        tok = tok[0].split('/', 3);
        if (tok.length < 2) {
            throw '"uses" value for queries must be a path, or owner/repo@ref \n Found: ' + queryUses;
        }
        let external = new ExternalQuery(tok[0] + '/' + tok[1], ref);
        if (tok.length == 3) {
            external.path = tok[2];
        }
        this.externalQueries.push(external);
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
