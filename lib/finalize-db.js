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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function appendSarifRuns(combinedSarif, newSarifRuns) {
    // Check SARIF version
    if (combinedSarif.version === null) {
        combinedSarif.version = newSarifRuns.version;
        core.debug("Sarif version set to " + JSON.stringify(combinedSarif.version));
    }
    else if (combinedSarif.version !== newSarifRuns.version) {
        throw "Different SARIF versions encountered: " + combinedSarif.version + " and " + newSarifRuns.version;
    }
    combinedSarif.runs.push(...newSarifRuns.runs);
}
function finalizeDatabaseCreation(codeqlCmd, databaseFolder) {
    return __awaiter(this, void 0, void 0, function* () {
        // Create db for scanned languages
        const scannedLanguages = process.env['CODEQL_ACTION_SCANNED_LANGUAGES'];
        if (scannedLanguages) {
            for (const language of scannedLanguages.split(',')) {
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
                const ext = process.platform == 'win32' ? '.cmd' : '.sh';
                const traceCommand = path.resolve(JSON.parse(extractorPath), 'tools', 'autobuild' + ext);
                // Run trace command
                yield exec.exec(codeqlCmd, ['database', 'trace-command', path.join(databaseFolder, language), '--', traceCommand]);
            }
        }
        const languages = process.env['CODEQL_ACTION_LANGUAGES'];
        if (languages) {
            for (const language of languages.split(',')) {
                yield exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, language)]);
            }
        }
    });
}
function runQueries(codeqlCmd, resultsFolder) {
    return __awaiter(this, void 0, void 0, function* () {
        const databaseFolder = path.join(resultsFolder, 'db');
        let combinedSarif = {
            version: null,
            runs: []
        };
        const sarifFolder = path.join(resultsFolder, 'sarif');
        io.mkdirP(sarifFolder);
        for (let database of fs.readdirSync(databaseFolder)) {
            const sarifFile = path.join(sarifFolder, database + '.sarif');
            yield exec.exec(codeqlCmd, ['database', 'analyze', path.join(databaseFolder, database),
                '--format=sarif-latest', '--output=' + sarifFile,
                '--sarif-add-snippets',
                database + '-lgtm.qls']);
            let sarifObject = JSON.parse(fs.readFileSync(sarifFile, 'utf8'));
            appendSarifRuns(combinedSarif, sarifObject);
            core.debug('SARIF results for database ' + database + ' created at "' + sarifFile + '"');
        }
        return combinedSarif;
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(process.env);
            core.exportVariable('ODASA_TRACER_CONFIGURATION', '');
            delete process.env['ODASA_TRACER_CONFIGURATION'];
            const codeqlCmd = process.env['CODEQL_ACTION_CMD'] || 'CODEQL_ACTION_CMD';
            const resultsFolder = process.env['CODEQL_ACTION_RESULTS'] || 'CODEQL_ACTION_RESULTS';
            const databaseFolder = path.join(resultsFolder, 'db');
            core.startGroup('Finalize database creation');
            yield finalizeDatabaseCreation(codeqlCmd, databaseFolder);
            core.endGroup();
            core.startGroup('Analyze database');
            const sarifResults = yield runQueries(codeqlCmd, resultsFolder);
            core.endGroup();
            // Write analysis result to a file
            const outputFile = core.getInput('output_file');
            io.mkdirP(path.dirname(outputFile));
            fs.writeFileSync(outputFile, JSON.stringify(sarifResults));
            core.debug('Analysis results: ');
            core.debug(JSON.stringify(sarifResults));
            core.debug('Analysis results stored in: ' + outputFile);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
