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
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(process.env);
            core.exportVariable('ODASA_TRACER_CONFIGURATION', '');
            delete process.env['ODASA_TRACER_CONFIGURATION'];
            const codeqlCmd = process.env['CODEQL_ACTION_CMD'] || 'CODEQL_ACTION_CMD';
            const resultsFolder = process.env['CODEQL_ACTION_RESULTS'] || 'CODEQL_ACTION_RESULTS';
            const tracedLanguages = process.env['CODEQL_ACTION_TRACED_LANGUAGES'];
            const databaseFolder = path.join(resultsFolder, 'db');
            if (tracedLanguages) {
                for (const language of tracedLanguages.split(',')) {
                    yield exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, language)]);
                }
            }
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
            core.debug('Combined SARIF file: ');
            core.debug(JSON.stringify(combinedSarif));
            const outputFile = core.getInput('output_file');
            io.mkdirP(path.dirname(outputFile));
            fs.writeFileSync(outputFile, JSON.stringify(combinedSarif));
            core.debug('Combined SARIF file stored to : ' + outputFile);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
