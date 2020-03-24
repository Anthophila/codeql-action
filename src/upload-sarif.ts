import * as core from '@actions/core';
import * as http from '@actions/http-client';
import * as auth from '@actions/http-client/auth';
import * as fs from 'fs';
import zlib from 'zlib';

import * as configUtils from './config-utils';
import * as upload_lib from './upload-lib';
import * as util from './util';

async function run() {
    if (util.should_abort('upload-sarif')) {
        return;
    }

    const config = await configUtils.loadConfig();

    const sarifDir = core.getInput('sarif_dir');
    if (sarifDir) {
        const sarifFiles = fs.readdirSync(sarifDir)
            .filter(f => f.endsWith(".sarif"));
        await upload_lib.upload_sarif(sarifFiles);

    } else {
        const sarifFile = core.getInput('sarif_file');
        await upload_lib.upload_sarif([sarifFile]);
    }
}

void run();
