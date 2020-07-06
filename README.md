This action is now out of date and should not be used. Please migrate to using https://github.com/github/codeql-action instead.

To update to use the new action you'll need to make the following modifications to your workflow file:
- `anthophila/codeql-action/codeql/init@master` => `github/codeql-action/init@v1`
- `anthophila/codeql-action/codeql/autobuild@master` => `github/codeql-action/autobuild@v1`
- `anthophila/codeql-action/codeql/finish@master` => `github/codeql-action/analyze@v1`
- `anthophila/codeql-action/codeql/upload-sarif@master` => `github/codeql-action/upload-sarif@v1`

See https://github.com/github/codeql-action#usage for how to use the action, or https://docs.github.com/en/github/finding-security-vulnerabilities-and-errors-in-your-code for more information on code scanning in general.

If you have questions about this process please [raise an issue](https://github.com/github/codeql-action/issues) or contact github support.
