import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
/**
 * Activates the extension.
 *
 * @param context - The extension context provided by VS Code.
 *
 * This function registers the command `kirbysnippetopener.openSnippet` which opens a PHP snippet file
 * based on the provided snippet name. It reads the snippet path from the extension's configuration,
 * constructs the full path to the snippet file, and attempts to open it in the editor. If the file
 * cannot be found, an error message is displayed.
 *
 * Additionally, this function registers a CodeLens provider for the extension.
 */
export function activate(context: vscode.ExtensionContext) {
  createSnippetFromSelection(context);
  openSnippet(context);

  // CodeLens-Provider registrieren
  registerSnippetCodeLensProvider();
}

export const openSnippet = (context: vscode.ExtensionContext) => {
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
};

export const createSnippetFromSelection = (
  context: vscode.ExtensionContext
) => {
  const createSnippetFromSelection = vscode.commands.registerCommand(
    "kirbysnippetopener.createSnippetFromSelection",
    async () => {
      // Get the active editor and selected text
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found.");
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      if (!selectedText) {
        vscode.window.showErrorMessage("No text selected.");
        return;
      }

      // Prompt the user to enter a file path for the snippet
      const snippetPath = await vscode.window.showInputBox({
        prompt:
          "Enter the file path for the new snippet without suffix (e.g., components/card)",
        placeHolder: "components/card",
      });
      if (!snippetPath) {
        vscode.window.showErrorMessage("No file path entered.");
        return;
      }

      const snippetConfigPath = vscode.workspace
        .getConfiguration("kirbysnippetopener")
        .get<string>("snippetPath");

      if (!snippetConfigPath) {
        vscode.window.showErrorMessage(
          "You must set a snippet path in Vscode-Configuration."
        );
        return;
      }

      // Construct the full file path
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return;
      }

      const fullPath = path.join(
        workspaceFolder.uri.fsPath,
        snippetConfigPath,
        `${snippetPath}.php`
      );

      // Write the selected text to the new snippet file
      try {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, selectedText, "utf8");
        vscode.window.showInformationMessage(
          `Snippet created at ${snippetPath}`
        );

        // Replace the selected text with the snippet() function call
        await editor.edit((editBuilder) => {
          const snippetCall = `snippet('${snippetPath
            .replace(/^snippets\//, "")
            .replace(/\.php$/, "")}')`;
          editBuilder.replace(selection, snippetCall);
        });
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error creating snippet: ${error.message}`
        );
      }
    }
  );

  context.subscriptions.push(createSnippetFromSelection);
};

/**
 * Registers a CodeLens provider for PHP files that detects snippets and provides
 * a command to open them.
 *
 * This function uses a regular expression to find snippets in the document text,
 * creates a range for each match, and associates a CodeLens with a command to
 * open the snippet.
 *
 * @returns {void}
 */
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

/**
 * Returns a regular expression that matches the pattern `snippet('...')` or `snippet("...")`.
 * The pattern captures the content within the parentheses and quotes.
 *
 * @returns {RegExp} A regular expression to match snippet patterns.
 */
export function snippetRegex() {
  return /snippet\(\s*['"]([^'"]+)['"][\s\S]*?\)/g;
}
