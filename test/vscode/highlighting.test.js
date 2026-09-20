const assert = require('node:assert/strict')
const { test, suite, before } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vscode = require('vscode')
const vsctm = require('vscode-textmate')
const oniguruma = require('vscode-oniguruma')

const REPO = path.join(__dirname, '..', '..')
const injection = JSON.parse(fs.readFileSync(path.join(REPO, 'syntaxes/teddy.injection.json'), 'utf8'))

// The unit suite tokenizes the injection grammar on its own. This one injects
// it into the html grammar shipped with the running VS Code, which is the only
// way to prove injectTo and injectionSelector actually wire it up: the
// extension api exposes no way to read TextMate scopes.
let grammar

before(async () => {
  const htmlGrammar = path.join(vscode.env.appRoot, 'extensions/html/syntaxes/html.tmLanguage.json')
  assert.ok(fs.existsSync(htmlGrammar), `could not find the html grammar at ${htmlGrammar}`)
  const html = JSON.parse(fs.readFileSync(htmlGrammar, 'utf8'))

  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'))
  await oniguruma.loadWASM(wasm)

  const grammars = { [html.scopeName]: html, [injection.scopeName]: injection }
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: patterns => new oniguruma.OnigScanner(patterns),
      createOnigString: line => new oniguruma.OnigString(line)
    }),
    loadGrammar: scope => Promise.resolve(grammars[scope] || null),
    // mirrors what package.json declares in contributes.grammars.injectTo
    getInjections: scope => injection.injectTo?.includes(scope) ||
      scope === html.scopeName ? [injection.scopeName] : undefined
  })

  grammar = await registry.loadGrammar(html.scopeName)
  assert.ok(grammar, 'the html grammar failed to load')
})

function commentedText (line) {
  const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL)
  return tokens
    .filter(token => token.scopes.some(scope => scope.startsWith('comment')))
    .map(token => line.substring(token.startIndex, token.endIndex))
    .join('')
}

suite('highlighting', () => {
  suite('teddy comments are highlighted inside html (issue #3)', () => {
    test('a curly bracket comment is greyed out', () => {
      assert.equal(commentedText('<p>{! server side !}</p>'), '{! server side !}')
    })

    test('the html style teddy comment is already an html comment', () => {
      assert.equal(commentedText('<!--! server side -->'), '<!--! server side -->')
    })

    test('an escape comment is treated as a comment by the html grammar', () => {
      assert.equal(commentedText('<!--#<p>hello</p>-->'), '<!--#<p>hello</p>-->')
    })

    test('a teddy variable is left alone', () => {
      assert.equal(commentedText('<p>{varName}</p>'), '')
    })

    test('markup around a comment is left alone', () => {
      assert.equal(commentedText('<p class="a">{! hidden !}</p>'), '{! hidden !}')
    })

    test('a comment inside an attribute value is not mistaken for markup', () => {
      assert.equal(commentedText('<p>{! a "quoted" comment !}</p>'), '{! a "quoted" comment !}')
    })
  })
})
