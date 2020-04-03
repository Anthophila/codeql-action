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
const configUtils = __importStar(require("./config-utils"));
const upload_lib = __importStar(require("./upload-lib"));
const util = __importStar(require("./util"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        if (util.should_abort('upload-sarif') || !(yield util.reportActionStarting('upload-sarif'))) {
            return;
        }
        try {
            const config = yield configUtils.loadConfig();
            const sarifFile = core.getInput('sarif_file');
            yield upload_lib.upload_sarif(sarifFile);
        }
        catch (error) {
            core.setFailed(error.message);
            yield util.reportActionFailed('upload-sarif', error.message, error.stack);
            return;
        }
        yield util.reportActionSucceeded('upload-sarif');
    });
}
run().catch(e => {
    core.setFailed("codeql/upload-sarif action failed: " + e);
    console.log(e);
});
