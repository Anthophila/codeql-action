import * as fs from "fs";
import * as path from "path";

import * as configUtils from "./config-utils";
import * as externalQueries from "./external-queries";

test("checkoutExternalQueries", () => {
    let config = new configUtils.Config();
    config.externalQueries = [
        new configUtils.ExternalQuery("Semmle/ql", "7d86cce6582a7d5631d875738e19db3ff09de56c"),
        new configUtils.ExternalQuery("github/codeql-go", "ae21ac23c1300696d0fca33b81c1680cd0e98fa2"),
    ]
    externalQueries.checkoutExternalQueries(config).then(() => {
        let destination = process.env["RUNNER_WORKSPACE"] || "/tmp/codeql-action/";
        expect(fs.existsSync(path.join(destination, "Semmle", "ql", "README.md"))).toBeTruthy();
        expect(fs.existsSync(path.join(destination, "github", "codeql-go", "README.md"))).toBeTruthy();
    }).catch(reason => {
        fail(reason);
    });
});
