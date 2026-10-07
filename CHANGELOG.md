## 2.1.0

- Breaking: Removed the `<cache>` snippets (`cache`, `cachekey`, `cachemaxage`, `cachemaxcaches`, and `cacheall`) and the `<cache>` IntelliSense, since Teddy has removed the `<cache>` element.
- Updated dependencies.

## 2.0.0

- Breaking: Bumped minimum supported Visual Studio Code version to 1.75.
- Breaking: Changed snippet bodies to use double quotes for attribute values, matching the Teddy documentation.
- Added IntelliSense for the attributes that make an `<include>` a web component: `as`, which names the custom element to render into, `hydrate`, which names the model keys the component is sent, and `mode`, which says where its markup goes. The three values `mode` accepts are completed and documented individually.
- Added `includeas`, `includeasarg`, and `includehydrate` snippets for those.
- Added snippets for the rest of the Teddy feature set: `{var|s}`, `{var|p}`, `<escape>`, escape comments, server-side comments, `<inline>`, `<if>`/`<unless>` value checks, `and`/`or`/`xor`/`not:` boolean logic, one-line if value checks, `selected-value`, `checked-value`, `<noteddy>`, `<noparse>`, and `<pre parse>`.
- Added IntelliSense for Teddy tags and attributes via VS Code custom data, so they autocomplete and document themselves on hover.
- Added syntax highlighting for `{! server-side comments !}`, which are now greyed out like the `<!--! -->` form already was.
- Updated the `<include>` hover documentation to mention that a child which is not an `<arg>` becomes the component's light DOM.
- Fixed element snippets inserting a doubled `<` when the `<` was typed before the prefix, e.g. typing `<loop` producing `<<loop through="" val="">`. Element snippets now carry both a bare and an angled prefix.
- Fixed the `<arg>` snippet: `<arg>` requires an argument name, e.g. `<arg myArg>`.
- Fixed the one-line if snippet: the `true` and `false` attributes now use single quotes so the attributes written inside them can use double quotes.
- Added `<include>` with `<arg>` and `<unless>` with `<else>` snippets.
- Updated dependencies.

## 1.0.2

- Added support for `<cache>` element.
- Various refactoring.

## 1.0.1

- Added icon and updated README.

## 1.0.0

- Initial release.
