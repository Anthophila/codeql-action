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
const fs = __importStar(require("fs"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const language = core.getInput('language', { required: true });
            const ext = process.platform == 'win32' ? '.cmd' : '.sh';
            const buildFilePath = path.resolve('codeql-build-' + language + ext);
            let call = ['database', 'create', path.resolve("codeql_db_" + language),
                '--language=' + language];
            if (fs.existsSync(buildFilePath))
                call.concat(['--command=' + buildFilePath]);
            yield exec.exec('codeql', call);
            //TODO run the analysis on the generated database!
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
