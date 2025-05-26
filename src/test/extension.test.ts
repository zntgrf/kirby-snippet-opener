import * as assert from "assert";
import * as vscode from "vscode";
import { snippetRegex, registerSnippetDocumentLinkProvider } from "../extension";

suite("snippetRegex Test Suite", () => {
  test("snippetRegex should match snippet calls", () => {
    const regex = snippetRegex();
    const text = `snippet('exampleSnippet',slots:true)`;
    const match = regex.exec(text);
    assert.ok(match);
    assert.strictEqual(match[2], "exampleSnippet"); // Snippet name is in group 2
  });

  test("snippetRegex should match snippet calls with slot parameter", () => {
    const regex = snippetRegex();
    const text = `snippet('exampleSnippet',slots:true)`;
    const match = regex.exec(text);
    assert.ok(match);
    assert.strictEqual(match[2], "exampleSnippet");
  });

  test("snippetRegex should match multiple snippet calls", () => {
    const regex = snippetRegex();
    const text = `snippet('firstSnippet'); snippet("secondSnippet",$data,false,true)`;
    const matches = [...text.matchAll(regex)];
    assert.strictEqual(matches.length, 2);
    assert.strictEqual(matches[0][2], "firstSnippet");
    assert.strictEqual(matches[1][2], "secondSnippet");
  });

  test("snippetRegex should not match invalid snippet calls", () => {
    const regex = snippetRegex();
    const text = `snip('exampleSnippet')`;
    const match = regex.exec(text);
    assert.strictEqual(match, null);
  });

  test("snippetRegex should capture quote characters correctly", () => {
    const regex = snippetRegex();
    const text1 = `snippet('singleQuote')`;
    const text2 = `snippet("doubleQuote")`;
    
    const match1 = regex.exec(text1);
    const match2 = regex.exec(text2);
    
    assert.ok(match1);
    assert.ok(match2);
    assert.strictEqual(match1[1], "'"); // Quote character is in group 1
    assert.strictEqual(match1[2], "singleQuote"); // Snippet name is in group 2
    assert.strictEqual(match2[1], '"');
    assert.strictEqual(match2[2], "doubleQuote");
  });

  test("snippetRegex should handle nested quotes correctly", () => {
    const regex = snippetRegex();
    const text = `snippet('test-snippet', ['key' => 'value'])`;
    const match = regex.exec(text);
    
    assert.ok(match);
    assert.strictEqual(match[2], "test-snippet");
  });

  test("snippetRegex should match snippets with complex parameters", () => {
    const regex = snippetRegex();
    const text = `snippet("complex/path", $data, true, ['slots' => true])`;
    const match = regex.exec(text);
    
    assert.ok(match);
    assert.strictEqual(match[2], "complex/path");
  });
});

suite("registerSnippetDocumentLinkProvider Test Suite", () => {
  test("registerSnippetDocumentLinkProvider should provide document links for snippet calls", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: `snippet('exampleSnippet'); snippet("anotherSnippet")`,
      language: "php",
    });

    registerSnippetDocumentLinkProvider();

    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      "vscode.executeDocumentLinkProvider",
      document.uri
    );

    assert.strictEqual(links.length, 2);
    
    // Check that links have proper ranges and tooltips
    assert.ok(links[0].range);
    assert.ok(links[1].range);
    assert.strictEqual(links[0].tooltip, "Open snippet: exampleSnippet.php");
    assert.strictEqual(links[1].tooltip, "Open snippet: anotherSnippet.php");
  });

  test("registerSnippetDocumentLinkProvider should not provide links for non-snippet calls", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: `echo 'Hello World'; function test() { return 'snippet'; }`,
      language: "php",
    });

    registerSnippetDocumentLinkProvider();

    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      "vscode.executeDocumentLinkProvider",
      document.uri
    );

    assert.strictEqual(links.length, 0);
  });

  test("registerSnippetDocumentLinkProvider should handle complex snippet calls", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: `snippet('complex/path', ['data' => $value], true)`,
      language: "php",
    });

    registerSnippetDocumentLinkProvider();

    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      "vscode.executeDocumentLinkProvider",
      document.uri
    );

    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].tooltip, "Open snippet: complex/path.php");
  });

  test("registerSnippetDocumentLinkProvider should handle mixed quote types", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: `snippet('single-quote'); snippet("double-quote")`,
      language: "php",
    });

    registerSnippetDocumentLinkProvider();

    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      "vscode.executeDocumentLinkProvider",
      document.uri
    );

    assert.strictEqual(links.length, 2);
    assert.strictEqual(links[0].tooltip, "Open snippet: single-quote.php");
    assert.strictEqual(links[1].tooltip, "Open snippet: double-quote.php");
  });

  test("registerSnippetDocumentLinkProvider should handle snippets with whitespace", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: `snippet(  'spaced-snippet'  )`,
      language: "php",
    });

    registerSnippetDocumentLinkProvider();

    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      "vscode.executeDocumentLinkProvider",
      document.uri
    );

    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].tooltip, "Open snippet: spaced-snippet.php");
  });

  test("registerSnippetDocumentLinkProvider should create correct ranges for snippet names", async () => {
    const content = `snippet('test-snippet')`;
    const document = await vscode.workspace.openTextDocument({
      content,
      language: "php",
    });

    registerSnippetDocumentLinkProvider();

    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      "vscode.executeDocumentLinkProvider",
      document.uri
    );

    assert.strictEqual(links.length, 1);
    
    // Check that the range covers only the snippet name (excluding quotes)
    const link = links[0];
    const rangeText = document.getText(link.range);
    assert.strictEqual(rangeText, "test-snippet");
  });
});

suite("Edge Cases Test Suite", () => {
  test("snippetRegex should handle empty snippet names gracefully", () => {
    const regex = snippetRegex();
    const text = `snippet('')`;
    const match = regex.exec(text);
    
    // This should not match because our regex requires at least one character
    assert.strictEqual(match, null);
  });

  test("snippetRegex should not match malformed snippet calls", () => {
    const regex = snippetRegex();
    const testCases = [
      `snippet(test)`, // Missing quotes
      `snippet('unclosed`,  // Unclosed quote
      `snippet("mixed')`,   // Mixed quotes
      `snippets('test')`,   // Wrong function name
    ];
    
    testCases.forEach(testCase => {
      const match = regex.exec(testCase);
      assert.strictEqual(match, null, `Should not match: ${testCase}`);
    });
  });

  test("snippetRegex should handle multiline snippet calls", () => {
    const regex = snippetRegex();
    const text = `snippet('test',
      ['data' => $value],
      true
    )`;
    const match = regex.exec(text);
    
    assert.ok(match);
    assert.strictEqual(match[2], "test");
  });
});
