import * as core from '@actions/core';
import * as http from '@actions/http-client';
import * as auth from '@actions/http-client/auth';
import * as io from '@actions/io';
import fileUrl from 'file-url';
import * as fs from 'fs';
import md5 from 'md5';
import * as path from 'path';
import zlib from 'zlib';

import * as fingerprints from './fingerprints';

// Construct the location of the sentinel file for the given sarif file.
// The returned location should be writable.
async function getSentinelFilePath(sarifFile: string): Promise<string> {
    // Use the temp dir instead of placing next to the sarif file because of
    // issues with docker actions. The directory containing the sarif file
    // may not be writable by us.
    const uploadsTmpDir = path.join(process.env['RUNNER_TEMP'] || '/tmp/codeql-action', 'uploads');
    await io.mkdirP(uploadsTmpDir);
    // Hash the absolute path so we'll behave correctly in the unlikely
    // scenario a file is referenced twice with different paths.
    return path.join(uploadsTmpDir, md5(fs.realpathSync(sarifFile)));
}

export async function upload_sarif(sarifFile: string) {
    core.startGroup("Uploading results");
    try {
        // The upload may happen in the finish or upload-sarif actions but we only want
        // the file to be uploaded once, so we create an extra file next to it to mark
        // that the file has been uploaded and should be skipped if encountered again.
        const alreadyUploadedSentinelFile = await getSentinelFilePath(sarifFile);
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

        const zipped_sarif = zlib.gzipSync(sarifPayload).toString('base64');
        let checkoutPath = core.getInput('checkout_path');
        let checkoutURI = fileUrl(checkoutPath);
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
        const ph: auth.BearerCredentialHandler = new auth.BearerCredentialHandler(githubToken);
        const client = new http.HttpClient('Code Scanning : Upload SARIF', [ph]);
        const url = 'https://api.github.com/repos/' + process.env['GITHUB_REPOSITORY'] + '/code_scanning/analysis';
        const res: http.HttpClientResponse = await client.put(url, payload);

        core.debug('response status: ' + res.message.statusCode);
        if (res.message.statusCode === 500) {
            // If the upload fails with 500 then we assume it is a temporary problem
            // with turbo-scan and not an error that the user has caused or can fix.
            // We avoid marking the job as failed to avoid breaking CI workflows.
            core.error('Upload failed: ' + await res.readBody());
        } else if (res.message.statusCode !== 202) {
            core.setFailed('Upload failed: ' + await res.readBody());
        } else {
            core.info("Successfully uploaded results");
        }

        // Mark the sarif file as uploaded
        fs.writeFileSync(alreadyUploadedSentinelFile, '');

    } catch (error) {
        core.setFailed(error.message);
    }
    core.endGroup();
}

// Get an environment parameter, and fail the action if it has no value
function get_required_env_param(paramName: string): string | undefined {
    const value = process.env[paramName];
    if (value === undefined) {
        core.setFailed(paramName + ' environment variable must be set');
    }
    core.debug(paramName + '=' + value);
    return value;
}
