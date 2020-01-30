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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function run() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let sarifFolder = core.getInput('sarif_folder', { required: true });
        const commitOid = process.env['GITHUB_SHA'];
        if (commitOid == null) {
            core.setFailed('GITHUB_SHA environment variable must be set');
            return;
        }
        // Its in the form of 'refs/heads/master'
        let prefix = 'refs/heads/';
        let branchName = process.env['GITHUB_REF'];
        if (branchName == null) {
            core.setFailed('GITHUB_REF environment variable must be set');
            return;
        }
        if (((_a = branchName) === null || _a === void 0 ? void 0 : _a.substr(0, prefix.length)) === prefix) {
            branchName = branchName.substr(prefix.length);
        }
        // Get repoID
        yield exec.exec('curl', ['-H', 'Authorization: Bearer ' + process.env['GITHUB_TOKEN'],
            'https://api.github.com/repos/' + process.env['GITHUB_REPOSITORY'],
            '-o', '/tmp/getRepo']);
        let raw = fs.readFileSync('/tmp/getRepo').toString();
        let repoInfo = JSON.parse(raw);
        let repoID = repoInfo['id'];
        let analysisName = process.env['GITHUB_WORKFLOW'];
        if (analysisName == null) {
            core.setFailed('GITHUB_WORKFLOW environment variable must be set');
            return;
        }
        for (let sarifFile of fs.readdirSync(sarifFolder)) {
            exec.exec('curl', ['-f',
                'https://turbo-scan.githubapp.com/upload?repository_id=' + encodeURIComponent(repoID) +
                    '&commit_oid=' + encodeURIComponent(commitOid) + '&branch_name=' + encodeURIComponent(branchName) +
                    '&analysis_name=' + encodeURIComponent(analysisName),
                '-v',
                '-H', 'Authorization: Bearer ' + process.env['GITHUB_TOKEN'],
                '-d', '@' + path.join(sarifFolder, sarifFile)]).catch(reason => {
                core.setFailed('Curl command failed: ' + reason);
            });
        }
    });
}
run();
