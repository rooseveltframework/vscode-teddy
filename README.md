# vscode-teddy

Visual Studio Code extension for the [Teddy templating engine](https://github.com/rooseveltframework/teddy).

Snippets are available for:

- `<include>`
- `<arg>`
- `<if>`
- `<elseif>`
- `<else>`
- `<unless>`
- `<elseunless>`
- `one-line if statement`
- `<loop>`
- `<cache>`

## Development

- Install dependencies: `npm ci`
- Create extension: `vsce package`
- Install extension: `code --install-extension *.vsix`
- Cycling through changes to the extension quickly: `vsce package && code --install-extension *.vsix && code`
