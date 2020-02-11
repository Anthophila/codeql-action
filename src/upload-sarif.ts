import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as http from '@actions/http-client';
import * as auth from '@actions/http-client/auth';

import * as fs from 'fs';
import * as path from 'path';

async function run() {

    try {
        const sarifFolder = core.getInput('sarif_folder', { required: true });

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

        for (let sarifFile of fs.readdirSync(sarifFolder)) {
            const payload = JSON.stringify({ "commit_oid": commitOid, "branch_name": branchName, "ref": branchName, "analysis_name": analysisName, "sarif": fs.readFileSync(path.join(sarifFolder, sarifFile)).toString() });
            core.debug(payload);
            const ph: auth.BearerCredentialHandler = new auth.BearerCredentialHandler(githubToken);
            const client = new http.HttpClient('Code Scanning : Upload SARIF', [ph]);
            const res: http.HttpClientResponse = await client.put('https://api.github.com/repos/' + process.env['GITHUB_REPOSITORY'] + '/code_scanning/analysis', payload);
            core.debug('response status: ' + res.message.statusCode);
            if (res.message.statusCode != 202) {
                core.setFailed('Upload failed' + await res.readBody());
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }

}

run();
