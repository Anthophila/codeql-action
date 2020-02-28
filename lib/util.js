"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
/*
 * Should the current action be aborted?
 *
 * This method should be called at the start of all CodeQL actions, because
 * they should abort (without failing) when called on merge commit for a
 * pull request.
 */
function should_abort(actionName) {
    const ref = process.env['GITHUB_REF'];
    if (ref == null) {
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
exports.should_abort = should_abort;
