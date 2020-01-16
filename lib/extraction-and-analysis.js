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
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const io = __importStar(require("@actions/io"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const setuptools = __importStar(require("./setup-tools"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            core.startGroup('Setup CodeQL tools');
            const codeqlSetup = yield setuptools.setupCodeQL();
            const language = core.getInput('language', { required: true });
            core.endGroup();
            core.startGroup('Search for auxiliary build file');
            const databasesFolder = path.resolve("codeql_dbs");
            const languageDatabase = path.join(databasesFolder, language);
            let extractionCall = ['database', 'create', languageDatabase,
                '--language=' + language];
            const buildFilePath = findAuxBuildFile(language);
            if (buildFilePath)
                extractionCall = extractionCall.concat(['--command=' + buildFilePath]);
            core.endGroup();
            core.startGroup('Create database');
            yield exec.exec(codeqlSetup.cmd, extractionCall);
            core.endGroup();
            core.startGroup('Run analysis');
            const sarifFolder = path.resolve("codeql_alerts");
            io.mkdirP(sarifFolder);
            yield exec.exec(codeqlSetup.cmd, ['database', 'analyze', languageDatabase,
                '--format=sarif-latest',
                '--no-group-results',
                '--output=' + path.join(sarifFolder, language + '.sarif'),
                language + '-lgtm.qls']);
            core.endGroup();
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
function findAuxBuildFile(language) {
    try {
        const ext = process.platform == 'win32' ? '.cmd' : '.sh';
        const buildFilePath = path.resolve('codeql-build-' + language + ext);
        if (fs.existsSync(buildFilePath))
            return buildFilePath;
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
run();
