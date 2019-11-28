import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import * as setuptools from './setup-tools';

async function run() {
  try {
    core.exportVariable('ODASA_TRACER_CONFIGURATION', '');
    delete process.env['ODASA_TRACER_CONFIGURATION'];

    const codeqlCmd = process.env['CODEQL_ACTION_CMD'] || 'CODEQL_ACTION_CMD';
    const resultsFolder = process.env['CODEQL_ACTION_RESULTS'] || 'CODEQL_ACTION_RESULTS';
    const tracedLanguage = process.env['CODEQL_ACTION_TRACED_LANGUAGE'];
    const databaseFolder = path.join(resultsFolder, 'db');

    if (tracedLanguage) {
        await exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, tracedLanguage)]);
    }

    const sarifFolder = path.join(resultsFolder, 'sarif');
    io.mkdirP(sarifFolder);
    for (let database of fs.readdirSync(databaseFolder)) {
        await exec.exec(codeqlCmd, ['database', 'analyze', path.join(databaseFolder, database), 
                                    '--format=sarif-latest', '--output=' + path.join(sarifFolder, database + '.sarif'),
                                    database + '-lgtm.qls']);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
