import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';

import * as sharedEnv from './shared-environment';
import * as util from './util';


async function autobuildPython() {
  await exec.exec('python3 -m pip install --upgrade pip setuptools wheel');
  if (fs.existsSync("requirements.txt")) {
    await exec.exec('python3 -m pip install -r requirements.txt');
  } else if (fs.existsSync("Pipfile")) {
    await exec.exec('python3 -m pip install pipenv');
    await exec.exec('python3 -m pipenv install');
  } else if (fs.existsSync("pyproject.toml")) {
    await exec.exec('python3 -m pip install poetry');
    await exec.exec('python3 -m poetry install');
  } else if (fs.existsSync("setup.py")) {
    await exec.exec('python3 setup.py');
  } else {
    core.warning(
      'No python dependencies detected. If your project has dependencies to install, you must do so manually.'
    );
  }
}

async function run() {
  try {
    if (util.should_abort('autobuild', true) || !await util.reportActionStarting('autobuild')) {
      return;
    }

    // Attempt to find a language to autobuild
    // We want pick the dominant language in the repo from the ones we're able to build
    // The languages are sorted in order specified by user or by lines of code if we got
    // them from the GitHub API, so try to build the first language on the list.
    const language = process.env[sharedEnv.CODEQL_ACTION_AUTOBUILD_LANGUAGES]?.split(',')[0];

    if (!language) {
      core.info("None of the languages in this project require extra build steps");
      return;
    }

    core.debug(`Detected dominant traced language: ${language}`);

    core.startGroup(`Attempting to automatically build ${language} code`);
    // TODO: share config accross actions better via env variables
    const codeqlCmd = util.getRequiredEnvParam(sharedEnv.CODEQL_ACTION_CMD);

    // Get extractor location
    let extractorPath = '';
    await exec.exec(codeqlCmd, ['resolve', 'extractor', '--format=json', '--language=' + language], {
      silent: true,
      listeners: {
        stdout: (data) => { extractorPath += data.toString(); },
        stderr: (data) => { process.stderr.write(data); }
      }
    });

    const cmdName = process.platform === 'win32' ? 'autobuild.cmd' : 'autobuild.sh';
    const autobuildCmd = path.join(extractorPath, 'tools', cmdName);

    // In the case of python we need to run the setup.py script
    if (language === 'python') {
      await autobuildPython();

      // for the other languages we run the standard autobuilder
    } else {
      // Update JAVA_TOOL_OPTIONS to contain '-Dhttp.keepAlive=false'
      // This is because of an issue with Azure pipelines timing out connections after 4 minutes
      // and Maven not properly handling closed connections
      // Otherwise long build processes will timeout when pulling down Java packages
      // https://developercommunity.visualstudio.com/content/problem/292284/maven-hosted-agent-connection-timeout.html
      if (language === 'java') {
        let javaToolOptions = process.env['JAVA_TOOL_OPTIONS'] || "";
        process.env['JAVA_TOOL_OPTIONS'] = [...javaToolOptions.split(/\s+/), '-Dhttp.keepAlive=false', '-Dmaven.wagon.http.pool=false'].join(' ');
      }
      await exec.exec(autobuildCmd);
    }
    core.endGroup();

  } catch (error) {
    core.setFailed(error.message);
    await util.reportActionFailed('autobuild', error.message, error.stack);
    return;
  }

  await util.reportActionSucceeded('autobuild');
}

run().catch(e => {
  core.setFailed("codeql/autobuild action failed: " + e);
  console.log(e);
});
