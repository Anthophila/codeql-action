import * as fs from 'fs';
import * as io from '@actions/io';
import * as path from 'path';

import * as core from '@actions/core';

export class Config {
    name: string = "";
    queries: string[] = [];
    pathsIgnore: string[] = [];
    paths: string[] = [];
}

const configPath = '/tmp/codeql-action/config'

export function saveConfig(config: Config) {
    const configString = JSON.stringify(config);
    io.mkdirP(path.dirname(configPath));
    fs.writeFileSync(configPath, configString, 'utf8');
    core.debug('Saved config:');
    core.debug(configString);
}

export function loadConfig() : Config {
    const configString = fs.readFileSync(configPath, 'utf8');
    core.debug('Loaded config:');
    core.debug(configString);
    return JSON.parse(configString);
}

