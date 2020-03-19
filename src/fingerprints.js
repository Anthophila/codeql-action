"use strict";
exports.__esModule = true;
var core = require("@actions/core");
var fs = require("fs");
var long_1 = require("long");
var tab = '\t'.charCodeAt(0);
var space = ' '.charCodeAt(0);
var lf = '\n'.charCodeAt(0);
var cr = '\r'.charCodeAt(0);
var BLOCK_SIZE = 100;
var MOD = long_1["default"].fromInt(37); // L
// Compute the starting point for the hash mod
function computeFirstMod() {
    var firstMod = long_1["default"].ONE; // L
    for (var i = 0; i < BLOCK_SIZE; i++) {
        firstMod = firstMod.multiply(MOD);
    }
    return firstMod;
}
/**
 * Hash the contents of a file
 *
 * The hash method computes a rolling hash for every line in the input. The hash is computed using the first
 * BLOCK_SIZE non-space/tab characters counted from the start of the line. For the computation of the hash all
 * line endings (i.e. \r, \n, and \r\n) are normalized to '\n'. A special value (-1) is added at the end of the
 * file followed by enough '\0' characters to ensure that there are BLOCK_SIZE characters available for computing
 * the hashes of the lines near the end of the file.
 *
 * @param callback function that is called with the line number (1-based) and hash for every line
 * @param input The file's contents
 */
function hash(callback, input) {
    // A rolling view in to the input
    var window = Array(BLOCK_SIZE).fill(0);
    // If the character in the window is the start of a new line
    // then records the line number, otherwise will be -1.
    // Indexes match up with those from the window variable.
    var lineNumbers = Array(BLOCK_SIZE).fill(-1);
    // The current hash value, updated as we read each character
    var hash = long_1["default"].ZERO;
    var firstMod = computeFirstMod();
    // The current index in the window, will wrap around to zero when we reach BLOCK_SIZE
    var index = 0;
    // The line number of the character we are currently processing from the input
    var lineNumber = 0;
    // Is the next character to be read the start of a new line
    var lineStart = true;
    // Was the previous character a CR (carriage return)
    var prevCR = false;
    // A map of hashes we've seen before and how many times,
    // so we can disambiguate identical hashes
    var hashCounts = {};
    // Output the current hash and line number to the callback function
    var outputHash = function () {
        var hashValue = hash.toUnsigned().toString(16);
        if (!hashCounts[hashValue]) {
            hashCounts[hashValue] = 0;
        }
        hashCounts[hashValue]++;
        callback(lineNumbers[index], hashValue + ":" + hashCounts[hashValue]);
        lineNumbers[index] = -1;
    };
    // Update the current hash value and increment the index in the window
    var updateHash = function (current) {
        var begin = window[index];
        window[index] = current;
        hash = MOD.multiply(hash)
            .add(long_1["default"].fromInt(current))
            .subtract(firstMod.multiply(long_1["default"].fromInt(begin)));
        index = (index + 1) % BLOCK_SIZE;
    };
    // First process every character in the input, updating the hash and lineNumbers
    // as we go. Once we reach a point in the window again then we've processed
    // BLOCK_SIZE characters and if the last character at this point in the window
    // was the start of a line then we should output the hash for that line.
    for (var i = 0, len = input.length; i <= len; i++) {
        var current = i === len ? 65535 : input.charCodeAt(i);
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
    for (var i = 0; i < BLOCK_SIZE; i++) {
        if (lineNumbers[index] !== -1) {
            outputHash();
        }
        updateHash(0);
    }
}
exports.hash = hash;
// Generate a hash callback function that updates the given result in-place
// when it recieves a hash for the correct line number. Ignores hashes for other lines.
function locationUpdateCallback(result, location) {
    var locationStartLine = location.physicalLocation.region.startLine;
    return function (lineNumber, hash) {
        // Ignore hashes for lines that don't concern us
        if (locationStartLine !== lineNumber) {
            return;
        }
        if (!result.partialFingerprints) {
            result.partialFingerprints = {};
        }
        var existingFingerprint = result.partialFingerprints.primaryLocationLineHash;
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
// Can we fingerprint the given location. This requires access to
// the source file so we can hash it.
// If possible returns a absolute file path for the source file,
// or if not possible then returns undefined.
function resolveUriToFile(location, artifacts) {
    // This may be referencing an artifact
    if (!location.uri && location.index !== undefined) {
        if (typeof location.index !== 'number' ||
            location.index < 0 ||
            location.index >= artifacts.length ||
            typeof artifacts[location.index].location !== 'object') {
            core.debug('Ignoring location as index "' + location.index + '" is invalid');
            return undefined;
        }
        location = artifacts[location.index].location;
    }
    // Get the URI and decode
    if (typeof location.uri !== 'string') {
        core.debug('Ignoring location as uri "' + location.uri + '" is invalid');
        return undefined;
    }
    var uri = decodeURIComponent(location.uri);
    // Remove a file scheme, and abort if the scheme is anything else
    var fileUriPrefix = 'file://';
    if (uri.startsWith(fileUriPrefix)) {
        uri = uri.substring(fileUriPrefix.length);
    }
    if (uri.indexOf('://') !== -1) {
        core.debug('Ignoring location URI "' + uri + "' as the scheme is not recognised");
        return undefined;
    }
    // Discard any absolute paths that aren't in the src root
    var srcRootPrefix = process.env['GITHUB_WORKSPACE'] + '/';
    if (uri.startsWith('/') && !uri.startsWith(srcRootPrefix)) {
        core.debug('Ignoring location URI "' + uri + "' as it is outside of the src root");
        return undefined;
    }
    // Just assume a relative path is relative to the src root.
    // This is not necessarily true but should be a good approximation
    // and here we likely want to err on the side of handling more cases.
    if (!uri.startsWith('/')) {
        uri = srcRootPrefix + uri;
    }
    // Check the file exists
    if (!fs.existsSync(uri)) {
        core.debug("Unable to compute fingerprint for non-existent file: " + uri);
        return undefined;
    }
    return uri;
}
exports.resolveUriToFile = resolveUriToFile;
// Compute fingerprints for results in the given sarif file
// and return an updated sarif file contents.
function addFingerprints(sarifContents) {
    var sarif = JSON.parse(sarifContents);
    // Gather together results for the same file and construct
    // callbacks to accept hashes for that file and update the location
    var callbacksByFile = {};
    for (var _i = 0, _a = sarif.runs || []; _i < _a.length; _i++) {
        var run = _a[_i];
        // We may need the list of artifacts to resolve against
        var artifacts = run.artifacts || [];
        for (var _b = 0, _c = run.results || []; _b < _c.length; _b++) {
            var result = _c[_b];
            // Check the primary location is defined correctly and is in the src root
            var primaryLocation = (result.locations || [])[0];
            if (!primaryLocation ||
                !primaryLocation.physicalLocation ||
                !primaryLocation.physicalLocation.artifactLocation) {
                core.debug("Unable to compute fingerprint for invalid location: " + JSON.stringify(primaryLocation));
                continue;
            }
            var filepath = resolveUriToFile(primaryLocation.physicalLocation.artifactLocation, artifacts);
            if (!filepath) {
                continue;
            }
            if (!callbacksByFile[filepath]) {
                callbacksByFile[filepath] = [];
            }
            callbacksByFile[filepath].push(locationUpdateCallback(result, primaryLocation));
        }
    }
    // Now hash each file that was found
    Object.entries(callbacksByFile).forEach(function (_a) {
        var filepath = _a[0], callbacks = _a[1];
        // A callback that forwards the hash to all other callbacks for that file
        var teeCallback = function (lineNumber, hash) {
            Object.values(callbacks).forEach(function (c) { return c(lineNumber, hash); });
        };
        var fileContents = fs.readFileSync(filepath).toString();
        hash(teeCallback, fileContents);
    });
    return JSON.stringify(sarif);
}
exports.addFingerprints = addFingerprints;
