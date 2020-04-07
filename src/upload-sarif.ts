import * as core from '@actions/core';
import * as fs from 'fs';

import * as upload_lib from './upload-lib';
import * as util from './util';

async function run() {
    if (util.should_abort('upload-sarif') || !await util.reportActionStarting('upload-sarif')) {
        return;
    }

    try {
        const sarifDir = core.getInput('sarif_dir');
        if (sarifDir) {
            const sarifFiles = fs.readdirSync(sarifDir)
                .filter(f => f.endsWith(".sarif"));
            await upload_lib.upload_sarif(sarifFiles);

        } else {
            const sarifFile = core.getInput('sarif_file');
            await upload_lib.upload_sarif([sarifFile]);
        }
    } catch (error) {
        core.setFailed(error.message);
        await util.reportActionFailed('upload-sarif', error.message, error.stack);
        return;
    }

    await util.reportActionSucceeded('upload-sarif');
}

run().catch(e => {
    core.setFailed("codeql/upload-sarif action failed: " + e);
    console.log(e);
});
