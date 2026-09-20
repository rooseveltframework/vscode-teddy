const path = require('path')
const { runTests } = require('@vscode/test-electron')

// Launches a real VS Code, loads this extension into it, and runs the suite in
// test/vscode. Needs a display: on a headless machine run it under xvfb-run.
//
// @vscode/test-electron already passes --no-sandbox, --disable-gpu-sandbox,
// --disable-updates, --skip-welcome, --skip-release-notes, --no-cached-data and
// --disable-workspace-trust, and points --user-data-dir and --extensions-dir at
// .vscode-test so a run never touches the developer's own profile or installed
// extensions. Only what it does not cover belongs below.
//
// Do not add --log here to quiet VS Code's startup chatter. Any --log level,
// including off, silences the extension host's output as well, so the run
// reports nothing at all and a broken suite looks exactly like a passing one.
async function main () {
  // Chromium initialises VA-API before any of these flags apply and logs
  // "vaInitialize failed" on a machine with no usable hardware video driver,
  // which is every headless one. Naming a nonexistent driver stops it trying.
  process.env.LIBVA_DRIVER_NAME ??= 'null'

  try {
    await runTests({
      extensionDevelopmentPath: path.resolve(__dirname, '..'),
      extensionTestsPath: path.resolve(__dirname, 'vscode/index.js'),
      launchArgs: [
        // only the extension under test loads, via extensionDevelopmentPath.
        // built-in extensions stay enabled, which the intellisense tests need:
        // tag and attribute completions come from html-language-features.
        '--disable-extensions',
        '--disable-gpu',
        // stops settings sync reaching for an account mid-run
        '--sync', 'off'
      ]
    })
  } catch (err) {
    console.error('tests failed:', err)
    process.exit(1)
  }
}

main()
