# codeql-action

This repository contains the following proof-of-concept actions
* `setup-codeql`: sets up a CodeQL environment for use in actions by:
  - optionally downloading and caching a requested version of CodeQL and adding to PATH.
    Default downloads are taken from https://github.com/Anthophila/codeql-action/releases
* `codeql/init` and `codeql/finish`: integrate CodeQL in an existing job by placing `codeql/init` before
   the build steps of interest and `codeql/finish` after.
 
# Usage

Basic:
```yaml
steps:
- uses: actions/checkout@v1
- uses: Anthophila/codeql-action/setup-codeql@master
- run: codeql database create --language=javascript ../codeql-db
```

Advanced:
```yaml
steps:
- uses: actions/checkout@v1
- run: |
   sudo apt install libssl-dev
   ./configure
- uses: Anthophila/codeql-action/codeql/init@master
  with:
   language: cpp, python
- run: |
    make bootstrap
    make release
- uses: Anthophila/codeql-action/codeql/finish@master
- uses: actions/upload-artifact@master
  with:
    name: results
    path: ../codeql_results/sarif

```
