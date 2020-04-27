import * as analysisPaths from './analysis-paths';
import * as configUtils from './config-utils';

test("emptyPaths", async () => {
    let config = new configUtils.Config();
    analysisPaths.includeAndExcludeAnalysisPaths(config, []);
    expect(process.env['LGTM_INDEX_INCLUDE']).toBeUndefined();
    expect(process.env['LGTM_INDEX_EXCLUDE']).toBeUndefined();
});

test("nonEmptyPaths", async () => {
    let config = new configUtils.Config();
    config.paths.push('path');
    config.pathsIgnore.push('path');
    analysisPaths.includeAndExcludeAnalysisPaths(config, []);
    expect(process.env['LGTM_INDEX_INCLUDE']).toBeDefined();
    expect(process.env['LGTM_INDEX_EXCLUDE']).toBeDefined();
});