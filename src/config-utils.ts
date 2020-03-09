import * as fs from 'fs';
import * as io from '@actions/io';
import * as path from 'path';

import * as core from '@actions/core';

export class ExternalQuery {
    public repository: string;
    public ref: string;
    public path = '';

    constructor(repository: string, ref: string) {
        this.repository = repository;
        this.ref = ref;
    }
}

export class Config {
    public name = "";
    public inRepoQueries: string[] = [];
    public externalQueries: ExternalQuery[] = [];
    public pathsIgnore: string[] = [];
    public paths: string[] = [];

    public addQuery(queryUses: string) {
        // The logic for parsing the string is based on what actions does for
        // parsing the 'uses' actions in the workflow file

        if (queryUses === "") {
            throw '"uses" value for queries cannot be blank';
        }

        if (queryUses.startsWith("./")) {
            this.inRepoQueries.push(queryUses.slice(2));
            return;
        }

        let tok = queryUses.split('@');
        if (tok.length !== 2) {
            throw '"uses" value for queries must be a path, or owner/repo@ref \n Found: ' + queryUses;
        }

        const ref = tok[1];
        tok = tok[0].split('/', 3);
        if (tok.length < 2) {
            throw '"uses" value for queries must be a path, or owner/repo@ref \n Found: ' + queryUses;
        }

        let external = new ExternalQuery(tok[0] + '/' + tok[1], ref);
        if (tok.length === 3) {
            external.path = tok[2];
        }
        this.externalQueries.push(external);
    }
}

const configFolder = process.env['RUNNER_WORKSPACE'] || '/tmp/codeql-action';

export function saveConfig(config: Config) {
    const configString = JSON.stringify(config);
    io.mkdirP(configFolder);
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
