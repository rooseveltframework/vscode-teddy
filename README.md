# vscode-teddy

Snippets for the [Teddy templating engine](https://github.com/rooseveltframework/teddy) for Visual Studio Code.

See Teddy's GitHub page on [how to write Teddy templates](https://github.com/rooseveltframework/teddy#how-to-write-teddy-templates).

The included snippets include the following features:

- `<include>`
- `<arg>`
- `<if>`
- `<elseif>`
- `<else>`
- `<unless>`
- `<elseunless>`
- `inline-if statement`
- `<loop>`
- `<cache>`

## Development

- Install dependencies: `npm ci`
- Create extension: `vsce package`
- Install extension: `code --install-extension *.vsix`
- Cycling through changes to the extension quickly: `vsce package && code --install-extension *.vsix && code`
