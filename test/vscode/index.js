const path = require('path')
const { run } = require('node:test')

// Test files, each of which must contain exactly one top-level suite. See the
// note on completion below for why that matters.
const FILES = ['snippets.test.js', 'intellisense.test.js', 'highlighting.test.js']

// console.log in the extension host is routed through VS Code's own logger,
// which the --log level passed at launch can silence, taking the test results
// with it. Writing to stdout directly keeps them visible at any log level.
const write = line => process.stdout.write(line + '\n')

// VS Code calls this to run the suite inside its extension host.
//
// The tests need the vscode module, so they have to run in this process:
// node:test spawns a child process per file by default, and a child would not
// have it. isolation: 'none' keeps everything here, but comes with a catch.
// Under isolation: 'none' the stream node:test returns never ends inside the
// extension host: no test:summary arrives, 'end' never fires, and awaiting the
// stream never returns, so VS Code sits open with nothing left to do. Every
// test having already passed makes that look like a hang in the last test that
// touched the editor.
//
// So completion is derived from the events that do arrive. A top-level suite
// reports test:complete at nesting 0 once it and everything inside it has
// finished, so one top-level suite per file means one such event per file.
module.exports.run = () => new Promise((resolve, reject) => {
  const stream = run({
    files: FILES.map(file => path.resolve(__dirname, file)),
    isolation: 'none',
    concurrency: 1,
    timeout: 120000
  })

  const failures = []
  let passes = 0
  let finishedFiles = 0
  let settled = false

  function settle () {
    if (settled) return
    settled = true
    clearTimeout(guard)

    write('')
    if (failures.length) {
      write(`${failures.length} failing:`)
      for (const failure of failures) write(`  ${failure}`)
      reject(new Error(`${failures.length} test${failures.length === 1 ? '' : 's'} failed`))
      return
    }
    write(`${passes} passing`)
    resolve()
  }

  stream.on('test:pass', ({ nesting, name }) => {
    if (nesting === 0) return // the top-level suite itself, not a test
    passes++
    write(`${'  '.repeat(nesting)}ok ${name}`)
  })

  stream.on('test:fail', ({ nesting, name, details }) => {
    const reason = details?.error?.message?.split('\n')[0] ?? 'failed'
    // a failing suite is reported as well as the failing test inside it, so
    // only record the leaves to keep the count honest
    if (details?.error?.failureType !== 'subtestsFailed') failures.push(`${name}: ${reason}`)
    write(`${'  '.repeat(nesting)}not ok ${name}: ${reason}`)
  })

  stream.on('test:stderr', ({ message }) => process.stderr.write(message))

  stream.on('test:complete', ({ nesting }) => {
    // one top-level suite per file: once every file has reported, the run is
    // over even though the stream will never say so
    if (nesting === 0 && ++finishedFiles === FILES.length) setTimeout(settle, 100)
  })

  stream.on('error', err => {
    failures.push(`the test runner errored: ${err.message}`)
    settle()
  })

  // if a file fails to load, its top-level suite never completes and nothing
  // above fires, so fail loudly rather than hanging the way run() would
  const guard = setTimeout(() => {
    failures.push(`only ${finishedFiles} of ${FILES.length} test files finished`)
    settle()
  }, 300000)
})
