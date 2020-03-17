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
const io = __importStar(require("@actions/io"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const configUtils = __importStar(require("./config-utils"));
const sharedEnv = __importStar(require("./shared-environment"));
const upload_lib = __importStar(require("./upload-lib"));
const util = __importStar(require("./util"));
function appendSarifRuns(combinedSarif, newSarifRuns) {
    // Check SARIF version
    if (combinedSarif.version === null) {
        combinedSarif.version = newSarifRuns.version;
    }
    else if (combinedSarif.version !== newSarifRuns.version) {
        throw "Different SARIF versions encountered: " + combinedSarif.version + " and " + newSarifRuns.version;
    }
    combinedSarif.runs.push(...newSarifRuns.runs);
}
function finalizeDatabaseCreation(codeqlCmd, databaseFolder) {
    return __awaiter(this, void 0, void 0, function* () {
        // Create db for scanned languages
        const scannedLanguages = process.env[sharedEnv.CODEQL_ACTION_SCANNED_LANGUAGES];
        if (scannedLanguages) {
            for (const language of scannedLanguages.split(',')) {
                core.startGroup('Extracting ' + language);
                // Get extractor location
                let extractorPath = '';
                yield exec.exec(codeqlCmd, ['resolve', 'extractor', '--format=json', '--language=' + language], {
                    silent: true,
                    listeners: {
                        stdout: (data) => { extractorPath += data.toString(); },
                        stderr: (data) => { process.stderr.write(data); }
                    }
                });
                // Set trace command
                const ext = process.platform === 'win32' ? '.cmd' : '.sh';
                const traceCommand = path.resolve(JSON.parse(extractorPath), 'tools', 'autobuild' + ext);
                // Run trace command
                yield exec.exec(codeqlCmd, ['database', 'trace-command', path.join(databaseFolder, language), '--', traceCommand]);
                core.endGroup();
            }
        }
        const languages = process.env[sharedEnv.CODEQL_ACTION_LANGUAGES] || '';
        for (const language of languages.split(',')) {
            core.startGroup('Finalizing ' + language);
            yield exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, language)]);
            core.endGroup();
        }
    });
}
function runQueries(codeqlCmd, resultsFolder, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const databaseFolder = path.join(resultsFolder, 'db');
        let combinedSarif = {
            version: null,
            runs: []
        };
        const sarifFolder = path.join(resultsFolder, 'sarif');
        yield io.mkdirP(sarifFolder);
        for (let database of fs.readdirSync(databaseFolder)) {
            core.startGroup('Analyzing ' + database);
            const sarifFile = path.join(sarifFolder, database + '.sarif');
            yield exec.exec(codeqlCmd, ['database', 'analyze', path.join(databaseFolder, database),
                '--format=sarif-latest', '--output=' + sarifFile,
                '--no-sarif-add-snippets',
                database + '-lgtm.qls',
                ...config.inRepoQueries]);
            let sarifObject = JSON.parse(fs.readFileSync(sarifFile, 'utf8'));
            appendSarifRuns(combinedSarif, sarifObject);
            core.debug('SARIF results for database ' + database + ' created at "' + sarifFile + '"');
            core.endGroup();
        }
        return combinedSarif;
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (util.should_abort('finish') || !(yield util.reportActionStarting('finish'))) {
                return;
            }
            const config = yield configUtils.loadConfig();
            core.exportVariable(sharedEnv.ODASA_TRACER_CONFIGURATION, '');
            delete process.env[sharedEnv.ODASA_TRACER_CONFIGURATION];
            const codeqlCmd = process.env[sharedEnv.CODEQL_ACTION_CMD] || 'CODEQL_ACTION_CMD';
            const resultsFolder = process.env[sharedEnv.CODEQL_ACTION_RESULTS] || 'CODEQL_ACTION_RESULTS';
            const databaseFolder = path.join(resultsFolder, 'db');
            core.info('Finalizing database creation');
            yield finalizeDatabaseCreation(codeqlCmd, databaseFolder);
            core.info('Analyzing database');
            const sarifResults = yield runQueries(codeqlCmd, resultsFolder, config);
            const sarifPayload = JSON.stringify(sarifResults);
            // Write analysis result to a file
            const outputFile = core.getInput('output_file');
            yield io.mkdirP(path.dirname(outputFile));
            fs.writeFileSync(outputFile, sarifPayload);
            if ('true' === core.getInput('upload')) {
                yield upload_lib.upload_sarif(outputFile);
            }
        }
        catch (error) {
            core.setFailed(error.message);
            yield util.reportActionFailed('finish', 'unspecified');
            return;
        }
        yield util.reportActionSucceeded('finish');
    });
}
void run();
