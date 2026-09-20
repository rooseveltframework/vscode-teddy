const fs = require('fs')
const os = require('os')
const path = require('path')

// Writes a throwaway extension into a temp directory so the validator can be
// pointed at a deliberately broken manifest. `files` maps a relative path to a
// string or Buffer, written verbatim, or an object, written as JSON.
function fixture (t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-teddy-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  for (const [name, content] of Object.entries(files)) {
    const full = path.join(root, name)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    const verbatim = typeof content === 'string' || Buffer.isBuffer(content)
    fs.writeFileSync(full, verbatim ? content : JSON.stringify(content))
  }
  return root
}

// A minimal valid snippet, so each test can break exactly one thing.
const snippet = (overrides = {}) => ({
  prefix: 'thing', body: 'thing', description: 'A thing.', ...overrides
})

const snippetsManifest = (extra = {}) => ({
  name: 'fixture',
  contributes: { snippets: [{ language: 'html', path: './snippets/teddy.json' }] },
  ...extra
})

const grammarContribution = {
  scopeName: 'text.html.teddy.injection',
  path: './syntaxes/teddy.injection.json',
  injectTo: ['text.html.basic']
}

const grammar = (overrides = {}) => ({
  scopeName: 'text.html.teddy.injection',
  injectionSelector: 'L:text.html -comment',
  patterns: [{ include: '#teddy-comment' }],
  repository: { 'teddy-comment': { name: 'comment.block.teddy.html', begin: '\\{!', end: '!\\}' } },
  ...overrides
})

const customData = (overrides = {}) => ({
  version: 1.1,
  tags: [{ name: 'loop', description: 'Loops.', attributes: [{ name: 'through' }] }],
  globalAttributes: [{ name: 'selected-value', description: 'Selects.' }],
  ...overrides
})

// A real 128x128 PNG header is all the validator reads, so build one rather
// than committing binary fixtures.
function png (width, height) {
  const buffer = Buffer.alloc(24)
  buffer.write('\x89PNG\r\n\x1a\n', 0, 'binary')
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

module.exports = { fixture, snippet, snippetsManifest, grammarContribution, grammar, customData, png }
