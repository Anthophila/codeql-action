import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as fs from 'fs';
import * as path from 'path';

import * as configUtils from './config-utils';
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
      core.startGroup('Extracting ' + language);

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
      const ext = process.platform === 'win32' ? '.cmd' : '.sh';
      const traceCommand = path.resolve(JSON.parse(extractorPath), 'tools', 'autobuild' + ext);

      // Run trace command
      await exec.exec(
        codeqlCmd,
        ['database', 'trace-command', path.join(databaseFolder, language), '--', traceCommand]);

      core.endGroup();
    }
  }

  const languages = process.env[sharedEnv.CODEQL_ACTION_LANGUAGES] || '';
  for (const language of languages.split(',')) {
    core.startGroup('Finalizing ' + language);
    await exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, language)]);
    core.endGroup();
  }
}

async function runQueries(codeqlCmd: string, resultsFolder: string, config: configUtils.Config): Promise<SARIFFile> {
  const databaseFolder = path.join(resultsFolder, 'db');

  let combinedSarif: SARIFFile = {
    version: null,
    runs: []
  };

  const sarifFolder = path.join(resultsFolder, 'sarif');
  await io.mkdirP(sarifFolder);

  for (let database of fs.readdirSync(databaseFolder)) {
    core.startGroup('Analyzing ' + database);

    const sarifFile = path.join(sarifFolder, database + '.sarif');
    await exec.exec(codeqlCmd, [
      'database',
      'analyze',
      path.join(databaseFolder, database),
      '--format=sarif-latest',
      '--output=' + sarifFile,
      '--no-sarif-add-snippets',
      database + '-code-scanning.qls',
      ...config.inRepoQueries,
    ]);

    let sarifObject = JSON.parse(fs.readFileSync(sarifFile, 'utf8'));
    appendSarifRuns(combinedSarif, sarifObject);

    core.debug('SARIF results for database ' + database + ' created at "' + sarifFile + '"');
    core.endGroup();
  }

  return combinedSarif;
}

async function run() {
  try {
    if (util.should_abort('finish') || !await util.reportActionStarting('finish')) {
      return;
    }
    const config = await configUtils.loadConfig();

    core.exportVariable(sharedEnv.ODASA_TRACER_CONFIGURATION, '');
    delete process.env[sharedEnv.ODASA_TRACER_CONFIGURATION];

    const codeqlCmd = process.env[sharedEnv.CODEQL_ACTION_CMD] || 'CODEQL_ACTION_CMD';
    const resultsFolder = process.env[sharedEnv.CODEQL_ACTION_RESULTS] || 'CODEQL_ACTION_RESULTS';
    const databaseFolder = path.join(resultsFolder, 'db');

    core.info('Finalizing database creation');
    await finalizeDatabaseCreation(codeqlCmd, databaseFolder);

    core.info('Analyzing database');
    const sarifResults = await runQueries(codeqlCmd, resultsFolder, config);
    const sarifPayload = JSON.stringify(sarifResults);

    // Write analysis result to a file
    const outputFile = core.getInput('output_file');
    await io.mkdirP(path.dirname(outputFile));
    fs.writeFileSync(outputFile, sarifPayload);

    if ('true' === core.getInput('upload')) {
      await upload_lib.upload_sarif(outputFile);
    }

  } catch (error) {
    core.setFailed(error.message);
    await util.reportActionFailed('finish', 'unspecified');
    return;
  }

  await util.reportActionSucceeded('finish');
}

void run();
