import { describe, it, expect } from "vitest";
import { getSnippetRegex } from "../../snippetRegex";

describe("getSnippetRegex", () => {
  it("matches single-quoted snippet calls", () => {
    const match = getSnippetRegex().exec(`snippet('exampleSnippet')`);
    expect(match).not.toBeNull();
    expect(match![2]).toBe("exampleSnippet");
  });

  it("matches double-quoted snippet calls", () => {
    const match = getSnippetRegex().exec(`snippet("exampleSnippet")`);
    expect(match).not.toBeNull();
    expect(match![2]).toBe("exampleSnippet");
  });

  it("captures quote character in group 1", () => {
    const match1 = getSnippetRegex().exec(`snippet('single')`);
    const match2 = getSnippetRegex().exec(`snippet("double")`);
    expect(match1![1]).toBe("'");
    expect(match2![1]).toBe('"');
  });

  it("matches snippet with extra parameters", () => {
    const match = getSnippetRegex().exec(`snippet('exampleSnippet', slots: true)`);
    expect(match).not.toBeNull();
    expect(match![2]).toBe("exampleSnippet");
  });

  it("matches snippet with data array", () => {
    const match = getSnippetRegex().exec(`snippet("complex/path", $data, true, ['slots' => true])`);
    expect(match).not.toBeNull();
    expect(match![2]).toBe("complex/path");
  });

  it("matches multiple snippets in one string", () => {
    const text = `snippet('first'); snippet("second", $data)`;
    const matches = [...text.matchAll(getSnippetRegex())];
    expect(matches).toHaveLength(2);
    expect(matches[0][2]).toBe("first");
    expect(matches[1][2]).toBe("second");
  });

  it("matches multiline snippet calls", () => {
    const text = "snippet('test',\n  ['data' => $value],\n  true\n)";
    const match = getSnippetRegex().exec(text);
    expect(match).not.toBeNull();
    expect(match![2]).toBe("test");
  });

  it("does not match wrong function names", () => {
    expect(getSnippetRegex().exec("snip('test')")).toBeNull();
    expect(getSnippetRegex().exec("snippets('test')")).toBeNull();
  });

  it("does not match missing quotes", () => {
    expect(getSnippetRegex().exec("snippet(test)")).toBeNull();
  });

  it("does not match mixed quotes", () => {
    expect(getSnippetRegex().exec("snippet('mixed\")")).toBeNull();
  });

  it("does not match empty snippet name", () => {
    expect(getSnippetRegex().exec("snippet('')")).toBeNull();
  });
});
