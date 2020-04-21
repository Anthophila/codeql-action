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
const exec = __importStar(require("@actions/exec"));
const io = __importStar(require("@actions/io"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const configUtils = __importStar(require("./config-utils"));
const externalQueries = __importStar(require("./external-queries"));
const sharedEnv = __importStar(require("./shared-environment"));
const upload_lib = __importStar(require("./upload-lib"));
const util = __importStar(require("./util"));
async function finalizeDatabaseCreation(codeqlCmd, databaseFolder) {
    // Create db for scanned languages
    const scannedLanguages = process.env[sharedEnv.CODEQL_ACTION_SCANNED_LANGUAGES];
    if (scannedLanguages) {
        for (const language of scannedLanguages.split(',')) {
            core.startGroup('Extracting ' + language);
            // Get extractor location
            let extractorPath = '';
            await exec.exec(codeqlCmd, ['resolve', 'extractor', '--format=json', '--language=' + language], {
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
            await exec.exec(codeqlCmd, ['database', 'trace-command', path.join(databaseFolder, language), '--', traceCommand]);
            core.endGroup();
        }
    }
    const languages = process.env[sharedEnv.CODEQL_ACTION_LANGUAGES] || '';
    for (const language of languages.split(',')) {
        core.startGroup('Finalizing ' + language);
        await exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, language)]);
        core.endGroup();
    }
}
// Runs queries and creates sarif files in the given folder
async function runQueries(codeqlCmd, databaseFolder, sarifFolder, config) {
    for (let database of fs.readdirSync(databaseFolder)) {
        core.startGroup('Analyzing ' + database);
        const sarifFile = path.join(sarifFolder, database + '.sarif');
        await exec.exec(codeqlCmd, [
            'database',
            'analyze',
            path.join(databaseFolder, database),
            '--format=sarif-latest',
            '--output=' + sarifFile,
            '--no-sarif-add-snippets',
            database + '-code-scanning.qls',
            ...config.additionalQueries,
        ]);
        core.debug('SARIF results for database ' + database + ' created at "' + sarifFile + '"');
        core.endGroup();
    }
}
async function run() {
    try {
        if (util.should_abort('finish', true) || !await util.reportActionStarting('finish')) {
            return;
        }
        const config = await configUtils.loadConfig();
        core.exportVariable(sharedEnv.ODASA_TRACER_CONFIGURATION, '');
        delete process.env[sharedEnv.ODASA_TRACER_CONFIGURATION];
        const codeqlCmd = util.getRequiredEnvParam(sharedEnv.CODEQL_ACTION_CMD);
        const databaseFolder = util.getRequiredEnvParam(sharedEnv.CODEQL_ACTION_DATABASE_DIR);
        const sarifFolder = core.getInput('output');
        await io.mkdirP(sarifFolder);
        core.info('Finalizing database creation');
        await finalizeDatabaseCreation(codeqlCmd, databaseFolder);
        await externalQueries.CheckoutExternalQueries(config);
        core.info('Analyzing database');
        await runQueries(codeqlCmd, databaseFolder, sarifFolder, config);
        if ('true' === core.getInput('upload')) {
            await upload_lib.upload(sarifFolder);
        }
    }
    catch (error) {
        core.setFailed(error.message);
        await util.reportActionFailed('finish', error.message, error.stack);
        return;
    }
    await util.reportActionSucceeded('finish');
}
run().catch(e => {
    core.setFailed("codeql/finish action failed: " + e);
    console.log(e);
});
