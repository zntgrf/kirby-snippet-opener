import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const openSnippet = vscode.commands.registerCommand(
    "kirbysnippetopener.openSnippet",
    async (snippetName: string) => {
      // Lese den Pfad aus den Einstellungen
      const snippetPathConfig = vscode.workspace
        .getConfiguration("kirbysnippetopener")
        .get<string>("snippetPath");
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      if (workspaceFolder && snippetPathConfig) {
        const snippetPath = vscode.Uri.joinPath(
          workspaceFolder.uri,
          snippetPathConfig,
          `${snippetName}.php`
        );
        try {
          const doc = await vscode.workspace.openTextDocument(snippetPath);
          vscode.window.showTextDocument(doc);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Snippet ${snippetName}.php konnte nicht gefunden werden.`
          );
        }
      }
    }
  );

  context.subscriptions.push(openSnippet);

  // CodeLens-Provider registrieren
  registerSnippetCodeLensProvider();
}

export function registerSnippetCodeLensProvider() {
  vscode.languages.registerCodeLensProvider("php", {
    provideCodeLenses(document) {
      const codeLenses: vscode.CodeLens[] = [];
      const regex = snippetRegex();
      let match;
      while ((match = regex.exec(document.getText())) !== null) {
        const snippetName = match[1];
        const range = new vscode.Range(
          document.positionAt(match.index),
          document.positionAt(match.index + match[0].length)
        );

        const command: vscode.Command = {
          title: "Open Snippet",
          command: "kirbysnippetopener.openSnippet",
          arguments: [snippetName],
        };
        codeLenses.push(new vscode.CodeLens(range, command));
      }
      return codeLenses;
    },
  });
}

export function snippetRegex() {
  return /snippet\(['"]([^'"]+)['"]\)/g;
}
