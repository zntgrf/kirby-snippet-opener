# Kirby Snippet Opener

[**Kirby Snippet Opener**](https://marketplace.visualstudio.com/items?itemName=zntgrf.kirbysnippetopener) is a Visual Studio Code extension for developers working with the [Kirby CMS](https://getkirby.com). It turns `snippet('...')` calls in your templates into links, so you can jump straight to the snippet file instead of hunting for it in the file tree.

[on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=zntgrf.kirbysnippetopener)

## Features

- **Jump to a snippet from its call**: the snippet name inside `snippet('...')` becomes a link. Ctrl+Click (Cmd+Click on macOS) opens the file. Works with both quote styles, with further arguments, and across several lines.

- **Several snippet folders, including plugins**: snippets are looked up in every configured folder, in order. Glob patterns such as `site/plugins/*/snippets` are supported, so snippets shipped by plugins are found as well.

- **Open Kirby Snippet**: run it from the command palette while the cursor is inside a `snippet(...)` call to open that snippet.

- **Create Snippet from Selection**: select one or more lines, run the command from the context menu (right click) or the command palette, enter a path such as `components/card`, and press Enter. The file is created and the selection is replaced with the matching `snippet('components/card')` call.

## Configuration

| Setting | Default | |
|---|---|---|
| `kirbysnippetopener.snippetPaths` | `["site/snippets", "site/plugins/*/snippets"]` | Folders to search, in order. The first hit wins. Glob patterns are allowed. New snippets are created in the first entry without a glob. |
| `kirbysnippetopener.snippetPath` | `site/snippets` | **Deprecated.** A single folder, used only when `snippetPaths` is empty. |

The defaults match a standard Kirby project, so in most cases there is nothing to configure.

## Usage

1. Open a PHP template that contains `snippet('...')` calls.
2. Ctrl+Click (Cmd+Click) the snippet name to open the file.

If a snippet is not found, no link appears — that is the quickest way to spot a typo or a snippet that has not been created yet.

## Notes

- Calls are found by pattern, not by parsing PHP. A call inside a comment is still linked, and a dynamic name such as `snippet($name)` or `snippet('a/' . $b)` is not.
- The snippet name has to be a plain string literal; the first matching file across the configured folders is opened.
