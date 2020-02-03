import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as http from '@actions/http-client';
import * as auth from '@actions/http-client/auth';

import * as fs from 'fs';
import * as path from 'path';

async function run() {
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
    if (branchName?.substr(0, prefix.length) === prefix) {
        branchName = branchName.substr(prefix.length);
    }

    let analysisName = process.env['GITHUB_WORKFLOW'];
    if (analysisName == null) {
        core.setFailed('GITHUB_WORKFLOW environment variable must be set');
        return;
    }

    let githubToken = process.env['GITHUB_TOKEN'];
    if (githubToken == null) {
        core.setFailed('GITHUB_TOKEN environment variable must be set');
        return;
    }

    for (let sarifFile of fs.readdirSync(sarifFolder)) {
        let payload = JSON.stringify({ "commit_oid": commitOid, "branch_name": branchName, "analysis_name": analysisName, "sarif": fs.readFileSync(path.join(sarifFolder, sarifFile)).toString() });
        core.debug(payload);
        let ph: auth.BearerCredentialHandler = new auth.BearerCredentialHandler(githubToken);
        let client = new http.HttpClient('CodeQL Action', [ph]);
        let res: http.HttpClientResponse = await client.put('https://mveytsman-code-scanning-uploads.review-lab.github.com/api/v3/repos/' + process.env['GITHUB_REPOSITORY'] + '/code_scanning/analysis', payload);
        let statusCode = res.message.statusCode?.toString() || "-1";
        core.debug(statusCode);
        let body: string = await res.readBody();
        core.debug(body);
    }
}

run();