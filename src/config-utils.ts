import * as core from '@actions/core';
import * as io from '@actions/io';
import * as fs from 'fs';
import * as path from 'path';

export class Config {
    public name = "";
    public queries: string[] = [];
    public pathsIgnore: string[] = [];
    public paths: string[] = [];
}

const configFolder = process.env['RUNNER_WORKSPACE'] || '/tmp/codeql-action';

export async function saveConfig(config: Config) {
    const configString = JSON.stringify(config);
    await io.mkdirP(configFolder);
    fs.writeFileSync(path.join(configFolder, 'config'), configString, 'utf8');
    core.debug('Saved config:');
    core.debug(configString);
}

export function loadConfig(): Config {
    const configString = fs.readFileSync(path.join(configFolder, 'config'), 'utf8');
    core.debug('Loaded config:');
    core.debug(configString);
    return JSON.parse(configString);
}

