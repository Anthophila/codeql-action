import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';

import * as sharedEnv from './shared-environment';
import * as util from './util';

async function run() {
  try {
    if (util.should_abort('autobuild')) {
      return;
    }

    // Attempt to find a language to autobuild
    // We want pick the dominant language in the repo from the ones we're able to build
    // Assume the first language we heard about
    const language = process.env[sharedEnv.CODEQL_ACTION_LANGUAGES]?.split(',')[0];

    if (language === undefined) {
      core.info("None of the languages in this project require extra build steps");
      return;
    }

    core.startGroup('Attempting to automatically build project in ' + language);
    // TODO: share config accross actions better via env variables
    const codeqlCmd = process.env[sharedEnv.CODEQL_ACTION_CMD];
    if (codeqlCmd === undefined) {
      throw "Required environment variabled " + sharedEnv.CODEQL_ACTION_CMD + "not set. Did you run the init action?";
    }

    const cmdName = process.platform === 'win32' ? 'autobuild.cmd' : 'autobuild.sh';
    const autobuildCmd = path.join(path.dirname(codeqlCmd), language, 'tools', cmdName);


    // Update GRADLE_OPTIONS to contain '-Dhttp.keepAlive=false'
    // This is because of an issue with Azure pipelines timing out connections after 4 minutes
    // and Maven not properly handling closed connections
    // Otherwise long build processes will timeout when pulling down Java packages
    // TODO looks like autobuild isn't pulling in SEMMLE_JAVA_TOOL_OPTIONS, it should
    process.env['GRADLE_OPTIONS'] += ' -Dhttp.keepAlive=false';

    await exec.exec(autobuildCmd);
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
}
void run();
