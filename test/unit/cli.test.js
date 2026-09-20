const assert = require('node:assert/strict')
const { test, suite } = require('node:test')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const { fixture, snippet, snippetsManifest } = require('./helpers.js')
const { report } = require('../../scripts/validate.js')

const REPO = path.join(__dirname, '..', '..')
const SCRIPT = path.join(REPO, 'scripts', 'validate.js')

// Runs the validator as CI runs it and returns its exit code and output.
// The script takes its root from its own location, so copying it into a
// fixture is what points it at that fixture.
function runIn (root) {
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts', 'validate.js'))
  try {
    return { status: 0, output: execFileSync(process.execPath, [path.join(root, 'scripts', 'validate.js')], { encoding: 'utf8', stdio: 'pipe' }) }
  } catch (err) {
    return { status: err.status, output: (err.stdout || '') + (err.stderr || '') }
  }
}

suite('the validator as a command', () => {
  test('exits zero and reports every contribution for this repository', () => {
    const output = execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8' })
    assert.match(output, /snippets OK/)
    assert.match(output, /grammar OK/)
    assert.match(output, /global attributes OK/)
    assert.match(output, /PNG OK/)
    assert.match(output, /All contributions valid\./)
  })

  test('exits non-zero and lists the problems when something is wrong', t => {
    const root = fixture(t, {
      'package.json': snippetsManifest(),
      'snippets/teddy.json': { a: snippet({ prefix: 'x', body: '$1 $3' }) }
    })
    const { status, output } = runIn(root)
    assert.equal(status, 1)
    assert.match(output, /1 problem found:/)
    assert.match(output, /non-sequential tabstops/)
    assert.doesNotMatch(output, /All contributions valid/)
  })

  test('pluralises the problem count', t => {
    const root = fixture(t, {
      'package.json': snippetsManifest(),
      'snippets/teddy.json': {
        a: snippet({ prefix: 'x', body: '$1 $3' }),
        b: snippet({ prefix: 'y', body: '$2' })
      }
    })
    const { status, output } = runIn(root)
    assert.equal(status, 1)
    assert.match(output, /2 problems found:/)
  })
})

suite('reporting', () => {
  // Collects what report() writes so the wording and exit code can be checked
  // without spawning a process.
  function capture (result) {
    const out = []
    const err = []
    const code = report(result, line => out.push(line), line => err.push(line))
    return { code, out: out.join('\n'), err: err.join('\n') }
  }

  test('a clean result prints the notes and exits zero', () => {
    const { code, out, err } = capture({ notes: ['a: OK', 'b: OK'], errors: [] })
    assert.equal(code, 0)
    assert.match(out, /a: OK/)
    assert.match(out, /b: OK/)
    assert.match(out, /All contributions valid\./)
    assert.equal(err, '')
  })

  test('one problem is reported in the singular and exits one', () => {
    const { code, err } = capture({ notes: [], errors: ['a: broken'] })
    assert.equal(code, 1)
    assert.match(err, /1 problem found:/)
    assert.match(err, /- a: broken/)
  })

  test('several problems are reported in the plural and all listed', () => {
    const { code, out, err } = capture({ notes: [], errors: ['a: one', 'b: two', 'c: three'] })
    assert.equal(code, 1)
    assert.match(err, /3 problems found:/)
    for (const message of ['a: one', 'b: two', 'c: three']) assert.match(err, new RegExp(`- ${message}`))
    assert.doesNotMatch(out, /All contributions valid/)
  })

  test('it writes to the console when given no loggers', t => {
    const log = t.mock.method(console, 'log', () => {})
    const logError = t.mock.method(console, 'error', () => {})
    assert.equal(report({ notes: ['a: OK'], errors: [] }), 0)
    assert.equal(report({ notes: [], errors: ['b: broken'] }), 1)
    assert.ok(log.mock.calls.length >= 2, 'expected console.log to be used by default')
    assert.ok(logError.mock.calls.length >= 2, 'expected console.error to be used by default')
  })

  test('notes are still printed alongside problems', () => {
    const { out, err } = capture({ notes: ['a: OK'], errors: ['b: broken'] })
    assert.match(out, /a: OK/)
    assert.match(err, /b: broken/)
  })
})
