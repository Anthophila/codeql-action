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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const http = __importStar(require("@actions/http-client"));
const auth = __importStar(require("@actions/http-client/auth"));
const fs = __importStar(require("fs"));
const zlib_1 = __importDefault(require("zlib"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const commitOid = process.env['GITHUB_SHA'];
            if (commitOid == null) {
                core.setFailed('GITHUB_SHA environment variable must be set');
                return;
            }
            core.debug('commitOid: ' + commitOid);
            // Its in the form of 'refs/heads/master'
            const branchName = process.env['GITHUB_REF'];
            if (branchName == null) {
                core.setFailed('GITHUB_REF environment variable must be set');
                return;
            }
            core.debug('branchName: ' + branchName);
            const analysisName = process.env['GITHUB_WORKFLOW'];
            if (analysisName == null) {
                core.setFailed('GITHUB_WORKFLOW environment variable must be set');
                return;
            }
            core.debug('analysisName: ' + analysisName);
            const githubToken = process.env['GITHUB_TOKEN'];
            if (githubToken == null) {
                core.setFailed('GITHUB_TOKEN environment variable must be set');
                return;
            }
            const sarifFile = core.getInput('sarif_file');
            const sarifPayload = fs.readFileSync(sarifFile).toString();
            const zipped_sarif = zlib_1.default.gzipSync(sarifPayload).toString('base64');
            const payload = JSON.stringify({
                "commit_oid": commitOid,
                "branch_name": branchName,
                "ref": branchName,
                "analysis_name": analysisName,
                "sarif": zipped_sarif
            });
            core.debug(payload);
            const ph = new auth.BearerCredentialHandler(githubToken);
            const client = new http.HttpClient('Code Scanning : Upload SARIF', [ph]);
            const url = 'https://api.github.com/repos/' + process.env['GITHUB_REPOSITORY'] + '/code_scanning/analysis';
            const res = yield client.put(url, payload);
            core.debug('response status: ' + res.message.statusCode);
            if (res.message.statusCode == 500) {
                core.error('Upload failed: ' + (yield res.readBody()));
            }
            else if (res.message.statusCode != 202) {
                core.setFailed('Upload failed: ' + (yield res.readBody()));
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
