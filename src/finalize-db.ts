import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';

import * as path from 'path';
import * as fs from 'fs';

import * as sharedEnv from './shared-environment';

import * as upload_lib from './upload-lib';
import * as util from './util';

interface SARIFFile {
  version: string | null;
  runs: any[];
}

function appendSarifRuns(combinedSarif: SARIFFile, newSarifRuns: SARIFFile) {
  // Check SARIF version
  if (combinedSarif.version === null) {
    combinedSarif.version = newSarifRuns.version;
    core.debug("Sarif version set to " + JSON.stringify(combinedSarif.version))
  } else if (combinedSarif.version !== newSarifRuns.version) {
    throw "Different SARIF versions encountered: " + combinedSarif.version + " and " + newSarifRuns.version;
  }

  combinedSarif.runs.push(...newSarifRuns.runs);
}

async function finalizeDatabaseCreation(codeqlCmd: string, databaseFolder: string) {
  // Create db for scanned languages
  const scannedLanguages = process.env[sharedEnv.CODEQL_ACTION_SCANNED_LANGUAGES];
  if (scannedLanguages) {
    for (const language of scannedLanguages.split(',')) {
      // Get extractor location
      let extractorPath = '';
      await exec.exec(codeqlCmd, ['resolve', 'extractor', '--format=json', '--language=' + language], {
        silent: true,
        listeners: {
          stdout: (data) => { extractorPath += data.toString(); },
          stderr: (data) => { process.stderr.write(data); }
        }
      });
  
      // Set trace command
      const ext = process.platform == 'win32' ? '.cmd' : '.sh';
      const traceCommand = path.resolve(JSON.parse(extractorPath), 'tools', 'autobuild' + ext);
  
      // Run trace command
      await exec.exec(codeqlCmd, ['database', 'trace-command', path.join(databaseFolder, language), '--', traceCommand]);
    }
  }

  const languages = process.env[sharedEnv.CODEQL_ACTION_LANGUAGES] || '';
  for (const language of languages.split(',')) {
    await exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, language)]);
  }
}

async function runQueries(codeqlCmd: string, resultsFolder: string): Promise<SARIFFile> {
  const databaseFolder = path.join(resultsFolder, 'db');

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

    let sarifObject = JSON.parse(fs.readFileSync(sarifFile, 'utf8'));
    appendSarifRuns(combinedSarif, sarifObject);

    core.debug('SARIF results for database ' + database + ' created at "' + sarifFile + '"');
  }

  return combinedSarif;
}

async function run() {
  try {
    console.log(process.env);

    if (util.should_abort('finish')) {
        return;
    }

    core.exportVariable(sharedEnv.ODASA_TRACER_CONFIGURATION, '');
    delete process.env[sharedEnv.ODASA_TRACER_CONFIGURATION];

    const codeqlCmd = process.env[sharedEnv.CODEQL_ACTION_CMD] || 'CODEQL_ACTION_CMD';
    const resultsFolder = process.env[sharedEnv.CODEQL_ACTION_RESULTS] || 'CODEQL_ACTION_RESULTS';
    const databaseFolder = path.join(resultsFolder, 'db');

    core.startGroup('Finalize database creation');
    await finalizeDatabaseCreation(codeqlCmd, databaseFolder);
    core.endGroup();

    core.startGroup('Analyze database');
    const sarifResults = await runQueries(codeqlCmd, resultsFolder);
    const sarifPayload = JSON.stringify(sarifResults);
    core.endGroup();

    // Write analysis result to a file
    const outputFile = core.getInput('output_file');
    io.mkdirP(path.dirname(outputFile));
    fs.writeFileSync(outputFile, sarifPayload);

    core.debug('Analysis results: ');
    core.debug(sarifPayload);
    core.debug('Analysis results stored in: ' + outputFile);

    if ('true' === core.getInput('upload')) {
      upload_lib.upload_sarif(outputFile);
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
