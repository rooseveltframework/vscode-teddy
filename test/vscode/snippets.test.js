const assert = require('node:assert/strict')
const { test, suite } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const { acceptTopSuggestion, insertByLabel, completionRange, completionLabels } = require('./editor.js')

const REPO = path.join(__dirname, '..', '..')
const snippets = JSON.parse(fs.readFileSync(path.join(REPO, 'snippets/teddy.json'), 'utf8'))

const bodyOf = snippet => Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body
const prefixesOf = snippet => [snippet.prefix].flat()

const entries = Object.entries(snippets)
const elements = entries.filter(([, snippet]) => bodyOf(snippet).startsWith('<'))
const others = entries.filter(([, snippet]) => !bodyOf(snippet).startsWith('<'))

// The tag each element snippet must open with, taken from the body itself so
// this cannot drift from the snippets file.
const opensWith = snippet => bodyOf(snippet).match(/^<!--.|^<[a-z]+/i)[0]

suite('snippets', () => {
  suite('every element snippet replaces the typed angle bracket (issue #1)', () => {
    for (const [name, snippet] of elements) {
      const angled = prefixesOf(snippet).find(prefix => prefix.startsWith('<'))
      test(`${name} via "${angled}"`, async () => {
        const range = await completionRange(angled, angled)
        assert.notEqual(range, null, `"${angled}" is not offered`)
        assert.equal(range.start, 0,
          `replacing from column ${range.start} leaves the typed "<" in place, inserting <${range.body}`)
        assert.ok(range.body.startsWith(opensWith(snippet)),
          `expected the body to open with ${opensWith(snippet)}, got ${range.body}`)
      })
    }
  })

  // The angled prefixes only work because each snippet keeps its bare prefix
  // too. With the angled prefix alone, typing "if" ranks the built-in <iframe>
  // snippet above teddy's <if>.
  suite('every element snippet is reachable by its bare prefix', () => {
    for (const [name, snippet] of elements) {
      const bare = prefixesOf(snippet).find(prefix => !prefix.startsWith('<'))
      test(`${name} via "${bare}"`, async () => {
        const labels = await completionLabels(bare, bare.length)
        assert.ok(labels.includes(bare), `"${bare}" is not offered; saw ${JSON.stringify(labels.slice(0, 12))}`)
      })
    }
  })

  suite('every remaining snippet inserts its body', () => {
    for (const [name, snippet] of others) {
      const prefix = prefixesOf(snippet)[0]
      test(`${name} via "${prefix}"`, async () => {
        const got = await insertByLabel(prefix, prefix)
        assert.notEqual(got, null, `"${prefix}" is not offered`)
        assert.equal(got, bodyOf(snippet).replace(/(?<!\\)\$\d+/g, ''))
      })
    }
  })

  suite('snippet bodies use double quotes (issue #15)', () => {
    for (const [name, snippet] of entries) {
      const body = bodyOf(snippet)
      // the one-line if is the documented exception: whatever quotes wrap its
      // true and false attributes must be the reverse of the quotes inside them
      if (/^if-/.test(body)) continue
      test(`${name} has no single quoted attribute values`, () => {
        assert.doesNotMatch(body, /=\x27/, `single quoted attribute value in ${body}`)
      })
    }

    test('the one-line if keeps single quotes on true and false', () => {
      for (const [, snippet] of entries) {
        const body = bodyOf(snippet)
        if (!/^if-/.test(body)) continue
        assert.match(body, /true='/, `one-line if must single quote true: ${body}`)
        assert.match(body, /false='/, `one-line if must single quote false: ${body}`)
      }
    })
  })

  suite('inserted markup is what the documentation shows', () => {
    const expected = {
      '<loop': '<loop through="" val="">',
      '<include': '<include src=""></include>',
      '<arg': '<arg ></arg>',
      '<inlinecss': '<inline css=""></inline>',
      '<preparse': '<pre parse>'
    }
    for (const [typed, want] of Object.entries(expected)) {
      test(`typing "${typed}" inserts ${want}`, async () => {
        assert.equal(await acceptTopSuggestion(typed), want)
      })
    }
  })

  suite('the snippets file and the readme agree', () => {
    const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8')
    for (const [name, snippet] of entries) {
      const bare = prefixesOf(snippet).find(prefix => !prefix.startsWith('<'))
      test(`${name} is documented as \`${bare}\``, () => {
        assert.ok(readme.includes(`\`${bare}\``), `README.md does not document the ${bare} prefix`)
      })
    }
  })
})
