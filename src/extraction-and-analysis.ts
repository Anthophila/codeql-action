import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  try {

    const language = core.getInput('language', { required: true });
    
    const ext = process.platform == 'win32' ? '.cmd' : '.sh';
    const buildFilePath = path.resolve('codeql-build-' + language + ext);
    let call = ['database', 'create', path.resolve("codeql_db_"+language),
                '--language='+language ];
                
    if (fs.existsSync(buildFilePath))
        call.concat(['--command='+buildFilePath]);
    
    await exec.exec('codeql', call);

    //TODO run the analysis on the generated database!
    
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
