import * as core from '@actions/core';
import * as http from '@actions/http-client';
import * as auth from '@actions/http-client/auth';
import fileUrl from 'file-url';
import * as fs from 'fs';
import zlib from 'zlib';

export async function upload_sarif(sarifFile: string) {
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

        const commitOid = process.env['GITHUB_SHA'];
        if (commitOid === null) {
            core.setFailed('GITHUB_SHA environment variable must be set');
            return;
        }
        core.debug('commitOid: ' + commitOid);

        // Its in the form of 'refs/heads/master'
        const ref = process.env['GITHUB_REF'];
        if (ref === null) {
            core.setFailed('GITHUB_REF environment variable must be set');
            return;
        }
        core.debug('ref: ' + ref);

        const analysisName = process.env['GITHUB_WORKFLOW'];
        if (analysisName === null) {
            core.setFailed('GITHUB_WORKFLOW environment variable must be set');
            return;
        }
        core.debug('analysisName: ' + analysisName);

        const githubToken = core.getInput('token');

        const sarifPayload = fs.readFileSync(sarifFile).toString();
        const zipped_sarif = zlib.gzipSync(sarifPayload).toString('base64');
        let checkoutPath = core.getInput('checkout_path');
        let checkoutURI = fileUrl(checkoutPath);

        const payload = JSON.stringify({
            "commit_oid": commitOid,
            "ref": ref,
            "analysis_name": analysisName,
            "sarif": zipped_sarif,
            "checkout_uri": checkoutURI,
        });
        core.debug(payload);

        const ph: auth.BearerCredentialHandler = new auth.BearerCredentialHandler(githubToken);
        const client = new http.HttpClient('Code Scanning : Upload SARIF', [ph]);
        const url = 'https://api.github.com/repos/' + process.env['GITHUB_REPOSITORY'] + '/code_scanning/analysis';
        const res: http.HttpClientResponse = await client.put(url, payload);

        core.debug('response status: ' + res.message.statusCode);
        if (res.message.statusCode === 500) {
            core.error('Upload failed: ' + await res.readBody());
        } else if (res.message.statusCode !== 202) {
            core.setFailed('Upload failed: ' + await res.readBody());
        }

        // Mark the sarif file as uploaded
        fs.writeFileSync(alreadyUploadedSentinelFile, '');

    } catch (error) {
        core.setFailed(error.message);
    }
}
