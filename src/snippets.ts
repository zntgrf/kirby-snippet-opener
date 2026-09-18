/**
 * Snippet parsing and path resolution.
 *
 * This module deliberately has no `vscode` import so it can be unit tested
 * against plain strings and real files. All paths are workspace-relative and
 * use "/" as separator; turning them into URIs is the caller's job.
 */

/** A `snippet(...)` call, with absolute offsets of the name inside the text. */
export interface SnippetCall {
  name: string;
  quote: string;
  nameStart: number;
  nameEnd: number;
}

/**
 * Matches `snippet('name')` / `snippet("name", ...)`.
 *
 * The lookbehind keeps `mysnippet(` and `$snippet(` out, and requiring the
 * argument to end right after the closing quote keeps concatenations like
 * `snippet('a/' . $b)` out.
 */
const SNIPPET_CALL_PATTERN = /(?<![\w$])snippet\(\s*(['"])([^'"]+)\1\s*[,)]/;

export function getSnippetRegex(): RegExp {
  return new RegExp(SNIPPET_CALL_PATTERN.source, "g");
}

export function findSnippetCalls(text: string): SnippetCall[] {
  const regex = getSnippetRegex();
  const calls: SnippetCall[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const quote = match[1];
    const name = match[2];
    const nameStart = match.index + match[0].indexOf(quote) + 1;

    calls.push({ name, quote, nameStart, nameEnd: nameStart + name.length });
  }

  return calls;
}

export const DEFAULT_SNIPPET_PATHS = ["site/snippets", "site/plugins/*/snippets"];

export interface SnippetPathConfig {
  snippetPaths?: string[];
  snippetPath?: string;
}

/**
 * The configured snippet folders, in lookup order. The deprecated single-path
 * setting is only used when the multi-path one is unset or empty.
 */
export function resolveSnippetPaths(config: SnippetPathConfig): string[] {
  if (config.snippetPaths && config.snippetPaths.length > 0) {
    return config.snippetPaths;
  }

  if (config.snippetPath) {
    return [config.snippetPath];
  }

  return [...DEFAULT_SNIPPET_PATHS];
}

/** New snippets go into the first configured path that is not a glob. */
export function findSnippetCreationBase(paths: string[]): string | undefined {
  return paths.find((path) => !isGlob(path));
}

/** The file system access `resolveSnippetFile` needs, kept minimal on purpose. */
export interface SnippetFileSystem {
  /** True if a workspace-relative file exists. */
  fileExists(path: string): Promise<boolean>;
  /** Names of the subdirectories of a workspace-relative path; [] if missing. */
  readDirectories(path: string): Promise<string[]>;
}

/**
 * Finds `<pattern>/<name>.php` in the first configured path that has it.
 * Glob patterns such as `site/plugins/*\/snippets` are expanded per segment.
 * Returns the workspace-relative path, or null if the snippet does not exist.
 */
export async function resolveSnippetFile(
  fileSystem: SnippetFileSystem,
  paths: string[],
  name: string
): Promise<string | null> {
  for (const pattern of paths) {
    const bases = isGlob(pattern)
      ? await expandGlob(fileSystem, pattern)
      : [pattern];

    for (const base of bases) {
      const candidate = `${base}/${name}.php`;
      if (await fileSystem.fileExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function isGlob(path: string): boolean {
  return path.includes("*");
}

async function expandGlob(
  fileSystem: SnippetFileSystem,
  pattern: string
): Promise<string[]> {
  let bases: string[] = [""];

  for (const segment of pattern.split("/")) {
    if (!isGlob(segment)) {
      bases = bases.map((base) => join(base, segment));
      continue;
    }

    const matches = segmentMatcher(segment);
    const expanded: string[] = [];

    for (const base of bases) {
      for (const entry of await fileSystem.readDirectories(base)) {
        if (matches.test(entry)) {
          expanded.push(join(base, entry));
        }
      }
    }

    bases = expanded;
  }

  return bases;
}

function segmentMatcher(segment: string): RegExp {
  const source = segment
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");

  return new RegExp(`^${source}$`);
}

function join(base: string, segment: string): string {
  return base ? `${base}/${segment}` : segment;
}
