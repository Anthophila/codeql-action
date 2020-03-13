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
const file_url_1 = __importDefault(require("file-url"));
const fs = __importStar(require("fs"));
const zlib_1 = __importDefault(require("zlib"));
const fingerprints = __importStar(require("./fingerprints"));
function upload_sarif(sarifFile) {
    return __awaiter(this, void 0, void 0, function* () {
        core.startGroup("Uploading results");
        try {
            // The upload may happen in the finish or upload-sarif actions but we only want
            // the file to be uploaded once, so we create an extra file next to it to mark
            // that the file has been uploaded and should be skipped if encountered again.
            const alreadyUploadedSentinelFile = sarifFile + '.uploaded';
            if (fs.existsSync(alreadyUploadedSentinelFile)) {
                // Already uploaded
                core.debug('Skipping upload of "' + sarifFile + '", already uploaded');
                return;
            }
            const commitOid = get_required_env_param('GITHUB_SHA');
            const workflowRunIDStr = get_required_env_param('GITHUB_RUN_ID');
            const ref = get_required_env_param('GITHUB_REF'); // it's in the form "refs/heads/master"
            const analysisName = get_required_env_param('GITHUB_WORKFLOW');
            if (commitOid === undefined
                || workflowRunIDStr === undefined
                || ref === undefined
                || analysisName === undefined) {
                return;
            }
            let sarifPayload = fs.readFileSync(sarifFile).toString();
            sarifPayload = fingerprints.addFingerprints(sarifPayload);
            const zipped_sarif = zlib_1.default.gzipSync(sarifPayload).toString('base64');
            let checkoutPath = core.getInput('checkout_path');
            let checkoutURI = file_url_1.default(checkoutPath);
            const workflowRunID = parseInt(workflowRunIDStr, 10);
            if (Number.isNaN(workflowRunID)) {
                core.setFailed('GITHUB_RUN_ID must define a non NaN workflow run ID');
                return;
            }
            const payload = JSON.stringify({
                "commit_oid": commitOid,
                "ref": ref,
                "analysis_name": analysisName,
                "sarif": zipped_sarif,
                "workflow_run_id": workflowRunID,
                "checkout_uri": checkoutURI,
            });
            core.info('Uploading results');
            const githubToken = core.getInput('token');
            const ph = new auth.BearerCredentialHandler(githubToken);
            const client = new http.HttpClient('Code Scanning : Upload SARIF', [ph]);
            const url = 'https://api.github.com/repos/' + process.env['GITHUB_REPOSITORY'] + '/code_scanning/analysis';
            const res = yield client.put(url, payload);
            core.debug('response status: ' + res.message.statusCode);
            if (res.message.statusCode === 500) {
                // If the upload fails with 500 then we assume it is a temporary problem
                // with turbo-scan and not an error that the user has caused or can fix.
                // We avoid marking the job as failed to avoid breaking CI workflows.
                core.error('Upload failed: ' + (yield res.readBody()));
            }
            else if (res.message.statusCode !== 202) {
                core.setFailed('Upload failed: ' + (yield res.readBody()));
            }
            else {
                core.info("Successfully uploaded results");
            }
            // Mark the sarif file as uploaded
            fs.writeFileSync(alreadyUploadedSentinelFile, '');
        }
        catch (error) {
            core.setFailed(error.message);
        }
        core.endGroup();
    });
}
exports.upload_sarif = upload_sarif;
// Get an environment parameter, and fail the action if it has no value
function get_required_env_param(paramName) {
    const value = process.env[paramName];
    if (value === undefined) {
        core.setFailed(paramName + ' environment variable must be set');
    }
    core.debug(paramName + '=' + value);
    return value;
}
