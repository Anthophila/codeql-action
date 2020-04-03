 # Usage

To get Code Scanning results from CodeQL analysis on your repo you can use the following workflow as a template:

```yaml
name: "CodeQL analysis"

on: 
  push:
  schedule:
    - cron: '0 0 * * 0'

jobs:
  codeql:

    strategy:
      fail-fast: false

    runs-on: ubuntu-latest # you can try windows too but macos is not yet supported

    steps:
    - uses: actions/checkout@v1
      with:
        submodules: recursive # omit this if your repository doesn't use submodules
    - uses: Anthophila/codeql-action/codeql/init@master
    - uses: Anthophila/codeql-action/codeql/finish@master
```

If you prefer to integrate this within an existing CI workflow, it should end up looking something like this:
```yaml
...
    - uses: Anthophila/codeql-action/codeql/init@master
      with:
        languages: go, javascript

    # Here is where you build your code
    - run: |  
        make bootstrap
        make release

    - uses: Anthophila/codeql-action/codeql/finish@master
```

CodeQL actions now supports adding a config file! With this file you can add more queries for CodeQL to execute. The queries must belong to a QL pack, and the QL pack can be located in your repository or any public repossitory. You can specify either a .ql file, a folder that contains different .ql files, a folder that contains various QL packs, and .qls file. The syntax for specifying the queries is the used in actions for adding steps.

The configuration file can be located anywhere in your repo, and for enabling it you need to point at it add a config-file parameter to the init action:

```yaml
    - uses: Anthophila/codeql-action/codeql/init@master
      with:
        config-file: ./.github/codeql/codeql-config.yml
```

A config file looks like this:

```yaml
name: "My CodeQL config"

queries: 
  - name: In-repo queries (Runs the queries located in the my-queries folder of the repo)
    uses: ./my-queries@master
  - name: External Javascript QL pack (Runs a QL pack located in an external repo)
    uses: Anthophila/javascript-querypack@master
  - name: External query (Runs a single query located in an external QL pack) 
    uses: Anthophila/python-querypack/show_ifs.ql@master 
  - name: Select query suite (Runs a query suite, in this case located in an external QL pack)
    uses: ./codeql-querypacks/complex-python-querypack/rootAndBar.qls
```

NB: The CodeQL actions are intended to run on `push` events, not on `pull_request` events. Since the latter would produce analyses of no use, the CodeQL actions all terminate themselves without doing any work if they are run on a PR.

If you have any questions you can find us on Slack at #dsp-code-scanning.

And don't forget to leave your feedback on https://github.com/github/dsp-code-scanning/issues/515!

# Troubleshooting

## Trouble with Go dependencies

### If you use a vendor directory

Try passing
```
env:
      GOFLAGS: "-mod=vendor"
```
to `Anthophila/codeql-action/codeql/finish`.

### If you do not use a vendor directory

Dependencies on public repositories should just work. If you have dependencies on private repositories, one option is to use `git config` and a [personal access token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) to authenticate when downloading dependencies. Add a section like
```
    steps:
    - name: Configure git private repo access
      env:
        TOKEN: ${{ secrets.GITHUB_PAT }}
      run: |
        git config --global url."https://${TOKEN}@github.com/github/foo".insteadOf "https://github.com/github/foo"
        git config --global url."https://${TOKEN}@github.com/github/bar".insteadOf "https://github.com/github/bar"
        git config --global url."https://${TOKEN}@github.com/github/baz".insteadOf "https://github.com/github/baz"
```
before any codeql actions. A similar thing can also be done with a SSH key or deploy key.

## C# using dotnet version 2 on linux

This unfortunately doesn't work properly unless `dotnet` is invoked with the `/p:UseSharedCompilation=false` flag. For example:
```
dotnet build /p:UseSharedCompilation=false
```
Version 3 works fine and does not require the additional flag.

## Ruby version 2.6 instead of 2.5

Add a section like
```
steps:
- name: Set up Ruby 2.6
  uses: actions/setup-ruby@v1
  with:
    version: 2.6.x
```
