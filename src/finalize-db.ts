import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';

import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';

import zlib from 'zlib';

class SARIFFile {
  version: string = "";
  runs: any[] = [];
}

function appendSarifRuns(combinedSarif: SARIFFile, newSarifRuns: SARIFFile) {
  // Check SARIF version
  if (combinedSarif.version === null) {
    combinedSarif.version = newSarifRuns["version"];
    core.debug("Sarif version set to " + JSON.stringify(combinedSarif.version))
  } else if (combinedSarif.version !== newSarifRuns["version"]){
    throw "Different SARIF versions encountered: " + combinedSarif.version + " and " + newSarifRuns["version"];
  }

  combinedSarif.runs = combinedSarif.runs.concat(newSarifRuns['runs']);
}

async function run() {
  try {

    console.log(process.env);

    core.exportVariable('ODASA_TRACER_CONFIGURATION', '');
    delete process.env['ODASA_TRACER_CONFIGURATION'];

    const codeqlCmd = process.env['CODEQL_ACTION_CMD'] || 'CODEQL_ACTION_CMD';
    const resultsFolder = process.env['CODEQL_ACTION_RESULTS'] || 'CODEQL_ACTION_RESULTS';
    const tracedLanguages = process.env['CODEQL_ACTION_TRACED_LANGUAGES'];
    const databaseFolder = path.join(resultsFolder, 'db');

    if (tracedLanguages) {
        for (const language of tracedLanguages.split(',')) {
            await exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, language)]);
        }
    }

    let sarif_data = ' ';
    let combinedSarif = {
      version: null,
      runs: []
    }

    const sarifFolder = path.join(resultsFolder, 'sarif');
    io.mkdirP(sarifFolder);

    for (let database of fs.readdirSync(databaseFolder)) {
        const sarifFile = path.join(sarifFolder, database + '.sarif');
        await exec.exec(codeqlCmd, ['database', 'analyze', path.join(databaseFolder, database),
                                    '--format=sarif-latest', '--output=' + sarifFile,
                                    '--sarif-add-snippets',
                                    database + '-lgtm.qls']);
        sarif_data = fs.readFileSync(sarifFile,'utf8');

        let sarifObject = JSON.parse(sarif_data);
        combinedSarif.runs = combinedSarif.runs.concat(sarifObject['runs']);

        core.debug('SARIF results for database '+database+ ' created at "'+sarifFile+'"');
    }

    core.debug('Combined SARIF file: ');
    core.debug(JSON.stringify(combinedSarif));

    const outputFile = core.getInput('output_file');
    io.mkdirP(path.dirname(outputFile));

    fs.writeFileSync(outputFile, JSON.stringify(combinedSarif));
    core.debug('Combined SARIF file stored to : ' + outputFile);

    const zipped_sarif = zlib.gzipSync(sarif_data).toString('base64');

    const { GITHUB_TOKEN, GITHUB_REF } = process.env;
    if (GITHUB_TOKEN && GITHUB_REF) {
        const octokit = new github.GitHub(GITHUB_TOKEN);

        const { data: checks } = await octokit.checks.listForRef(
          {
            ...github.context.repo,
            ref: GITHUB_REF
          });

        const check_name = core.getInput('check_name');

        let check_run_id;
        if (check_name) {
          check_run_id = checks.check_runs.filter(run => run.name === check_name)[0].id;
          // We're only interested in the check runs created from this action.
          // This filters out only those check runs that share our check run name
        } else {
          check_run_id = checks.check_runs[0].id;
          // if check_name is not provided, fallback to naively using the latest check run
        }

        console.log({
         ...github.context.repo,
         check_run_id,
         output: {
            title: 'SARIF alerts in a base64 zip',
            summary: 'base64 zip',
            text: zipped_sarif.length
          }});

        await octokit.checks.update({
         ...github.context.repo,
         check_run_id,
         output: {
            title: 'SARIF alerts in a base64 zip',
            summary: 'base64 zip',
            text: zipped_sarif
          }});
      }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
