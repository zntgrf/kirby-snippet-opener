# Change Log

All notable changes to the "kirbysnippetopener" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.6]

### Fixed

- `snippet('a/' . $b)`, `mysnippet('x')` and `$snippet('x')` no longer produce snippet links.
- A `snippet(...)` call nested inside another one is now linked as well.

### Changed

- Dev tooling rebuilt: single test runner (vitest), no mocha; all 11 known audit findings in the development dependencies resolved. Nothing here affects the shipped extension, which has no runtime dependencies.
- The published `.vsix` now contains only the compiled output, the icon and the documentation files.

## [0.1.5]

- Snippet lookup across several folders via `kirbysnippetopener.snippetPaths`, including glob patterns such as `site/plugins/*/snippets`.
- "Create Snippet from Selection" command.
