import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';

import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';

import zlib from 'zlib';

interface SARIFFile {
  version: string | null;
  runs: any[];
}

function appendSarifRuns(combinedSarif: SARIFFile, newSarifRuns: SARIFFile) {
  // Check SARIF version
  if (combinedSarif.version === null) {
    combinedSarif.version = newSarifRuns.version;
    core.debug("Sarif version set to " + JSON.stringify(combinedSarif.version))
  } else if (combinedSarif.version !== newSarifRuns.version){
    throw "Different SARIF versions encountered: " + combinedSarif.version + " and " + newSarifRuns.version;
  }

  combinedSarif.runs.push(...newSarifRuns.runs);
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

    let combinedSarif: SARIFFile = {
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

        let sarifObject = JSON.parse(fs.readFileSync(sarifFile,'utf8'));
        appendSarifRuns(combinedSarif, sarifObject);

        core.debug('SARIF results for database '+database+ ' created at "'+sarifFile+'"');
    }

    core.debug('Combined SARIF file: ');
    core.debug(JSON.stringify(combinedSarif));

    const outputFile = core.getInput('output_file');
    io.mkdirP(path.dirname(outputFile));

    fs.writeFileSync(outputFile, JSON.stringify(combinedSarif));
    core.debug('Combined SARIF file stored to : ' + outputFile);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
