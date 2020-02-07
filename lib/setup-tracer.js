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
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const setuptools = __importStar(require("./setup-tools"));
const CRITICAL_TRACER_VARS = new Set(['SEMMLE_PRELOAD_libtrace',
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
    return __awaiter(this, void 0, void 0, function* () {
        const compilerSpecArg = compilerSpec ? ["--compiler-spec=" + compilerSpec] : [];
        let envFile = path.resolve(database, 'working', 'env.tmp');
        yield exec.exec(codeql.cmd, ['database', 'trace-command', database,
            ...compilerSpecArg,
            process.execPath, path.resolve(__dirname, 'tracer-env.js'), envFile]);
        const env = JSON.parse(fs.readFileSync(envFile, 'utf-8'));
        const config = env['ODASA_TRACER_CONFIGURATION'];
        const info = { spec: config, env: {} };
        // Extract critical tracer variables from the environment
        for (let entry of Object.entries(env)) {
            const key = entry[0];
            const value = entry[1];
            // skip ODASA_TRACER_CONFIGURATION as it is handled separately
            if (key == 'ODASA_TRACER_CONFIGURATION') {
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
        return info;
    });
}
function concatTracerConfigs(configs) {
    // A tracer config is a map containing additional environment variables and a tracer 'spec' file.
    // A tracer 'spec' file has the following format [log_file, number_of_blocks, blocks_text]
    // Merge the environments
    const env = {};
    var envSize = 0;
    for (let v of Object.values(configs)) {
        for (let e of Object.entries(v.env)) {
            const name = e[0];
            const value = e[1];
            if (name in env) {
                if (env[name] !== value) {
                    throw Error('Incompatible values in environment parameter ' + name + ' ' + env[name] + ' and ' + value);
                }
            }
            else {
                env[name] = value;
                envSize += 1;
            }
        }
    }
    // Concatenate spec files into a new spec file
    let languages = Object.keys(configs);
    const cppIndex = languages.indexOf('cpp');
    // Make sure cpp is the last language, if it's present since it must be concatenated last
    if (cppIndex !== -1) {
        let lastLang = languages[languages.length - 1];
        languages[languages.length - 1] = languages[cppIndex];
        languages[cppIndex] = lastLang;
    }
    let totalLines = [];
    let totalCount = 0;
    for (let lang of languages) {
        const lines = fs.readFileSync(configs[lang].spec, 'utf8').split(/\r?\n/);
        const count = parseInt(lines[1], 10);
        totalCount += count;
        totalLines.push(...lines.slice(2));
    }
    const newLogFilePath = path.resolve(workspaceFolder(), 'compound-build-tracer.log');
    const spec = path.resolve(workspaceFolder(), 'compound-spec');
    const newSpecContent = [newLogFilePath, totalCount.toString(10), ...totalLines];
    fs.writeFileSync(spec, newSpecContent.join('\n'));
    // Write the compound environment
    const envPath = spec + '.environment';
    appendInt32BE(envPath, envSize);
    for (let e of Object.entries(env)) {
        const key = e[0];
        const value = String(e[1]);
        appendInt32BE(envPath, key.length + value.length + 2);
        fs.appendFileSync(envPath, key + '=' + value + '\0');
    }
    return { env, spec };
}
function appendInt32BE(path, value) {
    var b = Buffer.alloc(4);
    b.writeInt32BE(value, 0);
    fs.appendFileSync(path, b);
}
function workspaceFolder() {
    let workspaceFolder = process.env['RUNNER_WORKSPACE'];
    if (!workspaceFolder)
        workspaceFolder = path.resolve('..');
    return workspaceFolder;
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let languages = core.getInput('language', { required: true }).split(',');
            languages = languages.map(x => x.trim()).filter(x => x.length > 0);
            const sourceRoot = path.resolve();
            core.startGroup('Setup CodeQL tools');
            const codeqlSetup = yield setuptools.setupCodeQL();
            core.endGroup();
            const codeqlResultFolder = path.resolve(workspaceFolder(), 'codeql_results');
            const databaseFolder = path.resolve(codeqlResultFolder, 'db');
            let tracedLanguages = {};
            // TODO: replace this code once CodeQL supports multi-language tracing
            for (let language of languages) {
                const languageDatabase = path.join(databaseFolder, language);
                // TODO: add better detection of 'traced languages' instead of using a hard coded list
                if (['cpp', 'java', 'csharp'].includes(language)) {
                    yield exec.exec(codeqlSetup.cmd, ['database', 'init', languageDatabase, '--language=' + language, '--source-root=' + sourceRoot]);
                    const config = yield tracerConfig(codeqlSetup, languageDatabase);
                    tracedLanguages[language] = config;
                }
                else {
                    yield exec.exec(codeqlSetup.cmd, ['database', 'create', languageDatabase,
                        '--language=' + language, '--source-root=' + sourceRoot]);
                }
            }
            const tracedLanguageKeys = Object.keys(tracedLanguages);
            if (tracedLanguageKeys.length > 0) {
                core.exportVariable('CODEQL_ACTION_TRACED_LANGUAGES', tracedLanguageKeys.join(','));
                const mainTracerConfig = concatTracerConfigs(tracedLanguages);
                if (mainTracerConfig.spec) {
                    for (let entry of Object.entries(mainTracerConfig.env)) {
                        core.exportVariable(entry[0], entry[1]);
                    }
                    core.exportVariable('ODASA_TRACER_CONFIGURATION', mainTracerConfig.spec);
                    if (process.platform == 'darwin') {
                        core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlSetup.tools, 'osx64', 'libtrace.dylib'));
                    }
                    else if (process.platform == 'win32') {
                        yield exec.exec('powershell', 
                        // TODO use tracer.exe from CodeQL bundle
                        ['src\\inject-tracer.ps1', path.resolve(__dirname, '..', 'bin', 'tracer.exe')], { env: { 'ODASA_TRACER_CONFIGURATION': mainTracerConfig.spec } });
                    }
                    else {
                        core.exportVariable('LD_PRELOAD', path.join(codeqlSetup.tools, 'linux64', '${LIB}trace.so'));
                    }
                }
            }
            // TODO: make this a "private" environment variable of the action
            core.exportVariable('CODEQL_ACTION_RESULTS', codeqlResultFolder);
            core.exportVariable('CODEQL_ACTION_CMD', codeqlSetup.cmd);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
