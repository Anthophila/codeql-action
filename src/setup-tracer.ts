import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as fs from 'fs';
import * as setuptools from './setup-tools';

type TracerConfig = {
    spec: string;
    env: {[key: string]: string};
};

const CRITICAL_TRACER_VARS = new Set(
  [ 'SEMMLE_PRELOAD_libtrace',
  , 'SEMMLE_RUNNER',
  , 'SEMMLE_COPY_EXECUTABLES_ROOT',
  , 'SEMMLE_DEPTRACE_SOCKET',
  , 'SEMMLE_JAVA_TOOL_OPTIONS'
  ]);

async function tracerConfig(codeql: setuptools.CodeQLSetup, database: string, compilerSpec?: string) : Promise<TracerConfig> {
    const compilerSpecArg = compilerSpec ? [ "--compiler-spec=" + compilerSpec] : [];

    let envFile = path.resolve(database, 'working', 'env.tmp');
    await exec.exec(codeql.cmd, ['database', 'trace-command', database,
          ...compilerSpecArg,
          process.execPath, path.resolve(__dirname, 'tracer-env.js'), envFile ]
    );

    const env : {[key: string]: string} = JSON.parse(fs.readFileSync(envFile, 'utf-8'));

    const config = env['ODASA_TRACER_CONFIGURATION'];
    const info : TracerConfig = { spec: config, env: {} };

    // Extract critical tracer variables from the environment
    for (let entry of Object.entries(env)) {
        const key = entry[0];
        const value = entry[1];
        // skip ODASA_TRACER_CONFIGURATION as it is handled separately
        if (key == 'ODASA_TRACER_CONFIGURATION') {
            continue;
        }
        // skip undefined values
        if (typeof value === 'undefined') {
            continue;
        }
        // Keep variables that do not exist in current environment. In addition always keep 
        // critical and CODEQL_ variables
        if(typeof process.env[key] === 'undefined' || CRITICAL_TRACER_VARS.has(key) || key.startsWith('CODEQL_')) {
            info.env[key] = value; 
        }
    }
    return info;
}

async function run() {
  try {
    let languages = core.getInput('language', { required: true }).split(',');
    languages = languages.map(x => x.trim()).filter(x => x.length > 0);

    const sourceRoot = path.resolve();

    core.startGroup('Setup CodeQL tools');
    const codeqlSetup = await setuptools.setupCodeQL();
    core.endGroup();
   
    let workspaceFolder = process.env['RUNNER_WORKSPACE'];
    if (! workspaceFolder)
      workspaceFolder = path.resolve('..');
    const codeqlResultFolder = path.resolve(workspaceFolder, 'codeql_results');
    const databaseFolder = path.resolve(codeqlResultFolder, 'db');

    let tracedLanguages : {[key: string]: TracerConfig} = {};

    for (let language of languages) {
        const languageDatabase = path.join(databaseFolder, language);
        if (['cpp', 'java', 'csharp'].includes(language)) {
            await exec.exec(codeqlSetup.cmd, ['database', 'init', languageDatabase, '--language=' + language, '--source-root=' + sourceRoot ]);
            const config : TracerConfig = await tracerConfig(codeqlSetup, languageDatabase);
            tracedLanguages[language] = config;
        } else {
            await exec.exec(codeqlSetup.cmd, ['database', 'create', languageDatabase, 
                                              '--language=' + language, '--source-root=' + sourceRoot ]);
        }
    }

    const tracedLanguageKeys = Object.keys(tracedLanguages);
    if (tracedLanguageKeys.length > 1) {
        throw new Error('Analysis of multiple compiled languages not supported: ' + languages.join(', '));
    } else if (tracedLanguageKeys.length == 1) {
        core.exportVariable('CODEQL_ACTION_TRACED_LANGUAGE', tracedLanguageKeys[0]);
        const mainTracerConfig = tracedLanguages[tracedLanguageKeys[0]];
        if (mainTracerConfig.spec) { 
            for (let entry of Object.entries(mainTracerConfig.env)) {
               core.exportVariable(entry[0], entry[1]);
            } 

            core.exportVariable('ODASA_TRACER_CONFIGURATION', mainTracerConfig.spec);
            if (process.platform == 'darwin') {
               core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlSetup.tools, 'osx64', 'libtrace.dylib'));
            } else if (process.platform == 'win32') {
               await exec.exec('powershell', 
                               [ path.resolve(__dirname, 'inject-tracer.ps1'), path.resolve(codeqlSetup.tools, 'win64', 'tracer.exe') ],
                               {env: {'ODASA_TRACER_CONFIGURATION': mainTracerConfig.spec}});
            } else {
               core.exportVariable('LD_PRELOAD', path.join(codeqlSetup.tools, 'linux64', '${LIB}trace.so'));
            }
        } 
    }

    // TODO: make this a "private" environment variable of the action
    core.exportVariable('CODEQL_ACTION_RESULTS', codeqlResultFolder);
    core.exportVariable('CODEQL_ACTION_CMD', codeqlSetup.cmd);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
