// validates the extension manifest's contributions before packaging
//
// vsce does not check any of this: it will happily package a snippets file containing invalid JSON, or an icon that is really a Git LFS pointer
//
// exports validate() so the checks can be unit tested against fixtures, and runs as a CLI when invoked directly.

const fs = require('fs')
const path = require('path')

const PNG_SIGNATURE = '\x89PNG\r\n\x1a\n'
const LFS_POINTER = 'version https://git-lfs'
const MIN_ICON_SIZE = 128
const CUSTOM_DATA_VERSION = 1.1

// reads and parses a declared JSON file, recording why it could not be used
function readJson (root, file, declaredIn, errors) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) {
    errors.push(`${file}: declared in ${declaredIn}, but the file does not exist`)
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'))
  } catch (err) {
    errors.push(`${file}: invalid JSON: ${err.message}`)
    return null
  }
}

function validateSnippets (file, snippets, errors) {
  const prefixes = new Map()

  for (const [name, snippet] of Object.entries(snippets)) {
    for (const field of ['prefix', 'body', 'description']) {
      if (!snippet[field]) errors.push(`${file}: "${name}" is missing a ${field}`)
    }
    if (!snippet.prefix || !snippet.body) continue

    // a prefix may be a string or an array of strings, and every one of them has to be unique across the file or the duplicate is unreachable
    for (const prefix of [snippet.prefix].flat()) {
      if (prefixes.has(prefix)) {
        errors.push(`${file}: "${name}" reuses the prefix "${prefix}" already used by "${prefixes.get(prefix)}"`)
      }
      prefixes.set(prefix, name)
    }

    // multiline bodies must be arrays of lines: VS Code joins array elements with newlines, so a "\n" inside an element is a redundant second mechanism
    if (Array.isArray(snippet.body) && snippet.body.some(line => line.includes('\n'))) {
      errors.push(`${file}: "${name}" has an array body whose elements contain newlines; use one array element per line`)
    }

    const body = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body

    // "${" opens a VS Code placeholder, so a literal Teddy template literal like ${someVar} has to be escaped as \${someVar}
    if (/(^|[^\\])\$\{/.test(body)) {
      errors.push(`${file}: "${name}" contains an unescaped "\${", which VS Code reads as a placeholder; escape it as "\\\${"`)
    }

    // tabstops must run 1..n with no gaps, or Tab navigation skips fields
    const tabstops = [...body.matchAll(/(?<!\\)\$(\d+)/g)].map(match => Number(match[1]))
    const ordered = [...new Set(tabstops)].sort((a, b) => a - b)
    const expected = ordered.map((_, index) => index + 1)
    if (String(ordered) !== String(expected)) {
      errors.push(`${file}: "${name}" has non-sequential tabstops (${ordered.join(', ') || 'none'}); they must run 1 to ${ordered.length}`)
    }

    // an element snippet needs a prefix that includes the "<", or VS Code anchors the replacement at the word and leaves a typed "<" behind, producing "<<if >"
    if (body.startsWith('<')) {
      const prefixList = [snippet.prefix].flat()
      const bare = prefixList.filter(prefix => !prefix.startsWith('<'))
      if (!prefixList.some(prefix => prefix.startsWith('<'))) {
        errors.push(`${file}: "${name}" inserts an element but has no prefix starting with "<", so typing "<" before it doubles the bracket`)
      }
      // the bare prefix is what ranks the snippet above similarly named built-in html tags, so it has to stay too
      if (!bare.length) {
        errors.push(`${file}: "${name}" has only an angled prefix; keep the bare prefix too so it outranks built-in html tags`)
      }
    }
  }

  return Object.keys(snippets).length
}

function validateGrammar (file, grammar, contribution, errors) {
  if (grammar.scopeName !== contribution.scopeName) {
    errors.push(`${file}: declares scopeName "${grammar.scopeName}", but package.json declares "${contribution.scopeName}"`)
  }
  if (contribution.injectTo && !grammar.injectionSelector) {
    errors.push(`${file}: is injected via injectTo but has no injectionSelector`)
  }
  if (!grammar.patterns?.length) {
    errors.push(`${file}: has no patterns`)
  }
  for (const [name, rule] of Object.entries(grammar.repository || {})) {
    if (rule.begin && !rule.end) errors.push(`${file}: repository rule "${name}" has a begin with no end`)
    if (!rule.begin && !rule.match && !rule.include && !rule.patterns) {
      errors.push(`${file}: repository rule "${name}" matches nothing`)
    }
  }
}

function validateCustomData (file, data, errors) {
  if (data.version !== CUSTOM_DATA_VERSION) {
    errors.push(`${file}: declares version ${data.version}; expected ${CUSTOM_DATA_VERSION}`)
  }

  const described = entry => typeof entry.description === 'string' ||
    typeof entry.description?.value === 'string'

  const tags = new Set()
  for (const tag of data.tags || []) {
    if (!tag.name) errors.push(`${file}: a tag has no name`)
    else if (tags.has(tag.name)) errors.push(`${file}: duplicate tag "${tag.name}"`)
    tags.add(tag.name)
    if (!described(tag)) errors.push(`${file}: tag "${tag.name}" has no description`)

    const attributes = new Set()
    for (const attribute of tag.attributes || []) {
      if (!attribute.name) errors.push(`${file}: tag "${tag.name}" has an attribute with no name`)
      else if (attributes.has(attribute.name)) {
        errors.push(`${file}: tag "${tag.name}" has a duplicate attribute "${attribute.name}"`)
      }
      attributes.add(attribute.name)
    }
  }

  const globals = new Set()
  for (const attribute of data.globalAttributes || []) {
    if (!attribute.name) errors.push(`${file}: a global attribute has no name`)
    else if (globals.has(attribute.name)) errors.push(`${file}: duplicate global attribute "${attribute.name}"`)
    globals.add(attribute.name)
    if (!described(attribute)) errors.push(`${file}: global attribute "${attribute.name}" has no description`)
  }
}

// the icon must be a real PNG of at least the size the marketplace expects. reading the header also catches the case where a Git LFS checkout without LFS support left a pointer file behind
function validateIcon (root, icon, errors) {
  const full = path.join(root, icon)
  if (!fs.existsSync(full)) {
    errors.push(`${icon}: declared as the icon, but the file does not exist`)
    return null
  }

  const buffer = fs.readFileSync(full)
  if (buffer.subarray(0, 8).toString('binary') !== PNG_SIGNATURE) {
    const isPointer = buffer.subarray(0, 40).toString('utf8').startsWith(LFS_POINTER)
    errors.push(`${icon}: ${isPointer
      ? 'is a Git LFS pointer, not a PNG; check out with LFS support (actions/checkout with lfs: true)'
      : 'is not a PNG'}`)
    return null
  }

  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  if (width < MIN_ICON_SIZE || height < MIN_ICON_SIZE) {
    errors.push(`${icon}: is ${width}x${height}; the marketplace expects at least ${MIN_ICON_SIZE}x${MIN_ICON_SIZE}`)
    return null
  }
  if (width !== height) {
    errors.push(`${icon}: is ${width}x${height}; it must be square`)
    return null
  }
  return { width, height }
}

// validates the extension rooted at `root`. Returns the human readable notes for what checked out and the list of problems found, so callers decide how to report them
function validate (root) {
  const notes = []
  const errors = []

  const manifest = readJson(root, 'package.json', 'the extension root', errors)
  if (!manifest) return { notes, errors }

  for (const contribution of manifest.contributes?.snippets || []) {
    const before = errors.length
    const snippets = readJson(root, contribution.path, 'contributes.snippets', errors)
    if (!snippets) continue
    const count = validateSnippets(contribution.path, snippets, errors)
    if (errors.length === before) notes.push(`${contribution.path}: ${count} snippets OK`)
  }

  for (const contribution of manifest.contributes?.grammars || []) {
    const before = errors.length
    const grammar = readJson(root, contribution.path, 'contributes.grammars', errors)
    if (!grammar) continue
    validateGrammar(contribution.path, grammar, contribution, errors)
    if (errors.length === before) notes.push(`${contribution.path}: grammar OK (${grammar.scopeName})`)
  }

  for (const file of manifest.contributes?.html?.customData || []) {
    const before = errors.length
    const data = readJson(root, file, 'contributes.html.customData', errors)
    if (!data) continue
    validateCustomData(file, data, errors)
    if (errors.length === before) {
      notes.push(`${file}: ${(data.tags || []).length} tags, ${(data.globalAttributes || []).length} global attributes OK`)
    }
  }

  if (manifest.icon) {
    const size = validateIcon(root, manifest.icon, errors)
    if (size) notes.push(`${manifest.icon}: ${size.width}x${size.height} PNG OK`)
  }

  return { notes, errors }
}

// prints what validate() found and returns the exit code the caller should use. Kept separate from the reporting side effects so it can be tested without spawning a process or trapping process.exit
function report ({ notes, errors }, log = console.log, logError = console.error) {
  for (const note of notes) log(note)

  if (errors.length) {
    logError(`\n${errors.length} problem${errors.length === 1 ? '' : 's'} found:`)
    for (const message of errors) logError(`  - ${message}`)
    return 1
  }

  log('\nAll contributions valid.')
  return 0
}

module.exports = { validate, report }

if (require.main === module) {
  process.exitCode = report(validate(path.join(__dirname, '..')))
}
