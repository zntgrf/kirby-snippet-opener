import * as assert from "assert";
import * as vscode from "vscode";
import { snippetRegex, registerSnippetCodeLensProvider } from "../extension";

suite("snippetRegex Test Suite", () => {
  test("snippetRegex should match snippet calls", () => {
    const regex = snippetRegex();
    const text = `snippet('exampleSnippet')`;
    const match = regex.exec(text);
    assert.ok(match);
    assert.strictEqual(match[1], "exampleSnippet");
  });

  test("snippetRegex should match multiple snippet calls", () => {
    const regex = snippetRegex();
    const text = `snippet('firstSnippet'); snippet("secondSnippet")`;
    const matches = [...text.matchAll(regex)];
    assert.strictEqual(matches.length, 2);
    assert.strictEqual(matches[0][1], "firstSnippet");
    assert.strictEqual(matches[1][1], "secondSnippet");
  });

  test("snippetRegex should not match invalid snippet calls", () => {
    const regex = snippetRegex();
    const text = `snip('exampleSnippet')`;
    const match = regex.exec(text);
    assert.strictEqual(match, null);
  });
});

suite("registerSnippetCodeLensProvider Test Suite", () => {
  test("registerSnippetCodeLensProvider should provide CodeLenses for snippet calls", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: `snippet('exampleSnippet'); snippet("anotherSnippet")`,
      language: "php",
    });

    registerSnippetCodeLensProvider();

    const codeLenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      document.uri
    );

    assert.strictEqual(codeLenses.length, 2);
    assert.strictEqual(codeLenses[0].command?.arguments?.[0], "exampleSnippet");
    assert.strictEqual(codeLenses[1].command?.arguments?.[0], "anotherSnippet");
  });

  test("registerSnippetCodeLensProvider should not provide CodeLenses for non-snippet calls", async () => {
    const document = await vscode.workspace.openTextDocument({
      content: `echo 'Hello World';`,
      language: "php",
    });

    registerSnippetCodeLensProvider();

    const codeLenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      "vscode.executeCodeLensProvider",
      document.uri
    );

    assert.strictEqual(codeLenses.length, 0);
  });
});
