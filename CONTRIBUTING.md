# How to contribute

## Development

- Install dependencies: `npm ci`
- Run the unit tests: `npm t`
- Run the tests in a real Visual Studio Code: `npm run test-vscode`
- Check coverage: `npm run coverage`
- Create extension: `npm run package`
- Install extension: `code --install-extension *.vsix`
- Cycling through changes to the extension quickly: `npm run package && code --install-extension *.vsix && code`

## Before opening a pull request

- Be sure all tests pass:
  - `npm t` runs the unit tests.
  - `npm run test-vscode` downloads a real Visual Studio Code, loads the extension into it, and checks functionality in the editor. On a headless machine run it under a virtual display: `xvfb-run -a npm run test-vscode`.
- Keep coverage of `scripts/` at or near 100%: `npm run coverage`.

## Release process

If you are a maintainer, please follow the following release procedure:

- Merge all desired pull requests into master.
- Bump `package.json` to a new version and run `npm i` to generate a new `package-lock.json`.
- Add new version to CHANGELOG.
- Paste contents of CHANGELOG into new version commit.
- Open and merge a pull request with those changes.
- Tag the merge commit as the new release version number.
- Publish the extension to the Visual Studio Marketplace: `npm run publish`.
