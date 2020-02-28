import * as fs from 'fs';

export class Config {
    name: string = "";
    queries: string[] = [];
    pathsIgnore: string[] = [];
    paths: string[] = [];
}

const configPath = '/tmp/codeql-action/config'

export function saveConfig(config: Config) {
    fs.writeFileSync(configPath, JSON.stringify(config), 'utf8');
}

export function loadConfig() : Config {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}
