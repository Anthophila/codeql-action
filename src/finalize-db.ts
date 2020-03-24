import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as fs from 'fs';
import * as path from 'path';

import * as configUtils from './config-utils';
import * as sharedEnv from './shared-environment';
import * as upload_lib from './upload-lib';
import * as util from './util';

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

// Runs queries and returns a list of paths to sarif files
async function runQueries(codeqlCmd: string, resultsFolder: string, config: configUtils.Config): Promise<string[]> {
  const databaseFolder = path.join(resultsFolder, 'db');

  const sarifFolder = path.join(resultsFolder, 'sarif');
  await io.mkdirP(sarifFolder);
  const sarifFiles = [] as string[];

  for (let database of fs.readdirSync(databaseFolder)) {
    core.startGroup('Analyzing ' + database);

    const sarifFile = path.join(sarifFolder, database + '.sarif');
    sarifFiles.push(sarifFile);

    await exec.exec(codeqlCmd, ['database', 'analyze', path.join(databaseFolder, database),
      '--format=sarif-latest', '--output=' + sarifFile,
      '--no-sarif-add-snippets',
      database + '-lgtm.qls',
      ...config.inRepoQueries]);

    core.debug('SARIF results for database ' + database + ' created at "' + sarifFile + '"');
    core.endGroup();
  }

  return sarifFiles;
}

async function run() {
  try {
    if (util.should_abort('finish')) {
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
    const sarifFiles = await runQueries(codeqlCmd, resultsFolder, config);

    // Write analysis result to a file
    const outputFile = core.getInput('output_file');
    await io.mkdirP(path.dirname(outputFile));
    fs.writeFileSync(outputFile, upload_lib.combineSarifFiles(sarifFiles));

    if ('true' === core.getInput('upload')) {
      await upload_lib.upload_sarif(sarifFiles);
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

void run();
