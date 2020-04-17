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

      // Set up python environment
      if (language === 'python') {
        await exec.exec('sudo apt-get update');
        await exec.exec('sudo apt-get install python3-venv');
        await exec.exec('python -m pip install packaging');
        const pythonSetupScript = path.resolve(JSON.parse(extractorPath), 'tools', 'setup.py');
        process.env['LGTM_WORKSPACE'] = process.env['RUNNER_WORKSPACE'] || '/tmp/codeql-action';
        process.env['SEMMLE_DIST'] = JSON.parse(extractorPath);
        core.debug('SEMMLE_DIST ' + JSON.parse(extractorPath));
        await exec.exec('python', [pythonSetupScript]);
        core.endGroup();
      }

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

async function checkoutExternalQueries(config: configUtils.Config) {
  const folder = process.env['RUNNER_WORKSPACE'] || '/tmp/codeql-action';

  for (const externalQuery of config.externalQueries) {
    core.info('Checking out ' + externalQuery.repository);

    const checkoutLocation = path.join(folder, externalQuery.repository);
    if (!fs.existsSync(checkoutLocation)) {
      const repoURL = 'https://github.com/' + externalQuery.repository + '.git';
      await exec.exec('git', ['clone', repoURL, checkoutLocation]);
      await exec.exec('git', ['--git-dir=' + checkoutLocation + '/.git', 'checkout', externalQuery.ref]);
    }

    config.additionalQueries.push(path.join(checkoutLocation, externalQuery.path));
  }
}

// Runs queries and creates sarif files in the given folder
async function runQueries(codeqlCmd: string, databaseFolder: string, sarifFolder: string, config: configUtils.Config) {
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
      ...config.additionalQueries,
    ]);

    core.debug('SARIF results for database ' + database + ' created at "' + sarifFile + '"');
    core.endGroup();
  }
}

async function run() {
  try {
    if (util.should_abort('finish', true) || !await util.reportActionStarting('finish')) {
      return;
    }
    const config = await configUtils.loadConfig();

    core.exportVariable(sharedEnv.ODASA_TRACER_CONFIGURATION, '');
    delete process.env[sharedEnv.ODASA_TRACER_CONFIGURATION];

    const codeqlCmd = util.getRequiredEnvParam(sharedEnv.CODEQL_ACTION_CMD);
    const databaseFolder = util.getRequiredEnvParam(sharedEnv.CODEQL_ACTION_DATABASE_DIR);

    const sarifFolder = core.getInput('output');
    await io.mkdirP(sarifFolder);

    core.info('Finalizing database creation');
    await finalizeDatabaseCreation(codeqlCmd, databaseFolder);

    await checkoutExternalQueries(config);

    core.info('Analyzing database');
    await runQueries(codeqlCmd, databaseFolder, sarifFolder, config);

    if ('true' === core.getInput('upload')) {
      await upload_lib.upload(sarifFolder);
    }

  } catch (error) {
    core.setFailed(error.message);
    await util.reportActionFailed('finish', error.message, error.stack);
    return;
  }

  await util.reportActionSucceeded('finish');
}

run().catch(e => {
  core.setFailed("codeql/finish action failed: " + e);
  console.log(e);
});
