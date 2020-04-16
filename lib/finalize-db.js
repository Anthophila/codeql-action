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
function checkoutExternalQueries(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const folder = process.env['RUNNER_WORKSPACE'] || '/tmp/codeql-action';
        for (const externalQuery of config.externalQueries) {
            core.info('Checking out ' + externalQuery.repository);
            const checkoutLocation = path.join(folder, externalQuery.repository);
            if (!fs.existsSync(checkoutLocation)) {
                const repoURL = 'https://github.com/' + externalQuery.repository + '.git';
                yield exec.exec('git', ['clone', repoURL, checkoutLocation]);
                yield exec.exec('git', ['--git-dir=' + checkoutLocation + '/.git', 'checkout', externalQuery.ref]);
            }
            config.additionalQueries.push(path.join(checkoutLocation, externalQuery.path));
        }
    });
}
function resolveQueryLanguages(codeqlCmd, config) {
    return __awaiter(this, void 0, void 0, function* () {
        let res = new Map();
        if (config.additionalQueries.length !== 0) {
            let resolveQueriesOutput = '';
            const options = {
                listeners: {
                    stdout: (data) => {
                        resolveQueriesOutput += data.toString();
                    }
                }
            };
            yield exec.exec(codeqlCmd, [
                'resolve',
                'queries',
                ...config.additionalQueries,
                '--format=bylanguage'
            ], options);
            const resolveQueriesOutputObject = JSON.parse(resolveQueriesOutput);
            const byLanguage = resolveQueriesOutputObject.byLanguage;
            const languages = Object.keys(byLanguage);
            for (const language of languages) {
                const queries = Object.keys(byLanguage[language]);
                res[language] = queries;
            }
            const noDeclaredLanguage = resolveQueriesOutputObject.noDeclaredLanguage;
            const noDeclaredLanguageQueries = Object.keys(noDeclaredLanguage);
            if (noDeclaredLanguageQueries.length !== 0) {
                core.warning('Some queries do not declare a language:\n' + noDeclaredLanguageQueries.join('\n'));
            }
            const multipleDeclaredLanguages = resolveQueriesOutputObject.multipleDeclaredLanguages;
            const multipleDeclaredLanguagesQueries = Object.keys(multipleDeclaredLanguages);
            if (multipleDeclaredLanguagesQueries.length !== 0) {
                core.warning('Some queries declare multiple languages:\n' + multipleDeclaredLanguagesQueries.join('\n'));
            }
        }
        return res;
    });
}
// Runs queries and creates sarif files in the given folder
function runQueries(codeqlCmd, databaseFolder, sarifFolder, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const queriesPerLanguage = yield resolveQueryLanguages(codeqlCmd, config);
        for (let database of fs.readdirSync(databaseFolder)) {
            core.startGroup('Analyzing ' + database);
            const additionalQueries = queriesPerLanguage[database] || [];
            const sarifFile = path.join(sarifFolder, database + '.sarif');
            yield exec.exec(codeqlCmd, [
                'database',
                'analyze',
                path.join(databaseFolder, database),
                '--format=sarif-latest',
                '--output=' + sarifFile,
                '--no-sarif-add-snippets',
                database + '-code-scanning.qls',
                ...additionalQueries,
            ]);
            core.debug('SARIF results for database ' + database + ' created at "' + sarifFile + '"');
            core.endGroup();
        }
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (util.should_abort('finish', true) || !(yield util.reportActionStarting('finish'))) {
                return;
            }
            const config = yield configUtils.loadConfig();
            core.exportVariable(sharedEnv.ODASA_TRACER_CONFIGURATION, '');
            delete process.env[sharedEnv.ODASA_TRACER_CONFIGURATION];
            const codeqlCmd = util.get_required_env_param(sharedEnv.CODEQL_ACTION_CMD);
            const databaseFolder = util.get_required_env_param(sharedEnv.CODEQL_ACTION_DATABASE_DIR);
            const sarifFolder = core.getInput('output');
            yield io.mkdirP(sarifFolder);
            core.info('Finalizing database creation');
            yield finalizeDatabaseCreation(codeqlCmd, databaseFolder);
            yield checkoutExternalQueries(config);
            core.info('Analyzing database');
            yield runQueries(codeqlCmd, databaseFolder, sarifFolder, config);
            if ('true' === core.getInput('upload')) {
                yield upload_lib.upload(sarifFolder);
            }
        }
        catch (error) {
            core.setFailed(error.message);
            yield util.reportActionFailed('finish', error.message, error.stack);
            return;
        }
        yield util.reportActionSucceeded('finish');
    });
}
run().catch(e => {
    core.setFailed("codeql/finish action failed: " + e);
    console.log(e);
});
