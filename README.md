 # Usage

To get Code Scanning results from CodeQL analysis on your repo you can use the following workflow as a template:

```yaml
name: "CodeQL analysis"

on: [push]

jobs:
  build:

    strategy:
      fail-fast: false

    runs-on: ubuntu-latest // you can try windows too but macos is not yet supported

    steps:
    - uses: actions/checkout@v1
      with:
        submodules: recursive // omit this if your repository doesn't use submodules
    - uses: Anthophila/codeql-action/codeql/init@master
      with:
        languages: go, javascript // comma separated list of values from {go, python, javascript, java, cpp, csharp} (not YET ruby, sorry!)
    - uses: Anthophila/codeql-action/codeql/finish@master
    - uses: Anthophila/codeql-action/codeql/upload-sarif@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} 
```

If you prefer to integrate this within an existing CI workflow, it should end up looking something like this:
```yaml
...
    - uses: Anthophila/codeql-action/codeql/init@master
      with:
        languages: go, javascript

    // Here is where you build your code
    - run: |  
        make bootstrap
        make release

    - uses: Anthophila/codeql-action/codeql/finish@master
    - uses: Anthophila/codeql-action/codeql/upload-sarif@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} 
```

If you have any questions you can find us on Slack at #dsp-code-scanning.

And don't forget to leave your feedback on https://github.com/github/dsp-code-scanning/issues/515!
