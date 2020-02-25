import * as core from '@actions/core';
import * as http from '@actions/http-client';
import * as auth from '@actions/http-client/auth';

import * as fs from 'fs';
import zlib from 'zlib';

import * as upload_lib from './upload-lib';

async function run() {
    const sarifFile = core.getInput('sarif_file');
    await upload_lib.upload_sarif(sarifFile);
}

run();
