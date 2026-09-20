const assert = require('node:assert/strict')
const { test, suite, before } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vsctm = require('vscode-textmate')
const oniguruma = require('vscode-oniguruma')

const REPO = path.join(__dirname, '..', '..')
const injection = JSON.parse(fs.readFileSync(path.join(REPO, 'syntaxes/teddy.injection.json'), 'utf8'))

// Tokenizes the injection grammar on its own. This proves the patterns match
// what they should and carry the scopes that make an editor grey them out.
// Whether the grammar actually reaches html files is covered by the editor
// suite, which injects it into the real html grammar.
let grammar

before(async () => {
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'))
  await oniguruma.loadWASM(wasm)
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: patterns => new oniguruma.OnigScanner(patterns),
      createOnigString: line => new oniguruma.OnigString(line)
    }),
    loadGrammar: scope => Promise.resolve(scope === injection.scopeName ? injection : null)
  })
  grammar = await registry.loadGrammar(injection.scopeName)
  assert.ok(grammar, 'the injection grammar failed to load')
})

// Returns the source text of every token scoped as a comment.
function commentedText (line) {
  const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL)
  return tokens
    .filter(token => token.scopes.some(scope => scope.startsWith('comment')))
    .map(token => line.substring(token.startIndex, token.endIndex))
    .join('')
}

function scopesFor (line, needle) {
  const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL)
  const index = line.indexOf(needle)
  const token = tokens.find(t => t.startIndex <= index && index < t.endIndex)
  return token ? token.scopes : []
}

suite('teddy comment highlighting', () => {
  test('a curly bracket comment is scoped as a comment', () => {
    assert.equal(commentedText('{! a comment !}'), '{! a comment !}')
  })

  test('the comment scope is one an editor theme greys out', () => {
    assert.ok(
      scopesFor('{! a comment !}', 'a comment').includes('comment.block.teddy.html'),
      'expected the comment.block scope themes key off'
    )
  })

  test('the delimiters are scoped as punctuation', () => {
    assert.ok(scopesFor('{! a comment !}', '{!').includes('punctuation.definition.comment.teddy.html'))
  })

  test('only the comment is scoped, not the markup around it', () => {
    assert.equal(commentedText('<p>{! hidden !}</p> visible'), '{! hidden !}')
  })

  test('a comment with no spaces is still matched', () => {
    assert.equal(commentedText('{!hidden!}'), '{!hidden!}')
  })

  test('an ordinary teddy variable is not treated as a comment', () => {
    assert.equal(commentedText('<p>{varName}</p>'), '')
  })

  test('an unescaped variable flag is not treated as a comment', () => {
    assert.equal(commentedText('<p>{varName|s}</p>'), '')
  })

  test('a lone curly bracket is not treated as a comment', () => {
    assert.equal(commentedText('<style>a{color:red}</style>'), '')
  })

  test('an unterminated comment runs to the end of the line', () => {
    assert.equal(commentedText('{! never closed'), '{! never closed')
  })

  test('two comments on one line are matched separately', () => {
    assert.equal(commentedText('{! one !} between {! two !}'), '{! one !}{! two !}')
  })

  test('a comment continues across lines until it closes', () => {
    const first = grammar.tokenizeLine('{! opens here', vsctm.INITIAL)
    const second = grammar.tokenizeLine('still inside !} outside', first.ruleStack)
    const inside = second.tokens
      .filter(token => token.scopes.some(scope => scope.startsWith('comment')))
      .map(token => 'still inside !} outside'.substring(token.startIndex, token.endIndex))
      .join('')
    assert.equal(inside, 'still inside !}')
  })
})
