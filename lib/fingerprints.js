"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const long_1 = __importDefault(require("long"));
const tab = '\t'.charCodeAt(0);
const space = ' '.charCodeAt(0);
const lf = '\n'.charCodeAt(0);
const cr = '\r'.charCodeAt(0);
const BLOCK_SIZE = 100;
const MOD = long_1.default.fromInt(37); //L
// Compute the starting point for the hash mod
function computeFirstMod() {
    let firstMod = long_1.default.ONE; //L
    for (let i = 0; i < BLOCK_SIZE; i++) {
        firstMod = firstMod.multiply(MOD);
    }
    return firstMod;
}
/**
 * Hash the contents of a file
 *
 * The hash method computes a rolling hash for every line in the input. The hash is computed using the first
 * BLOCK_SIZE non-space/tab characters counted from the start of the line. For the computation of the hash all line endings
 * (i.e. \r, \n, and \r\n) are normalized to '\n'. A special value (-1) is added at the end of the file followed by
 * enough '\0' characters to ensure that there are BLOCK_SIZE characters available for computing the hashes of the
 * lines near the end of the file.
 *
 * @param callback function that is called with the line number (1-based) and hash for every line
 * @param input The file's contents
 */
function hash(callback, input) {
    // A rolling view in to the input
    const window = Array(BLOCK_SIZE).fill(0);
    // If the character in the window is the start of a new line
    // then records the line number, otherwise will be -1.
    // Indexes match up with those from the window variable.
    const lineNumbers = Array(BLOCK_SIZE).fill(-1);
    // The current hash value, updated as we read each character
    let hash = long_1.default.ZERO;
    let firstMod = computeFirstMod();
    // The current index in the window, will wrap around to zero when we reach BLOCK_SIZE
    let index = 0;
    // The line number of the character we are currently processing from the input
    let lineNumber = 0;
    // Is the next character to be read the start of a new line
    let lineStart = true;
    // Was the previous character a CR (carriage return)
    let prevCR = false;
    // A map of hashes we've seen before and how many times,
    // so we can disambiguate identical hashes
    const hashCounts = {};
    // Output the current hash and line number to the callback function
    const outputHash = function () {
        let hashValue = hash.toUnsigned().toString(16);
        if (!hashCounts[hashValue]) {
            hashCounts[hashValue] = 0;
        }
        hashCounts[hashValue]++;
        callback(lineNumbers[index], hashValue + ":" + hashCounts[hashValue]);
        lineNumbers[index] = -1;
    };
    // Update the current hash value and increment the index in the window
    const updateHash = function (current) {
        const begin = window[index];
        window[index] = current;
        hash = MOD.multiply(hash)
            .add(long_1.default.fromInt(current))
            .subtract(firstMod.multiply(long_1.default.fromInt(begin)));
        index = (index + 1) % BLOCK_SIZE;
    };
    // First process every character in the input, updating the hash and lineNumbers
    // as we go. Once we reach a point in the window again then we've processed
    // BLOCK_SIZE characters and if the last character at this point in the window
    // was the start of a line then we should output the hash for that line.
    for (let i = 0, len = input.length; i <= len; i++) {
        let current = i === len ? 65535 : input.charCodeAt(i);
        // skip tabs, spaces, and line feeds that come directly after a carriage return
        if (current === space || current === tab || (prevCR && current === lf)) {
            prevCR = false;
            continue;
        }
        // replace CR with LF
        if (current === cr) {
            current = lf;
            prevCR = true;
        }
        else {
            prevCR = false;
        }
        if (lineNumbers[index] !== -1) {
            outputHash();
        }
        if (lineStart) {
            lineStart = false;
            lineNumber++;
            lineNumbers[index] = lineNumber;
        }
        if (current === lf) {
            lineStart = true;
        }
        updateHash(current);
    }
    // Flush the remaining lines
    for (let i = 0; i < BLOCK_SIZE; i++) {
        if (lineNumbers[index] !== -1) {
            outputHash();
        }
        updateHash(0);
    }
}
// Generate a hash callback function that updates the given result in-place
// when it recieves a hash for the correct line number. Ignores hashes for other lines.
function locationUpdateCallback(result, location) {
    const locationStartLine = location.physicalLocation.region.startLine;
    return function (lineNumber, hash) {
        // Ignore hashes for lines that don't concern us
        if (locationStartLine !== lineNumber) {
            return;
        }
        if (!result.partialFingerprints) {
            result.partialFingerprints = {};
        }
        const existingFingerprint = result.partialFingerprints.primaryLocationLineHash;
        // If the hash doesn't match the existing fingerprint then
        // output a warning and don't overwrite it.
        if (!existingFingerprint) {
            result.partialFingerprints.primaryLocationLineHash = hash;
        }
        else if (existingFingerprint !== hash) {
            core.warning("Calculated fingerprint of " + hash +
                " for file " + location.physicalLocation.artifactLocation.uri +
                " line " + lineNumber +
                ", but found existing inconsistent fingerprint value " + existingFingerprint);
        }
    };
}
// Compute fingerprints for results in the given sarif file
// and return an updated sarif file contents.
function addFingerprints(sarifContents) {
    let sarif = JSON.parse(sarifContents);
    // Gather together results for the same file and construct
    // callbacks to accept hashes for that file and update the location
    const callbacksByFile = {};
    for (const run of sarif.runs || []) {
        for (const result of run.results || []) {
            // Check the primary location is defined correctly and is in the src root
            const primaryLocation = (result.locations || [])[0];
            if (!primaryLocation ||
                !primaryLocation.physicalLocation ||
                !primaryLocation.physicalLocation.artifactLocation ||
                !primaryLocation.physicalLocation.artifactLocation.uri ||
                primaryLocation.physicalLocation.artifactLocation.uriBaseId !== '%SRCROOT%') {
                core.debug("Unable to compute fingerprint for invalid location: " + JSON.stringify(primaryLocation));
                continue;
            }
            const filepath = primaryLocation.physicalLocation.artifactLocation.uri;
            if (!fs.existsSync(filepath)) {
                core.warning("Unable to compute fingerprint for non-existent file: " + filepath);
                continue;
            }
            if (!callbacksByFile[filepath]) {
                callbacksByFile[filepath] = [];
            }
            callbacksByFile[filepath].push(locationUpdateCallback(result, primaryLocation));
        }
    }
    // Now hash each file that was found
    Object.entries(callbacksByFile).forEach(([filepath, callbacks]) => {
        // A callback that forwards the hash to all other callbacks for that file
        const teeCallback = function (lineNumber, hash) {
            Object.values(callbacks).forEach(c => c(lineNumber, hash));
        };
        const fileContents = fs.readFileSync(filepath).toString();
        hash(teeCallback, fileContents);
    });
    return JSON.stringify(sarif);
}
exports.addFingerprints = addFingerprints;
