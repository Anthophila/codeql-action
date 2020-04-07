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
import * as sharedEnv from './shared-environment';
import * as util from './util';

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

// Checks if any of the sarif files have been uploaded before.
// The previous upload is detected because we create an extra file next to it.
async function anyFilesAlreadyUploaded(sarifFiles: string[]): Promise<boolean> {
    for (let sarifFile of sarifFiles) {
        const alreadyUploadedSentinelFile = await getSentinelFilePath(sarifFile);
        if (fs.existsSync(alreadyUploadedSentinelFile)) {
            // Already uploaded
            core.debug('"' + sarifFile + '" has already been uploaded');
            return true;
        }
    }
    return false;
}

// Takes a list of paths to sarif files and combines them together,
// returning the contents of the combined sarif file.
export function combineSarifFiles(sarifFiles: string[]): string {
    let combinedSarif = {
        version: null,
        runs: [] as any[]
    };

    for (let sarifFile of sarifFiles) {
        let sarifObject = JSON.parse(fs.readFileSync(sarifFile, 'utf8'));
        // Check SARIF version
        if (combinedSarif.version === null) {
            combinedSarif.version = sarifObject.version;
        } else if (combinedSarif.version !== sarifObject.version) {
            throw "Different SARIF versions encountered: " + combinedSarif.version + " and " + sarifObject.version;
        }

        combinedSarif.runs.push(...sarifObject.runs);
    }

    return JSON.stringify(combinedSarif);
}

// Uploads a single sarif file or a directory of sarif files
// depending on what the path happens to refer to.
export async function upload(input: string) {
    if (fs.lstatSync(input).isDirectory()) {
        const sarifFiles = fs.readdirSync(input)
            .filter(f => f.endsWith(".sarif"))
            .map(f => path.resolve(input, f));
        await upload_files(sarifFiles);
    } else {
        await upload_files([input]);
    }
}

// Uploads the given set of sarif files.
async function upload_files(sarifFiles: string[]) {
    core.startGroup("Uploading results");
    try {
        // Check if any of the sarif files have been uploaded before. If any have been
        // uploaded before then abort uploading any more. This is perhaps not perfect
        // behaviour but it should be fine. The case this is intended to catch is when
        // the upload happens in both the finish and upload-sarif actions.
        if (await anyFilesAlreadyUploaded(sarifFiles)) {
            core.info("Aborting: detected that SARIF files have already been uploaded");
            return;
        }

        const commitOid = util.get_required_env_param('GITHUB_SHA');
        const workflowRunIDStr = util.get_required_env_param('GITHUB_RUN_ID');
        const ref = util.get_required_env_param('GITHUB_REF'); // it's in the form "refs/heads/master"
        const analysisName = util.get_required_env_param('GITHUB_WORKFLOW');
        const startedAt = process.env[sharedEnv.CODEQL_ACTION_STARTED_AT];

        core.debug("Uploading sarif files: " + JSON.stringify(sarifFiles));
        let sarifPayload = combineSarifFiles(sarifFiles);
        sarifPayload = fingerprints.addFingerprints(sarifPayload);

        const zipped_sarif = zlib.gzipSync(sarifPayload).toString('base64');
        let checkoutPath = core.getInput('checkout_path');
        let checkoutURI = fileUrl(checkoutPath);
        const workflowRunID = parseInt(workflowRunIDStr, 10);

        if (Number.isNaN(workflowRunID)) {
            core.setFailed('GITHUB_RUN_ID must define a non NaN workflow run ID');
            return;
        }

        let matrix: string | undefined = core.getInput('matrix');
        if (matrix === "null" || matrix === "") {
            matrix = undefined;
        }

        const payload = JSON.stringify({
            "commit_oid": commitOid,
            "ref": ref,
            "analysis_name": analysisName,
            "sarif": zipped_sarif,
            "workflow_run_id": workflowRunID,
            "checkout_uri": checkoutURI,
            "environment": matrix,
            "started_at": startedAt
        });

        core.info('Uploading results');
        const githubToken = core.getInput('token');
        const ph: auth.BearerCredentialHandler = new auth.BearerCredentialHandler(githubToken);
        const client = new http.HttpClient('Code Scanning : Upload SARIF', [ph]);
        const url = 'https://api.github.com/repos/' + process.env['GITHUB_REPOSITORY'] + '/code-scanning/analysis';
        const res: http.HttpClientResponse = await client.put(url, payload);
        const requestID = res.message.headers["x-github-request-id"];

        core.debug('response status: ' + res.message.statusCode);
        if (res.message.statusCode === 500) {
            // If the upload fails with 500 then we assume it is a temporary problem
            // with turbo-scan and not an error that the user has caused or can fix.
            // We avoid marking the job as failed to avoid breaking CI workflows.
            core.error('Upload failed (' + requestID + '): ' + await res.readBody());
        } else if (res.message.statusCode !== 202) {
            core.setFailed('Upload failed (' + requestID + '): ' + await res.readBody());
        } else {
            core.info("Successfully uploaded results");
        }

        // Mark the sarif files as uploaded
        for (let sarifFile of sarifFiles) {
            fs.writeFileSync(await getSentinelFilePath(sarifFile), '');
        }

    } catch (error) {
        core.setFailed(error.message);
    }
    core.endGroup();
}
