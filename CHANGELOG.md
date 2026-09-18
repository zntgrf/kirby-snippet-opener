# Change Log

All notable changes to the "kirbysnippetopener" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.6]

### Fixed

- `snippet('a/' . $b)`, `mysnippet('x')` and `$snippet('x')` no longer produce snippet links.
- A `snippet(...)` call nested inside another one is now linked as well.
- "Create Snippet from Selection" no longer leaves a broken reference: entering `snippets/card` created `site/snippets/snippets/card.php` while inserting `snippet('card')`, and `card.php` created `card.php.php`. Input is now normalized once, and paths containing `..` are rejected.
- "Open Kirby Snippet" works from the command palette: it opens the snippet the cursor is in instead of always reporting `undefined.php` could not be found.

### Changed

- Snippet lookup is resolved once per file instead of once per call, so a template with many `snippet(...)` calls no longer walks the plugin folders repeatedly on every edit.

### Changed

- README corrected: it advertised a CodeLens integration that does not exist and the wrong default path, and never mentioned the multi-folder lookup.
- Dev tooling rebuilt: single test runner (vitest), no mocha; all 11 known audit findings in the development dependencies resolved. Nothing here affects the shipped extension, which has no runtime dependencies.
- The published `.vsix` now contains only the compiled output, the icon and the documentation files.

## [0.1.5]

- Snippet lookup across several folders via `kirbysnippetopener.snippetPaths`, including glob patterns such as `site/plugins/*/snippets`.
- "Create Snippet from Selection" command.
