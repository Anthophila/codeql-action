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

function concatTracerConfigs(configs: {[lang: string]: TracerConfig}) : TracerConfig {
    // A tracer config is a map containing additional environment variables and a tracer 'spec' file.
    // A tracer 'spec' file has the following format [log_file, number_of_blocks, blocks_text]

    // Merge the environments
    const env : { [key:string]:string; } = {};
    var envSize = 0;
    for (let v of Object.values(configs)) {
        for(let e of Object.entries(v.env)) {
            const name = e[0];
            const value = e[1];
            if (name in env) {
                if (env[name] !== value) {
                    throw Error('Incompatible values in environment parameter ' + name + ': ' + env[name] + ' and ' + value)
                }
            }
            else {
                env[name] = value;
                envSize += 1;
            }
        }
    }

    // Concatenate spec files into a new spec file
    let languages = Object.keys(configs);
    const cppIndex = languages.indexOf('cpp');
    // Make sure cpp is the last language, if it's present since it must be concatenated last
    if (cppIndex !== -1) {
        let lastLang = languages[languages.length - 1];
        languages[languages.length -1] = languages[cppIndex];
        languages[cppIndex] = lastLang;
    }

    let totalLines: string[] = [];
    let totalCount = 0;
    for (let lang of languages) {
        const lines = fs.readFileSync(configs[lang].spec, 'utf8').split(/\r?\n/);
        const count = parseInt(lines[1], 10);
        totalCount += count;
        totalLines.push(...lines.slice(2));
    }

    const newLogFilePath = path.resolve(workspaceFolder(), 'compound-build-tracer.log');
    const spec = path.resolve(workspaceFolder(), 'compound-spec');
    const newSpecContent = [ newLogFilePath, totalCount.toString(10), ...totalLines ];

    fs.writeFileSync(spec, newSpecContent.join('\n'));

    // Prepare the content of the compound environment file
    var buffer = Buffer.alloc(4);
    buffer.writeInt32LE(envSize, 0);
    for(let e of Object.entries(env)) {
        const key = e[0];
        const value = e[1];
        const lineBuffer = new Buffer(key + '=' + value + '\0', 'utf8');
        const sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeInt32LE(lineBuffer.length, 0);
        buffer = Buffer.concat([buffer, sizeBuffer, lineBuffer]);
    }
    // Write the compound environment
    const envPath = spec + '.environment';
    fs.writeFileSync(envPath, buffer);

    return { env, spec };
}

function workspaceFolder() : string {
    let workspaceFolder = process.env['RUNNER_WORKSPACE'];
    if (! workspaceFolder)
      workspaceFolder = path.resolve('..');

    return workspaceFolder;
}

async function run() {
  try {
    const languages = core.getInput('languages', { required: true })
                          .split(',')
                          .map(x => x.trim())
                          .filter(x => x.length > 0);

    const sourceRoot = path.resolve();

    core.startGroup('Setup CodeQL tools');
    const codeqlSetup = await setuptools.setupCodeQL();
    core.endGroup();
   
    const codeqlResultFolder = path.resolve(workspaceFolder(), 'codeql_results');
    const databaseFolder = path.resolve(codeqlResultFolder, 'db');

    let tracedLanguages : {[key: string]: TracerConfig} = {};

    // TODO: replace this code once CodeQL supports multi-language tracing
    for (let language of languages) {
        const languageDatabase = path.join(databaseFolder, language);
        // TODO: add better detection of 'traced languages' instead of using a hard coded list
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
    if (tracedLanguageKeys.length > 0) {
        core.exportVariable('CODEQL_ACTION_TRACED_LANGUAGES', tracedLanguageKeys.join(','));
        const mainTracerConfig = concatTracerConfigs(tracedLanguages);
        if (mainTracerConfig.spec) { 
            for (let entry of Object.entries(mainTracerConfig.env)) {
               core.exportVariable(entry[0], entry[1]);
            } 

            core.exportVariable('ODASA_TRACER_CONFIGURATION', mainTracerConfig.spec);
            if (process.platform == 'darwin') {
               core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlSetup.tools, 'osx64', 'libtrace.dylib'));
            } else if (process.platform == 'win32') {
               await exec.exec('powershell', 
                               [ path.resolve(__dirname, '..', 'src', 'inject-tracer.ps1'), path.resolve(codeqlSetup.tools, 'win64', 'tracer.exe') ],
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
