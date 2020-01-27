import * as core from '@actions/core';

async function run() {
    let location = core.getInput('location', {required: true});
}

run();