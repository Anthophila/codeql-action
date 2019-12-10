"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const github = __importStar(require("@actions/github"));
const io = __importStar(require("@actions/io"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const jszip_1 = __importDefault(require("jszip"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            core.exportVariable('ODASA_TRACER_CONFIGURATION', '');
            delete process.env['ODASA_TRACER_CONFIGURATION'];
            const codeqlCmd = process.env['CODEQL_ACTION_CMD'] || 'CODEQL_ACTION_CMD';
            const resultsFolder = process.env['CODEQL_ACTION_RESULTS'] || 'CODEQL_ACTION_RESULTS';
            const tracedLanguage = process.env['CODEQL_ACTION_TRACED_LANGUAGE'];
            const databaseFolder = path.join(resultsFolder, 'db');
            if (tracedLanguage) {
                yield exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, tracedLanguage)]);
            }
            const sarifFolder = path.join(resultsFolder, 'sarif');
            io.mkdirP(sarifFolder);
            const zip = new jszip_1.default();
            for (let database of fs.readdirSync(databaseFolder)) {
                const sarifFile = path.join(sarifFolder, database + '.sarif');
                yield exec.exec(codeqlCmd, ['database', 'analyze', path.join(databaseFolder, database),
                    '--format=sarif-latest', '--output=' + sarifFile,
                    database + '-lgtm.qls']);
                const sarif_data = fs.readFileSync(sarifFile, 'utf8');
                zip.file(database + '.sarif', sarif_data);
            }
            const zipped_sarif = yield zip.generateAsync({ type: "base64", compression: "DEFLATE" });
            const { GITHUB_TOKEN, GITHUB_REF } = process.env;
            if (GITHUB_TOKEN && GITHUB_REF) {
                const octokit = new github.GitHub(GITHUB_TOKEN);
                const { data: checks } = yield octokit.checks.listForRef(Object.assign({}, github.context.repo, { ref: GITHUB_REF }));
                const check_name = core.getInput('check_name');
                const check_run_id = checks.check_runs.filter(check => check.name === check_name)[0].id;
                // this way we make sure to gte the id for *this* check run, 
                // as opposed to the first cehck run in the same check suite
                // this run belongs to
                console.log(Object.assign({}, github.context.repo, { check_run_id, output: {
                        title: 'SARIF alerts in a base64 zip',
                        summary: 'base64 zip',
                        text: zipped_sarif.length
                    } }));
                yield octokit.checks.update(Object.assign({}, github.context.repo, { check_run_id, output: {
                        title: 'SARIF alerts in a base64 zip',
                        summary: 'base64 zip',
                        text: zipped_sarif
                    } }));
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
