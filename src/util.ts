import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Should the current action be aborted?
 *
 * This method should be called at the start of all CodeQL actions, because
 * they should abort (without failing) when called on merge commit for a
 * pull request.
 */
export function should_abort(actionName: string): boolean {

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

/**
 * Resolve the path to the workspace folder.
 */
export function workspaceFolder(): string {
    let workspaceFolder = process.env['RUNNER_WORKSPACE'];
    if (!workspaceFolder)
        workspaceFolder = path.resolve('..');

    return workspaceFolder;
}

/**
 * Get an environment parameter, and fail the action if it has no value
 */
// TODO rename to camelCase
export function get_required_env_param(paramName: string): string | undefined {
    const value = process.env[paramName];
    if (value === undefined) {
        core.setFailed(paramName + ' environment variable must be set');
    }
    core.debug(paramName + '=' + value);
    return value;
}

/**
 * Record the current time as the start of the init action, in a file in the workspace.
 * Returns the Date that was recorded.
 */
function writeInitStartedDate(): Date {
    const now = new Date();
    const initStartedPath = path.resolve(workspaceFolder(), 'init-action-start-time');
    fs.writeFileSync(initStartedPath, now.toISOString(), 'utf8');

    return now;
}

/**
 * Read the previously recorded start time of the init action.
 * Returns the Date that was previously recorded.
 */
function readInitStartedDate(): Date {
    const initStartedPath = path.resolve(workspaceFolder(), 'init-action-start-time');
    return new Date(fs.readFileSync(initStartedPath, 'utf8'));
}

/**
 * Record the languages that are to be analysed as a comma-separated string in
 * sorted order, in a file in the workspace.
 * Returns the string that was recorded.
 */
function writeAnalysedLanguages(): string {
    const languages = core.getInput('languages', { required: true })
                          .split(',')
                          .map(x => x.trim())
                          .filter(x => x.length > 0)
                          .sort()
                          .join(',');

    const languagesPath = path.resolve(workspaceFolder(), 'init-action-languages');
    fs.writeFileSync(languagesPath, languages, 'utf8');
    return languages;
}

/**
 * Read the previously recorded languages of the init action.
 * Returns the languages that were previously recorded.
 */
function readAnalysedLanguages(): string {
    const languagesPath = path.resolve(workspaceFolder(), 'init-action-languages');
    return fs.readFileSync(languagesPath, 'utf8');
}

interface StatusReport {
    "workflow_run_id": number;
    "workflow_name": string;
    "job_name": string;
    "matrix_vars"?: string;
    "languages": string;
    "commit_oid": string;
    "action_name": string;
    "action_oid": string;
    "started_at": string;
    "completed_at"?: string;
    "status": string;
    "cause"?: string;
    "exception"?: string;
}

/**
 * Compose a StatusReport.
 *
 * @param actionName The name of the action, e.g. 'init', 'finish', 'upload-sarif'
 * @param status The status. Must be 'success', 'failure', or 'starting'
 * @param startedAt The start time of the init action (only supply if composing
 *        a status report for the start of the init action)
 * @param languages The languages to be analysed (only supply if composing a
 *        status report for the start of the init action)
 * @param cause  Cause of failure (only supply if status is 'failure')
 * @param exception Exception (only supply if status is 'failure')
 */
function getStatusReport(
    actionName: string,
    status: string,
    startedAt: Date,
    languages: string,
    cause?: string,
    exception?: string):
    StatusReport | undefined {

    const commitOid = get_required_env_param('GITHUB_SHA');
    const workflowRunIDStr = get_required_env_param('GITHUB_RUN_ID');
    const workflowName = get_required_env_param('GITHUB_WORKFLOW');
    const jobName = get_required_env_param('GITHUB_JOB');
    if (workflowRunIDStr === undefined
        || workflowName === undefined
        || commitOid === undefined
        || jobName === undefined) {
        return;
    }
    const workflowRunID = parseInt(workflowRunIDStr, 10);


    let statusReport: StatusReport = {
        workflow_run_id: workflowRunID,
        workflow_name: workflowName,
        job_name: jobName,
        languages: languages,
        commit_oid: commitOid,
        action_name: actionName,
        action_oid: "unknown", // TODO decide if it's possible to fill this in
        started_at: startedAt.toISOString(),
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

    // TODO add matrix vars if defined (from action parameter following robert's PR)

    return statusReport;
}

/**
 * Send a status report to the code_scanning/analysis/status endpoint.
 */
async function sendStatusReport(statusReport: StatusReport | undefined) {
    if (statusReport) {
        const statusReportJSON = JSON.stringify(statusReport);

        core.debug(statusReportJSON);
        // TODO actually post status report to dotcom:
        /*
        const githubToken = core.getInput('token');
        const ph: auth.BearerCredentialHandler = new auth.BearerCredentialHandler(githubToken);
        const client = new http.HttpClient('Code Scanning : Status Report', [ph]);
        const url = 'https://api.github.com/repos/' + process.env['GITHUB_REPOSITORY']
                    + '/code-scanning/analysis/status';
        const res: http.HttpClientResponse = await client.put(url, statusReportJSON);
        */
    }

}

/**
 * Send a status report that an action is starting.
 *
 * If the action is `init` then this also records the start time and analysed
 * languages in the workspace, for retrieval when posting later status reports.
 *
 * Returns true unless a problem occurred and the action should abort.
 */
export async function reportActionStarting(action: string): Promise<boolean> {
    let startedAt = new Date();
    let languages: string;
    if (action === 'init') {
        startedAt = writeInitStartedDate();
        languages = writeAnalysedLanguages();
    } else {
        languages = readAnalysedLanguages();
    }

    const statusReport = getStatusReport(action, 'starting', startedAt, languages);
    if (!statusReport) {
        return false;
    }

    await sendStatusReport(statusReport);

    return true;
}

/**
 * Report that an action has failed.
 *
 * Note that the started_at date is always that of the `init` action, since
 * this is likely to give a more useful duration when inspecting events.
 */
export async function reportActionFailed(action: string, cause?: string, exception?: string) {
    await sendStatusReport(
        getStatusReport(action, 'failure', readInitStartedDate(), readAnalysedLanguages(), cause, exception));
}

/**
 * Report that an action has succeeded.
 *
 * Note that the started_at date is always that of the `init` action, since
 * this is likely to give a more useful duration when inspecting events.
 */
export async function reportActionSucceeded(action: string) {
    await sendStatusReport(getStatusReport(action, 'success', readInitStartedDate(), readAnalysedLanguages()));
}
