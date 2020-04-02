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
const octokit = __importStar(require("@octokit/rest"));
const console_log_level_1 = __importDefault(require("console-log-level"));
const path = __importStar(require("path"));
const sharedEnv = __importStar(require("./shared-environment"));
/**
 * Should the current action be aborted?
 *
 * This method should be called at the start of all CodeQL actions, because
 * they should abort (without failing) when called on merge commit for a
 * pull request.
 */
function should_abort(actionName) {
    const ref = process.env['GITHUB_REF'];
    if (ref === undefined) {
        core.setFailed('GITHUB_REF must be set.');
        return true;
    }
    if (ref.startsWith('refs/pull/')) {
        core.warning('The CodeQL ' + actionName + ' action is intended for workflows triggered on `push` events, '
            + 'but the current workflow is running on a pull request. Aborting.');
        return true;
    }
    return false;
}
exports.should_abort = should_abort;
/**
 * Resolve the path to the workspace folder.
 */
function workspaceFolder() {
    let workspaceFolder = process.env['RUNNER_WORKSPACE'];
    if (!workspaceFolder)
        workspaceFolder = path.resolve('..');
    return workspaceFolder;
}
exports.workspaceFolder = workspaceFolder;
/**
 * Get an environment parameter, but throw an error if it is not set.
 */
// TODO rename to camelCase
function get_required_env_param(paramName) {
    const value = process.env[paramName];
    if (value === undefined) {
        throw new Error(paramName + ' environment variable must be set');
    }
    core.debug(paramName + '=' + value);
    return value;
}
exports.get_required_env_param = get_required_env_param;
/**
 * Gets the set of languages in the current repository
 */
function getLanguagesInRepo() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let repo_nwo = (_a = process.env['GITHUB_REPOSITORY']) === null || _a === void 0 ? void 0 : _a.split("/");
        if (repo_nwo) {
            let owner = repo_nwo[0];
            let repo = repo_nwo[1];
            core.debug(`GitHub repo ${owner} ${repo}`);
            let ok = new octokit.Octokit({
                auth: core.getInput('token'),
                userAgent: "CodeQL Action",
                log: console_log_level_1.default({ level: "debug" })
            });
            const response = yield ok.request("GET /repos/:owner/:repo/languages", ({
                owner,
                repo
            }));
            core.debug("Languages API response: " + JSON.stringify(response));
            let languages = [];
            if ("C" in response.data || "C++" in response.data) {
                languages.push("cpp");
            }
            if ("Go" in response.data) {
                languages.push("go");
            }
            if ("C#" in response.data) {
                languages.push("csharp");
            }
            if ("Python" in response.data) {
                languages.push("python");
            }
            if ("Java" in response.data) {
                languages.push("java");
            }
            if ("JavaScript" in response.data || "TypeScript" in response.data) {
                languages.push("javascript");
            }
            return languages;
        }
        else {
            return [];
        }
    });
}
/**
 * Get the languages to analyse.
 *
 * The result is obtained from the environment parameter CODEQL_ACTION_LANGUAGES
 * if that has been set, otherwise it is obtained from the action input parameter
 * 'languages' if that has been set, otherwise it is deduced as all languages in the
 * repo that can be analysed.
 *
 * If the languages are obtained from either of the second choices, the
 * CODEQL_ACTION_LANGUAGES environment variable will be exported with the
 * deduced list.
 */
function getLanguages() {
    return __awaiter(this, void 0, void 0, function* () {
        // Obtain from CODEQL_ACTION_LANGUAGES if set
        const langsVar = process.env[sharedEnv.CODEQL_ACTION_LANGUAGES];
        if (langsVar) {
            return langsVar.split(',')
                .map(x => x.trim())
                .filter(x => x.length > 0);
        }
        // Obtain from action input 'languages' if set
        let languages = core.getInput('languages', { required: false })
            .split(',')
            .map(x => x.trim())
            .filter(x => x.length > 0);
        core.info("Languages from configuration: " + JSON.stringify(languages));
        if (languages.length === 0) {
            // Obtain languages as all languages in the repo that can be analysed
            languages = yield getLanguagesInRepo();
            core.info("Automatically detected languages: " + JSON.stringify(languages));
        }
        core.exportVariable(sharedEnv.CODEQL_ACTION_LANGUAGES, languages.join(','));
        return languages;
    });
}
exports.getLanguages = getLanguages;
/**
 * Compose a StatusReport.
 *
 * @param actionName The name of the action, e.g. 'init', 'finish', 'upload-sarif'
 * @param status The status. Must be 'success', 'failure', or 'starting'
 * @param cause  Cause of failure (only supply if status is 'failure')
 * @param exception Exception (only supply if status is 'failure')
 */
function createStatusReport(actionName, status, cause, exception) {
    return __awaiter(this, void 0, void 0, function* () {
        let commitOid = process.env['GITHUB_SHA'];
        if (!commitOid) {
            commitOid = '';
        }
        const workflowRunIDStr = process.env['GITHUB_RUN_ID'];
        let workflowRunID = -1;
        if (workflowRunIDStr) {
            workflowRunID = parseInt(workflowRunIDStr, 10);
        }
        let workflowName = process.env['GITHUB_WORKFLOW'];
        if (!workflowName) {
            workflowName = '';
        }
        let jobName = process.env['GITHUB_JOB'];
        if (!jobName) {
            jobName = '';
        }
        const languages = (yield getLanguages()).sort().join(',');
        const startedAt = process.env[sharedEnv.CODEQL_ACTION_INIT_STARTED_AT];
        if (!startedAt) {
            throw new Error('Init action start date not recorded in CODEQL_ACTION_INIT_STARTED_AT');
        }
        let statusReport = {
            workflow_run_id: workflowRunID,
            workflow_name: workflowName,
            job_name: jobName,
            languages: languages,
            commit_oid: commitOid,
            action_name: actionName,
            action_oid: "unknown",
            started_at: startedAt,
            status: status
        };
        // Add optional parameters
        if (cause) {
            statusReport.cause = cause;
        }
        if (exception) {
            statusReport.exception = exception;
        }
        if (status === 'success' || status === 'failure') {
            statusReport.completed_at = new Date().toISOString();
        }
        let matrix = core.getInput('matrix');
        if (matrix) {
            statusReport.matrix_vars = matrix;
        }
        return statusReport;
    });
}
/**
 * Send a status report to the code_scanning/analysis/status endpoint.
 */
function sendStatusReport(statusReport) {
    return __awaiter(this, void 0, void 0, function* () {
        if (statusReport) {
            const statusReportJSON = JSON.stringify(statusReport);
            core.debug('Sending status report: ' + statusReportJSON);
            const githubToken = core.getInput('token');
            const ph = new auth.BearerCredentialHandler(githubToken);
            const client = new http.HttpClient('Code Scanning : Status Report', [ph]);
            const url = 'https://api.github.com/repos/' + process.env['GITHUB_REPOSITORY']
                + '/code-scanning/analysis/status';
            const res = yield client.put(url, statusReportJSON);
        }
    });
}
/**
 * Send a status report that an action is starting.
 *
 * If the action is `init` then this also records the start time in the environment,
 * and ensures that the analysed languages are also recorded in the envirenment.
 *
 * Returns true unless a problem occurred and the action should abort.
 */
function reportActionStarting(action) {
    return __awaiter(this, void 0, void 0, function* () {
        if (action === 'init') {
            // Record the start time of the init action in the environment
            core.exportVariable(sharedEnv.CODEQL_ACTION_INIT_STARTED_AT, new Date().toISOString());
        }
        const statusReport = yield createStatusReport(action, 'starting');
        if (!statusReport) {
            return false;
        }
        yield sendStatusReport(statusReport);
        return true;
    });
}
exports.reportActionStarting = reportActionStarting;
/**
 * Report that an action has failed.
 *
 * Note that the started_at date is always that of the `init` action, since
 * this is likely to give a more useful duration when inspecting events.
 */
function reportActionFailed(action, cause, exception) {
    return __awaiter(this, void 0, void 0, function* () {
        const languages = (yield getLanguages()).sort().join(',');
        yield sendStatusReport(yield createStatusReport(action, 'failure', cause, exception));
    });
}
exports.reportActionFailed = reportActionFailed;
/**
 * Report that an action has succeeded.
 *
 * Note that the started_at date is always that of the `init` action, since
 * this is likely to give a more useful duration when inspecting events.
 */
function reportActionSucceeded(action) {
    return __awaiter(this, void 0, void 0, function* () {
        const languages = (yield getLanguages()).sort().join(',');
        yield sendStatusReport(yield createStatusReport(action, 'success'));
    });
}
exports.reportActionSucceeded = reportActionSucceeded;
