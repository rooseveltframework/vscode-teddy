const assert = require('node:assert/strict')
const { test, suite } = require('node:test')
const path = require('node:path')

const { validate } = require('../../scripts/validate.js')
const {
  fixture, snippet, snippetsManifest, grammarContribution, grammar, customData, png
} = require('./helpers.js')

// Asserts that validating `files` produces exactly one problem, matching
// `expected`, so a test cannot pass on the strength of an unrelated failure.
function assertOneProblem (t, files, expected) {
  const { errors } = validate(fixture(t, files))
  assert.equal(errors.length, 1, `expected one problem, got: ${JSON.stringify(errors)}`)
  assert.match(errors[0], expected)
}

function assertNoProblems (t, files) {
  const { errors, notes } = validate(fixture(t, files))
  assert.deepEqual(errors, [], 'expected no problems')
  return notes
}

suite('the manifest itself', () => {
  test('a missing package.json is reported, not thrown', t => {
    assertOneProblem(t, {}, /package\.json: declared in the extension root, but the file does not exist/)
  })

  test('an unparseable package.json is reported, not thrown', t => {
    assertOneProblem(t, { 'package.json': '{ "name": }' }, /package\.json: invalid JSON/)
  })

  test('a manifest contributing nothing is valid', t => {
    assertNoProblems(t, { 'package.json': { name: 'fixture' } })
  })
})

suite('snippets', () => {
  const withSnippets = snippets => ({
    'package.json': snippetsManifest(),
    'snippets/teddy.json': snippets
  })

  test('a valid file is accepted and counted', t => {
    const notes = assertNoProblems(t, withSnippets({ a: snippet(), b: snippet({ prefix: 'other' }) }))
    assert.deepEqual(notes, ['./snippets/teddy.json: 2 snippets OK'])
  })

  test('a missing file is reported', t => {
    assertOneProblem(t, { 'package.json': snippetsManifest() },
      /declared in contributes\.snippets, but the file does not exist/)
  })

  test('invalid JSON is reported', t => {
    assertOneProblem(t, {
      'package.json': snippetsManifest(),
      'snippets/teddy.json': '{ "broken": { "prefix": }'
    }, /snippets\/teddy\.json: invalid JSON/)
  })

  for (const field of ['prefix', 'body', 'description']) {
    test(`a missing ${field} is reported`, t => {
      const broken = snippet()
      delete broken[field]
      // a snippet with no prefix or body cannot be checked further, so those
      // two report once; a missing description reports once as well
      const { errors } = validate(fixture(t, withSnippets({ a: broken })))
      assert.equal(errors.length, 1, JSON.stringify(errors))
      assert.match(errors[0], new RegExp(`"a" is missing a ${field}`))
    })
  }

  test('a duplicate prefix is reported', t => {
    assertOneProblem(t, withSnippets({ a: snippet(), b: snippet() }),
      /"b" reuses the prefix "thing" already used by "a"/)
  })

  test('a duplicate inside a prefix array is reported', t => {
    assertOneProblem(t, withSnippets({
      a: snippet({ prefix: ['thing', '<thing'], body: '<thing>' }),
      b: snippet({ prefix: ['other', '<thing'], body: '<other>' })
    }), /"b" reuses the prefix "<thing" already used by "a"/)
  })

  test('a newline inside an array body is reported', t => {
    assertOneProblem(t, withSnippets({ a: snippet({ body: ['one\ntwo'] }) }),
      /array body whose elements contain newlines/)
  })

  test('an unescaped placeholder is reported', t => {
    assertOneProblem(t, withSnippets({ a: snippet({ body: '${teddyLiteral}' }) }),
      /contains an unescaped "\$\{"/)
  })

  test('an escaped placeholder is accepted', t => {
    assertNoProblems(t, withSnippets({ a: snippet({ body: '\\${teddyLiteral}' }) }))
  })

  test('a gap in the tabstops is reported', t => {
    assertOneProblem(t, withSnippets({ a: snippet({ body: '$1 $3' }) }),
      /non-sequential tabstops \(1, 3\); they must run 1 to 2/)
  })

  test('tabstops reused across lines are accepted', t => {
    assertNoProblems(t, withSnippets({ a: snippet({ body: ['$1 $2', '$1'] }) }))
  })

  test('an element snippet with no angled prefix is reported', t => {
    assertOneProblem(t, withSnippets({ a: snippet({ prefix: 'loop', body: '<loop>$1</loop>' }) }),
      /inserts an element but has no prefix starting with "<"/)
  })

  test('an element snippet with only an angled prefix is reported', t => {
    assertOneProblem(t, withSnippets({ a: snippet({ prefix: '<loop', body: '<loop>$1</loop>' }) }),
      /has only an angled prefix/)
  })

  test('an element snippet with both prefixes is accepted', t => {
    assertNoProblems(t, withSnippets({
      a: snippet({ prefix: ['loop', '<loop'], body: '<loop>$1</loop>' })
    }))
  })
})

suite('grammars', () => {
  const withGrammar = value => ({
    'package.json': { name: 'fixture', contributes: { grammars: [grammarContribution] } },
    'syntaxes/teddy.injection.json': value
  })

  test('a valid grammar is accepted', t => {
    const notes = assertNoProblems(t, withGrammar(grammar()))
    assert.deepEqual(notes, ['./syntaxes/teddy.injection.json: grammar OK (text.html.teddy.injection)'])
  })

  test('a missing file is reported', t => {
    assertOneProblem(t, { 'package.json': { name: 'fixture', contributes: { grammars: [grammarContribution] } } },
      /declared in contributes\.grammars, but the file does not exist/)
  })

  test('invalid JSON is reported', t => {
    assertOneProblem(t, withGrammar('{ "scopeName": }'), /invalid JSON/)
  })

  // the dangerous case: VS Code loads nothing and reports no error, so the
  // injection silently stops working
  test('a scopeName disagreeing with the manifest is reported', t => {
    assertOneProblem(t, withGrammar(grammar({ scopeName: 'text.html.wrong' })),
      /declares scopeName "text\.html\.wrong", but package\.json declares "text\.html\.teddy\.injection"/)
  })

  test('an injected grammar with no injectionSelector is reported', t => {
    const broken = grammar()
    delete broken.injectionSelector
    assertOneProblem(t, withGrammar(broken), /is injected via injectTo but has no injectionSelector/)
  })

  test('a grammar with no patterns is reported', t => {
    assertOneProblem(t, withGrammar(grammar({ patterns: [] })), /has no patterns/)
  })

  test('a grammar with inline patterns and no repository is accepted', t => {
    const inline = grammar({ patterns: [{ name: 'comment.block.teddy.html', begin: '\\{!', end: '!\\}' }] })
    delete inline.repository
    assertNoProblems(t, withGrammar(inline))
  })

  test('a begin with no end is reported', t => {
    assertOneProblem(t, withGrammar(grammar({
      repository: { 'teddy-comment': { name: 'c', begin: '\\{!' } }
    })), /repository rule "teddy-comment" has a begin with no end/)
  })

  test('a rule matching nothing is reported', t => {
    assertOneProblem(t, withGrammar(grammar({
      repository: { 'teddy-comment': { name: 'c' } }
    })), /repository rule "teddy-comment" matches nothing/)
  })
})

suite('html custom data', () => {
  const withData = value => ({
    'package.json': { name: 'fixture', contributes: { html: { customData: ['./html-data/teddy.html-data.json'] } } },
    'html-data/teddy.html-data.json': value
  })

  test('valid data is accepted and counted', t => {
    const notes = assertNoProblems(t, withData(customData()))
    assert.deepEqual(notes, ['./html-data/teddy.html-data.json: 1 tags, 1 global attributes OK'])
  })

  test('a missing file is reported', t => {
    assertOneProblem(t, {
      'package.json': { name: 'fixture', contributes: { html: { customData: ['./html-data/gone.json'] } } }
    }, /declared in contributes\.html\.customData, but the file does not exist/)
  })

  test('invalid JSON is reported', t => {
    assertOneProblem(t, withData('{ "version": }'), /invalid JSON/)
  })

  test('the wrong format version is reported', t => {
    assertOneProblem(t, withData(customData({ version: 1 })), /declares version 1; expected 1\.1/)
  })

  test('a nameless tag is reported', t => {
    assertOneProblem(t, withData(customData({ tags: [{ description: 'No name.' }] })),
      /a tag has no name/)
  })

  test('a duplicate tag is reported', t => {
    assertOneProblem(t, withData(customData({
      tags: [{ name: 'loop', description: 'One.' }, { name: 'loop', description: 'Two.' }]
    })), /duplicate tag "loop"/)
  })

  test('an undescribed tag is reported', t => {
    assertOneProblem(t, withData(customData({ tags: [{ name: 'loop' }] })),
      /tag "loop" has no description/)
  })

  test('a markdown description satisfies the description check', t => {
    assertNoProblems(t, withData(customData({
      tags: [{ name: 'loop', description: { kind: 'markdown', value: 'Loops.' } }]
    })))
  })

  test('a nameless attribute is reported', t => {
    assertOneProblem(t, withData(customData({
      tags: [{ name: 'loop', description: 'Loops.', attributes: [{ description: 'No name.' }] }]
    })), /tag "loop" has an attribute with no name/)
  })

  test('a duplicate attribute is reported', t => {
    assertOneProblem(t, withData(customData({
      tags: [{ name: 'loop', description: 'Loops.', attributes: [{ name: 'val' }, { name: 'val' }] }]
    })), /tag "loop" has a duplicate attribute "val"/)
  })

  test('a nameless global attribute is reported', t => {
    assertOneProblem(t, withData(customData({ globalAttributes: [{ description: 'No name.' }] })),
      /a global attribute has no name/)
  })

  test('a duplicate global attribute is reported', t => {
    assertOneProblem(t, withData(customData({
      globalAttributes: [{ name: 'parse', description: 'One.' }, { name: 'parse', description: 'Two.' }]
    })), /duplicate global attribute "parse"/)
  })

  test('an undescribed global attribute is reported', t => {
    assertOneProblem(t, withData(customData({ globalAttributes: [{ name: 'parse' }] })),
      /global attribute "parse" has no description/)
  })

  test('data with no tags or attributes at all is accepted', t => {
    assertNoProblems(t, withData({ version: 1.1 }))
  })
})

suite('the icon', () => {
  const withIcon = content => ({
    'package.json': { name: 'fixture', icon: 'icon.png' },
    'icon.png': content
  })

  test('a square 128px png is accepted', t => {
    const notes = assertNoProblems(t, withIcon(png(128, 128)))
    assert.deepEqual(notes, ['icon.png: 128x128 PNG OK'])
  })

  test('a larger square png is accepted', t => {
    assertNoProblems(t, withIcon(png(256, 256)))
  })

  test('a missing icon is reported', t => {
    assertOneProblem(t, { 'package.json': { name: 'fixture', icon: 'icon.png' } },
      /declared as the icon, but the file does not exist/)
  })

  // the failure mode of checking out without LFS support: vsce packages the
  // pointer file as the icon and says nothing
  test('a Git LFS pointer is reported as such', t => {
    assertOneProblem(t, withIcon(
      'version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 22965\n'
    ), /is a Git LFS pointer, not a PNG/)
  })

  test('a file that is not a png is reported', t => {
    assertOneProblem(t, withIcon('this is not a png'), /is not a PNG/)
  })

  test('an undersized icon is reported', t => {
    assertOneProblem(t, withIcon(png(64, 64)), /is 64x64; the marketplace expects at least 128x128/)
  })

  test('a non-square icon is reported', t => {
    assertOneProblem(t, withIcon(png(256, 128)), /is 256x128; it must be square/)
  })

  test('a manifest declaring no icon is valid', t => {
    assertNoProblems(t, { 'package.json': { name: 'fixture' } })
  })
})

suite('this extension', () => {
  test('every contribution in the repository is valid', () => {
    const { errors, notes } = validate(path.join(__dirname, '..', '..'))
    assert.deepEqual(errors, [])
    assert.equal(notes.length, 4, `expected a note per contribution, got ${JSON.stringify(notes)}`)
  })
})
