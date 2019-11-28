import * as core from '@actions/core';
import * as setuptools from './setup-tools';

async function run() {
  try {
    core.startGroup('Setup CodeQL tools');
    const codeql = await setuptools.setupCodeQL();
    core.endGroup();
 
    core.addPath(codeql.dist);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
