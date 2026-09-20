const vscode = require('vscode')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// One document is opened for the whole run and its contents replaced between
// cases. Opening and closing a document per case makes VS Code log
// "Model is disposed!" as the suggest widget's observables read the editor it
// just tore down, which buries the test output.
let editor

async function open () {
  if (!editor) {
    const document = await vscode.workspace.openTextDocument({ language: 'html', content: '' })
    editor = await vscode.window.showTextDocument(document, { preserveFocus: false })
  }
  return editor
}

// editor.action.triggerSuggest does nothing unless the editor has focus, and
// under a virtual display it does not reliably start with it. Without this the
// suggest widget never opens and every test that drives it fails together.
async function focusEditor () {
  await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup')
  await sleep(50)
}

async function setLine (text) {
  const active = await open()
  const { document } = active
  const all = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))
  await active.edit(builder => builder.replace(all, text))
  const position = new vscode.Position(0, text.length)
  active.selection = new vscode.Selection(position, position)
  return document
}

// Types `typed`, opens the suggest widget, and accepts whatever it ranks
// first. This deliberately goes through the real widget rather than
// executeCompletionItemProvider, because the bug in
// https://github.com/rooseveltframework/vscode-teddy/issues/1 is about the
// range VS Code replaces, and the ranking against built-in html tags matters
// just as much as the snippet being offered at all.
//
// How long the widget takes to populate depends on how busy the machine is, so
// this retries with a growing wait rather than sleeping for a fixed time. A
// fixed wait long enough to be reliable under load wastes that long on every
// one of these, and a shorter one fails intermittently.
async function acceptTopSuggestion (typed, attempts = 5) {
  let text = typed

  for (let attempt = 1; attempt <= attempts && text === typed; attempt++) {
    const document = await setLine(typed)
    await focusEditor()
    await vscode.commands.executeCommand('editor.action.triggerSuggest')
    await sleep(150 * attempt)
    await vscode.commands.executeCommand('acceptSelectedSuggestion')
    await sleep(100)
    text = document.getText().split('\n')[0]
  }

  // unchanged means the widget never offered anything; let the caller assert
  // on it and report what it expected
  return text
}

// Accepts the suggestion with this exact label rather than the top ranked one,
// so a snippet can be checked even when something else outranks it.
async function insertByLabel (typed, label) {
  const document = await setLine(typed)
  const list = await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider', document.uri, new vscode.Position(0, typed.length)
  )
  const item = list.items.find(entry => labelOf(entry) === label)
  if (!item) return null

  const range = item.range?.replacing ?? item.range
  const body = typeof item.insertText === 'string' ? item.insertText : item.insertText.value
  const active = await open()
  // strip tabstops so the result can be compared to the snippet body
  await active.edit(builder => builder.replace(range, body.replace(/(?<!\\)\$\d+/g, '')))
  return document.getText()
}

// The range a completion would replace. Typing "<loop" must yield a range
// starting at column 0 so the "<" is consumed; a range starting at column 1
// leaves it behind and produces "<<loop ...". This is the doubled bracket from
// issues/1, asserted without waiting on the suggest widget.
async function completionRange (typed, label) {
  const document = await setLine(typed)
  const list = await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider', document.uri, new vscode.Position(0, typed.length)
  )
  const item = list.items.find(entry => labelOf(entry) === label)
  if (!item) return null
  const range = item.range?.replacing ?? item.range
  const body = typeof item.insertText === 'string' ? item.insertText : item.insertText.value
  return { start: range.start.character, end: range.end.character, body }
}

async function completionLabels (content, character) {
  const document = await setLine(content)
  const list = await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider', document.uri, new vscode.Position(0, character)
  )
  return list.items.map(labelOf)
}

async function hoverText (content, character) {
  const document = await setLine(content)
  const hovers = await vscode.commands.executeCommand(
    'vscode.executeHoverProvider', document.uri, new vscode.Position(0, character)
  )
  return hovers
    .flatMap(hover => hover.contents.map(part => typeof part === 'string' ? part : part.value))
    .join('\n')
}

const labelOf = item => typeof item.label === 'string' ? item.label : item.label.label

module.exports = {
  sleep, setLine, acceptTopSuggestion, insertByLabel, completionRange, completionLabels, hoverText, labelOf
}
