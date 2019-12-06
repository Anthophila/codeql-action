import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import * as setuptools from './setup-tools';

async function run() {
  try {

    core.startGroup('Setup CodeQL tools');
    const codeqlSetup = await setuptools.setupCodeQL();
    const language = core.getInput('language', { required: true });
    core.endGroup();

    core.startGroup('Search for auxiliary build file');
    const databasesFolder = path.resolve("codeql_dbs");
    const languageDatabase = path.join(databasesFolder, language);
    let extractionCall = ['database', 'create', languageDatabase,
                '--language='+language ];
    const buildFilePath = findAuxBuildFile(language);
    if (buildFilePath)
      extractionCall = extractionCall.concat(['--command='+buildFilePath]);
    core.endGroup();
    
    core.startGroup('Create database');
    await exec.exec(codeqlSetup.cmd, extractionCall);
    core.endGroup();

    core.startGroup('Run analysis');
    const sarifFolder = path.resolve("codeql_alerts");
    io.mkdirP(sarifFolder);
    await exec.exec(codeqlSetup.cmd, ['database', 'analyze', languageDatabase, 
                                    '--format=sarif-latest',
                                    '--output=' + path.join(sarifFolder, language + '.sarif'),
                                    language + '-lgtm.qls']);
    core.endGroup();

  } catch (error) {
    core.setFailed(error.message);
  }
}

function findAuxBuildFile(language : string) : string|undefined {
  try {
    const ext = process.platform == 'win32' ? '.cmd' : '.sh';
    const buildFilePath = path.resolve('codeql-build-' + language + ext);
    if (fs.existsSync(buildFilePath))
      return buildFilePath;
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
