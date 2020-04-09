 # Usage

To get Code Scanning results from CodeQL analysis on your repo you can use the following workflow as a template:

```yaml

name: "Code Scanning - Action"

on: 
  push:
  schedule:
    - cron: '0 0 * * 0'

jobs:
  CodeQL-Build:

    strategy:
      fail-fast: false

    # CodeQL runs on ubuntu-latest and windows-latest
    runs-on: ubuntu-latest 

    steps:
    - name: Checkout repository
      uses: actions/checkout@v2
        
    # Initializes the CodeQL tools for scanning. 
    - name: Initialize CodeQL 
      uses: Anthophila/codeql-action/codeql/init@master
      # Override language selection by uncommenting this and choosing your languages
      # with:
      #   languages: go, javascript, csharp, python, cpp, java
      
      
    # ℹ️ Command-line programs to run using the OS shell.
    # 📚 https://git.io/JvXDl
    # ✏️ Uncomment the following three lines and modify them (or add more) to
    #    build your code if your project uses a compiled language (C/C++, C#, or
    #    Java).
    #- run: |
    #   make bootstrap
    #   make release
      
    - name: Perform CodeQL Analysis
      uses: Anthophila/codeql-action/codeql/finish@master
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

You can specify extra queries for CodeQL to execute using a config file. The queries must belong to a [QL pack](https://help.semmle.com/codeql/codeql-cli/reference/qlpack-overview.html) and can be in your repository or any public repository. You can choose a single .ql file, a folder containing multiple .ql files, or a .qls [query suite](https://help.semmle.com/codeql/codeql-cli/procedures/query-suites.html) file, or any combination of the above. To use queries from other repositories use the same syntax as when [using an action](https://help.github.com/en/actions/reference/workflow-syntax-for-github-actions#jobsjob_idstepsuses).

You can choose to ignore some files or folders from the analysis, or include additional files/folders for analysis. This *only* works for Javascript and Python analysis.

Use the config-file parameter of the codeql/init action to enable the configuration file. For example:

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
    uses: ./my-queries
  - name: External Javascript QL pack (Runs a QL pack located in an external repo)
    uses: Anthophila/javascript-querypack@master
  - name: External query (Runs a single query located in an external QL pack) 
    uses: Anthophila/python-querypack/show_ifs.ql@master 
  - name: Select query suite (Runs a query suites)
    uses: ./codeql-querypacks/complex-python-querypack/rootAndBar.qls

paths:
  - src/util.ts

paths-ignore:
 - src
 - lib
```

Some example QL packs can be found here: https://github.com/Anthophila/python-querypack https://github.com/Anthophila/javascript-querypack

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

