"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const path = __importStar(require("path"));
const sharedEnv = __importStar(require("./shared-environment"));
const util = __importStar(require("./util"));
function run() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (util.should_abort('autobuild', true)) {
            return;
        }
        // Attempt to find a language to autobuild
        // We want pick the dominant language in the repo from the ones we're able to build
        // The languages are sorted in order specified by user or by lines of code if we got
        // them from the GitHub API, so try to build the first language on the list.
        const language = (_a = process.env[sharedEnv.CODEQL_ACTION_TRACED_LANGUAGES]) === null || _a === void 0 ? void 0 : _a.split(',')[0];
        if (!language) {
            core.info("None of the languages in this project require extra build steps");
            return;
        }
        core.debug(`Detected dominant traced language: ${language}`);
        core.startGroup(`Attempting to automatically build ${language} code`);
        // TODO: share config accross actions better via env variables
        const codeqlCmd = util.get_required_env_param(sharedEnv.CODEQL_ACTION_CMD);
        const cmdName = process.platform === 'win32' ? 'autobuild.cmd' : 'autobuild.sh';
        const autobuildCmd = path.join(path.dirname(codeqlCmd), language, 'tools', cmdName);
        // Update JAVA_TOOL_OPTIONS to contain '-Dhttp.keepAlive=false'
        // This is because of an issue with Azure pipelines timing out connections after 4 minutes
        // and Maven not properly handling closed connections
        // Otherwise long build processes will timeout when pulling down Java packages
        // https://developercommunity.visualstudio.com/content/problem/292284/maven-hosted-agent-connection-timeout.html
        let javaToolOptions = process.env['JAVA_TOOL_OPTIONS'] || "";
        process.env['JAVA_TOOL_OPTIONS'] = [...javaToolOptions.split(/\s+/), '-Dhttp.keepAlive=false', '-Dmaven.wagon.http.pool=false'].join(' ');
        yield exec.exec(autobuildCmd);
        core.endGroup();
    });
}
run().catch(e => {
    core.setFailed("codeql/autobuild action failed: " + e);
    console.log(e);
});
