# vscode-teddy

Visual Studio Code extension for the [Teddy templating engine](https://github.com/rooseveltframework/teddy).

In HTML files this extension provides:

- **Snippets** for the whole Teddy feature set.
- **IntelliSense** for Teddy tags and attributes: completions as you type, and hover documentation.
- **Syntax highlighting** for Teddy's `{! server-side comments !}`, which are otherwise rendered as ordinary text.

## Snippets

Type a prefix and press <kbd>Tab</kbd>. Element snippets also accept a leading `<`, so both `loop` and `<loop` insert a `<loop>` block.

### Variables and escaping

| Prefix | Inserts |
| --- | --- |
| `unescaped` | `{varName\|s}` — suppress escaping of HTML entities |
| `unparsed` | `{varName\|p}` — do not parse the variable's contents |
| `escape` | `<escape>` element |
| `escapecomment` | `<!--# … -->` escape comment |
| `comment` | `<!--! … -->` server-side comment |
| `curlycomment` | `{! … !}` server-side comment |
| `inlinecss` | `<inline css>` element |
| `inlinejs` | `<inline js>` element |

### Includes

| Prefix | Inserts |
| --- | --- |
| `include` | `<include>` element |
| `includearg` | `<include>` element containing an `<arg>` |
| `arg` | `<arg>` argument |

### Web components

| Prefix | Inserts |
| --- | --- |
| `includeas` | `<include>` element rendered as a web component |
| `includeasarg` | `<include>` element rendered as a web component, containing an `<arg>` |
| `includehydrate` | `<include>` element rendered as a web component that is sent model keys |

### Conditionals

| Prefix | Inserts |
| --- | --- |
| `if` | `<if>` block |
| `ifvalue` | `<if>` block checking a value |
| `else` | `<else>` block |
| `ifelse` | `<if>` `<else>` block |
| `elseif` | `<elseif>` block |
| `unless` | `<unless>` block |
| `unlesselse` | `<unless>` `<else>` block |
| `elseunless` | `<elseunless>` block |
| `ifand` | `<if>` block using the `and` operator |
| `ifor` | `<if>` block using the `or` operator |
| `ifxor` | `<if>` block using the `xor` operator |
| `ifnot` | `<if>` block using the `not:` prefix |
| `onelineif` | one-line `if-*` attribute |
| `onelineifvalue` | one-line `if-*` attribute checking a value |

### Loops

| Prefix | Inserts |
| --- | --- |
| `loop` | `<loop>` block |
| `loopkey` | `<loop>` block with a `key` attribute |

### Form helpers

| Prefix | Inserts |
| --- | --- |
| `selectedvalue` | `selected-value` attribute |
| `checkedvalue` | `checked-value` attribute |

### Non-parsed blocks

| Prefix | Inserts |
| --- | --- |
| `noteddy` | `<noteddy>` block |
| `noparse` | `<noparse>` block |
| `preparse` | `<pre parse>` block |

### Caching

| Prefix | Inserts |
| --- | --- |
| `cache` | `<cache>` block |
| `cachekey` | `<cache>` block with a `key` attribute |
| `cachemaxage` | `<cache>` block with `key` and `maxAge` attributes |
| `cachemaxcaches` | `<cache>` block with `key` and `maxCaches` attributes |
| `cacheall` | `<cache>` block with `key`, `maxAge`, and `maxCaches` attributes |

## IntelliSense

Teddy's tags and attributes are registered with Visual Studio Code's HTML language service, so `<include>`, `<arg>`, `<if>`, `<elseif>`, `<else>`, `<unless>`, `<elseunless>`, `<loop>`, `<cache>`, `<noteddy>`, `<noparse>`, `<escape>`, and `<inline>` autocomplete and document themselves on hover, along with their attributes and the `selected-value`, `checked-value`, `true`, `false`, and `parse` attributes.

`<include>` carries the attributes that make it a web component: `as` names the custom element to render into, `hydrate` names the model keys the component is sent, and `mode` says where its markup goes. The three values `mode` accepts (`both`, `shadow`, and `light`) are completed and documented individually.

One-line ifs are not completed, because the attribute name varies with the variable being tested (`if-something`) and the custom data format has no way to express a wildcard attribute. Use the `onelineif` snippet instead.

## Comments

Teddy has two server-side comment syntaxes, and both are stripped when the template is compiled:

```html
<!--! this is a server-side comment -->
{! this is also a server-side comment !}
```

The first is already an HTML comment, so Visual Studio Code greys it out on its own. This extension adds highlighting for the second.

<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>/</kbd> still inserts a plain `<!-- -->` comment rather than a Teddy one. Changing that would mean overriding the comment syntax for every HTML file, which breaks uncommenting: Visual Studio Code would no longer recognise an existing `<!-- -->` comment, and toggling one would nest it inside a Teddy comment and corrupt the markup. Use the `comment` or `curlycomment` snippet instead.
