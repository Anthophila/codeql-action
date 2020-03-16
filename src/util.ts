import * as core from '@actions/core';

/*
 * Should the current action be aborted?
 *
 * This method should be called at the start of all CodeQL actions, because
 * they should abort (without failing) when called on merge commit for a
 * pull request.
 */
export function should_abort(actionName: string): boolean {

    const ref = process.env['GITHUB_REF'];
    if (ref === undefined) {
        core.setFailed('GITHUB_REF must be set.');
        return true;
    }

    if (ref.startsWith('refs/pull/')) {
        core.warning('The CodeQL ' + actionName + ' action is intended for workflows triggered on `push` events, '
            + 'but the current workflow is running on a pull request. Aborting.');
        return true;
    }

    return false;
}
