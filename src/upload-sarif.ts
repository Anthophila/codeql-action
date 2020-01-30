import * as core from '@actions/core';
import * as exec from '@actions/exec';

import * as fs from 'fs';
import * as path from 'path';

async function run() {
    let sarifFolder = core.getInput('sarif_folder', {required: true});

    const commitOid = process.env['GITHUB_SHA'];
    // Its in the form of 'refs/heads/master'
    let branchName = process.env['GITHUB_REF'];
    // RepoID seems to not be available, using runid as a placeholder
    // Repo name avaliable under GITHUB_REPOSITORY
    //let repoID = process.env['GITHUB_RUN_ID'];
    let repoID = '236503489'; // Anthophila/amazon-cognito-js-copy

    //let analysisName = process.env['GITHUB_WORKFLOW'];
    let analysisName = 'CodeQL';

    for (let sarifFile of fs.readdirSync(sarifFolder)) {
        exec.exec('curl', ['-f', 'https://turbo-scan.githubapp.com/upload?repository_id='+repoID+
            '&commit_oid='+commitOid+'&branch_name='+branchName+'&analysis_name='+analysisName, '-v',
            '-H', 'Authorization: Bearer '+process.env['GITHUB_TOKEN'],
            '-d', '@'+path.join(sarifFolder, sarifFile)]
        ).catch(reason => {
            core.setFailed('Curl command failed: '+reason);
        })
    }
}

run();