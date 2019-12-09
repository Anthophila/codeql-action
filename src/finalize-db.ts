import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';

import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';

import JSZip from 'jszip';

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
    
    const zip = new JSZip();
    for (let database of fs.readdirSync(databaseFolder)) {
        const sarifFile = path.join(sarifFolder, database + '.sarif');
        await exec.exec(codeqlCmd, ['database', 'analyze', path.join(databaseFolder, database), 
                                    '--format=sarif-latest', '--output=' + sarifFile,
                                    database + '-lgtm.qls']);
        const sarif_data = fs.readFileSync(sarifFile,'utf8');
        zip.file(database+'.sarif', sarif_data);
    }
    const zipped_sarif = await zip.generateAsync({type:"base64", compression:"DEFLATE"});

    const { GITHUB_TOKEN, GITHUB_REF } = process.env;
    if (GITHUB_TOKEN && GITHUB_REF) {
        const octokit = new github.GitHub(GITHUB_TOKEN);

        const { data: checks } = await octokit.checks.listForRef(
          {
            ...github.context.repo,
            ref: GITHUB_REF
          });

        const check_run_id = checks.check_runs[0].id;

        await octokit.checks.update({
         ...github.context.repo,
         check_run_id,
         output: {
            title: 'SARIF alerts file',
            summary: 'etc',
            text: zipped_sarif
          }});
      }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
