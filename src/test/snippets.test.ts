import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, stat, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  DEFAULT_SNIPPET_PATHS,
  findSnippetCallAt,
  findSnippetCalls,
  findSnippetCreationBase,
  normalizeSnippetName,
  resolveSnippetFile,
  resolveSnippetPaths,
  SnippetFileSystem
} from "../snippets";

const names = (text: string) => findSnippetCalls(text).map((call) => call.name);

describe("findSnippetCalls", () => {
  it.each([
    { label: "variable as argument", text: `snippet($name)` },
    { label: "concatenated argument", text: `snippet('a/' . $b)` },
    { label: "function with snippet suffix", text: `mysnippet('x')` },
    { label: "variable function call", text: `$snippet('x')` },
    { label: "plural function name", text: `snippets('x')` },
    { label: "unquoted argument", text: `snippet(test)` },
    { label: "mixed quotes", text: `snippet('mixed")` },
    { label: "unclosed quote", text: `snippet('unclosed` },
    { label: "empty name", text: `snippet('')` },
    { label: "the bare word snippet", text: `return 'snippet';` }
  ])("does not match $label", ({ text }) => {
    expect(names(text)).toEqual([]);
  });

  it.each([
    { label: "single quotes", text: `snippet('header')`, expected: ["header"] },
    { label: "double quotes", text: `snippet("header")`, expected: ["header"] },
    {
      label: "whitespace around the argument",
      text: `snippet(  'header'  )`,
      expected: ["header"]
    },
    {
      label: "a subfolder",
      text: `snippet('components/card')`,
      expected: ["components/card"]
    },
    {
      label: "a second argument",
      text: `snippet('card', $data)`,
      expected: ["card"]
    },
    {
      label: "named arguments",
      text: `snippet('card', slots: true)`,
      expected: ["card"]
    },
    {
      label: "an array argument with quotes inside",
      text: `snippet('card', ['key' => 'value'])`,
      expected: ["card"]
    },
    {
      label: "several calls on one line",
      text: `snippet('first'); snippet("second", $data)`,
      expected: ["first", "second"]
    },
    {
      label: "a call spread over several lines",
      text: `snippet('card',\n  ['data' => $value],\n  true\n)`,
      expected: ["card"]
    },
    {
      label: "a nested call",
      text: `snippet('outer', [snippet('inner')])`,
      expected: ["outer", "inner"]
    },
    {
      label: "a call after a method arrow",
      text: `$page->snippet('card')`,
      expected: ["card"]
    }
  ])("matches $label", ({ text, expected }) => {
    expect(names(text)).toEqual(expected);
  });

  // Comments are not parsed. Both of these produce links today; changing that
  // would need real PHP awareness, so the current behaviour is pinned here.
  it.each([
    { label: "a line comment", text: `// snippet('card')` },
    { label: "a hash comment", text: `# snippet('card')` },
    { label: "a block comment", text: `/* snippet('card') */` }
  ])("still matches inside $label", ({ text }) => {
    expect(names(text)).toEqual(["card"]);
  });

  it.each([
    { label: "single quotes", text: `<?php snippet('card') ?>`, quote: "'" },
    { label: "double quotes", text: `<?php snippet("card") ?>`, quote: '"' }
  ])("reports the name offsets and quote for $label", ({ text, quote }) => {
    const [call] = findSnippetCalls(text);

    expect(call.quote).toBe(quote);
    expect(text.slice(call.nameStart, call.nameEnd)).toBe("card");
  });

  it("reports offsets for every call on a line", () => {
    const text = `snippet('first'); snippet('second')`;

    for (const call of findSnippetCalls(text)) {
      expect(text.slice(call.nameStart, call.nameEnd)).toBe(call.name);
    }
  });

  it("returns a fresh regex per call so state does not leak", () => {
    const text = `snippet('card')`;

    expect(names(text)).toEqual(names(text));
  });
});

describe("findSnippetCallAt", () => {
  const line = `<?php snippet('card'); snippet('other') ?>`;

  it.each([
    { label: "on the function name", offset: line.indexOf("snippet"), expected: "card" },
    { label: "on the opening quote", offset: line.indexOf("'card'"), expected: "card" },
    { label: "inside the name", offset: line.indexOf("card") + 2, expected: "card" },
    { label: "on the closing paren", offset: line.indexOf("');") + 1, expected: "card" },
    { label: "inside the second call", offset: line.indexOf("other") + 1, expected: "other" }
  ])("finds the call with the cursor $label", ({ offset, expected }) => {
    expect(findSnippetCallAt(line, offset)?.name).toBe(expected);
  });

  it.each([
    { label: "before any call", offset: 0 },
    { label: "between two calls", offset: line.indexOf("; snippet") + 1 },
    { label: "after the last call", offset: line.length }
  ])("returns undefined with the cursor $label", ({ offset }) => {
    expect(findSnippetCallAt(line, offset)).toBeUndefined();
  });

  it("returns undefined when there is no call at all", () => {
    expect(findSnippetCallAt(`echo 'hello';`, 3)).toBeUndefined();
  });
});

describe("resolveSnippetPaths", () => {
  it.each([
    {
      label: "uses snippetPaths when set",
      config: { snippetPaths: ["a", "b"], snippetPath: "deprecated" },
      expected: ["a", "b"]
    },
    {
      label: "falls back to the deprecated snippetPath when snippetPaths is empty",
      config: { snippetPaths: [], snippetPath: "deprecated" },
      expected: ["deprecated"]
    },
    {
      label: "falls back to the deprecated snippetPath when snippetPaths is unset",
      config: { snippetPath: "deprecated" },
      expected: ["deprecated"]
    },
    {
      label: "uses the defaults when nothing is configured",
      config: {},
      expected: DEFAULT_SNIPPET_PATHS
    },
    {
      label: "uses the defaults when both settings are empty",
      config: { snippetPaths: [], snippetPath: "" },
      expected: DEFAULT_SNIPPET_PATHS
    }
  ])("$label", ({ config, expected }) => {
    expect(resolveSnippetPaths(config)).toEqual(expected);
  });
});

describe("normalizeSnippetName", () => {
  it.each([
    { label: "a plain name", input: "card", expected: "card" },
    { label: "a subfolder", input: "components/card", expected: "components/card" },
    { label: "surrounding whitespace", input: "  card  ", expected: "card" },
    { label: "a snippets/ prefix", input: "snippets/card", expected: "card" },
    { label: "a .php suffix", input: "card.php", expected: "card" },
    { label: "an uppercase .PHP suffix", input: "card.PHP", expected: "card" },
    { label: "both prefix and suffix", input: "snippets/components/card.php", expected: "components/card" },
    { label: "a leading slash", input: "/card", expected: "card" },
    { label: "backslashes", input: "components\\card", expected: "components/card" },
    { label: "a dot inside a name", input: "card.v2", expected: "card.v2" }
  ])("normalizes $label", ({ input, expected }) => {
    expect(normalizeSnippetName(input)).toBe(expected);
  });

  it.each([
    { label: "empty input", input: "" },
    { label: "whitespace only", input: "   " },
    { label: "only a suffix", input: ".php" },
    { label: "a parent segment", input: "../secrets" },
    { label: "a parent segment in the middle", input: "components/../../secrets" },
    { label: "a current-directory segment", input: "./card" },
    { label: "a double slash", input: "components//card" },
    { label: "a trailing slash", input: "components/" }
  ])("rejects $label", ({ input }) => {
    expect(normalizeSnippetName(input)).toBeNull();
  });

  it("produces a name that the parser finds again", () => {
    const name = normalizeSnippetName("snippets/components/card.php");

    expect(names(`snippet('${name}')`)).toEqual([name]);
  });
});

describe("findSnippetCreationBase", () => {
  it.each([
    { label: "the first plain path", paths: ["site/snippets", "x/*/y"], expected: "site/snippets" },
    { label: "skipping leading globs", paths: ["x/*/y", "site/snippets"], expected: "site/snippets" },
    { label: "nothing when every path is a glob", paths: ["x/*/y"], expected: undefined }
  ])("returns $label", ({ paths, expected }) => {
    expect(findSnippetCreationBase(paths)).toBe(expected);
  });
});

describe("resolveSnippetFile", () => {
  let root: string;
  let files: SnippetFileSystem;

  // Mirrors the vscode.workspace.fs implementation in extension.ts: a
  // successful stat counts as existing, and only directories are walked.
  const nodeFileSystem = (base: string): SnippetFileSystem => ({
    async fileExists(path) {
      try {
        await stat(join(base, ...path.split("/")));
        return true;
      } catch {
        return false;
      }
    },
    async readDirectories(path) {
      try {
        const target = path ? join(base, ...path.split("/")) : base;
        const entries = await readdir(target, { withFileTypes: true });
        return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
      } catch {
        return [];
      }
    }
  });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "kirbysnippetopener-"));

    const fixtures = [
      "site/snippets/header.php",
      "site/snippets/shared.php",
      "site/snippets/components/card.php",
      "site/plugins/blog/snippets/post.php",
      "site/plugins/shop/snippets/shared.php",
      "site/plugins/shop/templates/product.php",
      "custom/snippets/legacy.php"
    ];

    for (const fixture of fixtures) {
      const file = join(root, ...fixture.split("/"));
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, "<?php\n");
    }

    await mkdir(join(root, "site", "snippets", "empty-folder"), { recursive: true });

    files = nodeFileSystem(root);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each([
    {
      label: "a snippet in the plain path",
      name: "header",
      paths: DEFAULT_SNIPPET_PATHS,
      expected: "site/snippets/header.php"
    },
    {
      label: "a snippet in a subfolder",
      name: "components/card",
      paths: DEFAULT_SNIPPET_PATHS,
      expected: "site/snippets/components/card.php"
    },
    {
      label: "a snippet behind a glob",
      name: "post",
      paths: DEFAULT_SNIPPET_PATHS,
      expected: "site/plugins/blog/snippets/post.php"
    },
    {
      label: "the first configured path when a snippet exists twice",
      name: "shared",
      paths: DEFAULT_SNIPPET_PATHS,
      expected: "site/snippets/shared.php"
    },
    {
      label: "the plugin copy when only the glob is configured",
      name: "shared",
      paths: ["site/plugins/*/snippets"],
      expected: "site/plugins/shop/snippets/shared.php"
    },
    {
      label: "a snippet below the deprecated single path",
      name: "legacy",
      paths: resolveSnippetPaths({ snippetPath: "custom/snippets" }),
      expected: "custom/snippets/legacy.php"
    },
    {
      label: "a snippet below a glob that is not the last segment",
      name: "post",
      paths: ["site/*/blog/snippets"],
      expected: "site/plugins/blog/snippets/post.php"
    }
  ])("finds $label", async ({ name, paths, expected }) => {
    expect(await resolveSnippetFile(files, paths, name)).toBe(expected);
  });

  it.each([
    { label: "the snippet does not exist", name: "missing", paths: DEFAULT_SNIPPET_PATHS },
    { label: "only a template of that name exists", name: "product", paths: DEFAULT_SNIPPET_PATHS },
    { label: "the configured folder does not exist", name: "header", paths: ["does/not/exist"] },
    { label: "the glob matches nothing", name: "header", paths: ["nope/*/snippets"] },
    { label: "no path is configured", name: "header", paths: [] }
  ])("returns null when $label", async ({ name, paths }) => {
    expect(await resolveSnippetFile(files, paths, name)).toBeNull();
  });

  it("keeps the configured lookup order", async () => {
    const pluginFirst = ["site/plugins/*/snippets", "site/snippets"];

    expect(await resolveSnippetFile(files, pluginFirst, "shared")).toBe(
      "site/plugins/shop/snippets/shared.php"
    );
  });
});
