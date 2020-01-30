import * as core from '@actions/core';
import * as exec from '@actions/exec';

async function run() {
    //let location = core.getInput('location', {required: true});
    let location = process.env['SARIF_RESULTS']

    const commitOid = process.env['GITHUB_SHA'];
    // Its in the form of 'refs/heads/master'
    let branchName = process.env['GITHUB_REF'];
    // RepoID seems to not be available, using runid as a placeholder
    // Repo name avaliable under GITHUB_REPOSITORY
    //let repoID = process.env['GITHUB_RUN_ID'];
    let repoID = '236503489'; // Anthophila/amazon-cognito-js-copy

    //let analysisName = process.env['GITHUB_WORKFLOW'];
    let analysisName = 'CodeQL';
    
    // This will execute the request while logging the body and keeping the http status in $CODEQL_UPLOAD_STATUS
    core.exportVariable('CODEQL_UPLOAD_STATUS', 
    '$(curl --output /dev/stderr --write-out "%{http_code}" -v '
    +'https://turbo-scan.githubapp.com/upload?repository_id='+repoID+'&commit_oid='+commitOid+'&branch_name='+branchName+'&analysis_name='+analysisName
    +'-H Authorization: Bearer '+process.env['GITHUB_TOKEN']
    +'-d @'+location
    +')')
    let returnCode = process.env['CODEQL_UPLOAD_STATUS']
    if (returnCode !== '200') {
        core.error('Curl command failed with return code: '+returnCode);
        core.setFailed('Curl command failed with return code: '+returnCode);
    }


    // exec.exec('curl', ['https://turbo-scan.githubapp.com/upload?repository_id='+repoID+
    // '&commit_oid='+commitOid+'&branch_name='+branchName+'&analysis_name='+analysisName, '-v',
    // '-H', 'Authorization: Bearer '+process.env['GITHUB_TOKEN'],
    // '-d', '@'+location]).then(returnCode => {
    //     if (returnCode !== 0) {
    //         core.error('Curl command failed with return code: '+returnCode);
    //         core.setFailed('Curl command failed with return code: '+returnCode);
    //     }
    // })
}

run();