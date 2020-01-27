import * as core from '@actions/core';

async function run() {
    let location = core.getInput('location', {required: true});

    const commitOid = process.env['GITHUB_SHA'];
    // Its in the form of 'refs/heads/master'
    let branchName = process.env['GITHUB_REF'];
    // RepoID seems to not be available, using runid as a placeholder
    // Repo name avaliable under GITHUB_REPOSITORY
    let repoID = process.env['GITHUB_RUN_ID'];

    let analysisName = process.env['GITHUB_WORKFLOW'];
    
    
}

run();