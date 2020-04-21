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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function CheckoutExternalQueries(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const folder = process.env['RUNNER_WORKSPACE'] || '/tmp/codeql-action';
        for (const externalQuery of config.externalQueries) {
            core.info('Checking out ' + externalQuery.repository);
            const checkoutLocation = path.join(folder, externalQuery.repository);
            if (!fs.existsSync(checkoutLocation)) {
                const repoURL = 'https://github.com/' + externalQuery.repository + '.git';
                yield exec.exec('git', ['clone', repoURL, checkoutLocation]);
                yield exec.exec('git', [
                    '--work-tree=' + checkoutLocation,
                    '--git-dir=' + checkoutLocation + '/.git',
                    'checkout', externalQuery.ref,
                ]);
            }
            config.additionalQueries.push(path.join(checkoutLocation, externalQuery.path));
        }
    });
}
exports.CheckoutExternalQueries = CheckoutExternalQueries;
