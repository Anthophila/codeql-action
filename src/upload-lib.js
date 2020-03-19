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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var core = require("@actions/core");
var http = require("@actions/http-client");
var auth = require("@actions/http-client/auth");
var file_url_1 = require("file-url");
var fs = require("fs");
var zlib_1 = require("zlib");
var fingerprints = require("./fingerprints");
function upload_sarif(sarifFile) {
    return __awaiter(this, void 0, void 0, function () {
        var alreadyUploadedSentinelFile, commitOid, workflowRunIDStr, ref, analysisName, sarifPayload, zipped_sarif, checkoutPath, checkoutURI, workflowRunID, matrix, payload, githubToken, ph, client, url, res, _a, _b, _c, _d, _e, _f, error_1;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    core.startGroup("Uploading results");
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 8, , 9]);
                    alreadyUploadedSentinelFile = sarifFile + '.uploaded';
                    if (fs.existsSync(alreadyUploadedSentinelFile)) {
                        // Already uploaded
                        core.debug('Skipping upload of "' + sarifFile + '", already uploaded');
                        return [2 /*return*/];
                    }
                    commitOid = get_required_env_param('GITHUB_SHA');
                    workflowRunIDStr = get_required_env_param('GITHUB_RUN_ID');
                    ref = get_required_env_param('GITHUB_REF');
                    analysisName = get_required_env_param('GITHUB_WORKFLOW');
                    if (commitOid === undefined
                        || workflowRunIDStr === undefined
                        || ref === undefined
                        || analysisName === undefined) {
                        return [2 /*return*/];
                    }
                    sarifPayload = fs.readFileSync(sarifFile).toString();
                    sarifPayload = fingerprints.addFingerprints(sarifPayload);
                    zipped_sarif = zlib_1["default"].gzipSync(sarifPayload).toString('base64');
                    checkoutPath = core.getInput('checkout_path');
                    checkoutURI = file_url_1["default"](checkoutPath);
                    workflowRunID = parseInt(workflowRunIDStr, 10);
                    if (Number.isNaN(workflowRunID)) {
                        core.setFailed('GITHUB_RUN_ID must define a non NaN workflow run ID');
                        return [2 /*return*/];
                    }
                    matrix = core.getInput('matrix');
                    if (matrix === "null" || matrix === "") {
                        matrix = undefined;
                    }
                    payload = JSON.stringify({
                        "commit_oid": commitOid,
                        "ref": ref,
                        "analysis_name": analysisName,
                        "sarif": zipped_sarif,
                        "workflow_run_id": workflowRunID,
                        "checkout_uri": checkoutURI,
                        "environment": matrix
                    });
                    core.info('Uploading results');
                    githubToken = core.getInput('token');
                    ph = new auth.BearerCredentialHandler(githubToken);
                    client = new http.HttpClient('Code Scanning : Upload SARIF', [ph]);
                    url = 'https://api.github.com/repos/' + process.env['GITHUB_REPOSITORY'] + '/code_scanning/analysis';
                    return [4 /*yield*/, client.put(url, payload)];
                case 2:
                    res = _g.sent();
                    core.debug('response status: ' + res.message.statusCode);
                    if (!(res.message.statusCode === 500)) return [3 /*break*/, 4];
                    // If the upload fails with 500 then we assume it is a temporary problem
                    // with turbo-scan and not an error that the user has caused or can fix.
                    // We avoid marking the job as failed to avoid breaking CI workflows.
                    _b = (_a = core).error;
                    _c = 'Upload failed: ';
                    return [4 /*yield*/, res.readBody()];
                case 3:
                    // If the upload fails with 500 then we assume it is a temporary problem
                    // with turbo-scan and not an error that the user has caused or can fix.
                    // We avoid marking the job as failed to avoid breaking CI workflows.
                    _b.apply(_a, [_c + (_g.sent())]);
                    return [3 /*break*/, 7];
                case 4:
                    if (!(res.message.statusCode !== 202)) return [3 /*break*/, 6];
                    _e = (_d = core).setFailed;
                    _f = 'Upload failed: ';
                    return [4 /*yield*/, res.readBody()];
                case 5:
                    _e.apply(_d, [_f + (_g.sent())]);
                    return [3 /*break*/, 7];
                case 6:
                    core.info("Successfully uploaded results");
                    _g.label = 7;
                case 7:
                    // Mark the sarif file as uploaded
                    fs.writeFileSync(alreadyUploadedSentinelFile, '');
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _g.sent();
                    core.setFailed(error_1.message);
                    return [3 /*break*/, 9];
                case 9:
                    core.endGroup();
                    return [2 /*return*/];
            }
        });
    });
}
exports.upload_sarif = upload_sarif;
// Get an environment parameter, and fail the action if it has no value
function get_required_env_param(paramName) {
    var value = process.env[paramName];
    if (value === undefined) {
        core.setFailed(paramName + ' environment variable must be set');
    }
    core.debug(paramName + '=' + value);
    return value;
}
