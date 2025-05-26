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
 * Additionally, this function registers a Document Link provider for the extension.
 */
export function activate(context: vscode.ExtensionContext) {
  const disposables = [
    registerOpenSnippetCommand(),
    registerCreateSnippetFromSelectionCommand(),
    registerSnippetDocumentLinkProvider()
  ];
  
  context.subscriptions.push(...disposables);
}

/**
 * Registers the command to open a snippet file.
 * 
 * @returns {vscode.Disposable} The disposable for the registered command.
 */
function registerOpenSnippetCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "kirbysnippetopener.openSnippet",
    async (snippetName: string) => {
      // Get the URI for the snippet file
      const snippetUri = getSnippetUri(snippetName);
      if (!snippetUri) {
        return;
      }

      try {
        const doc = await vscode.workspace.openTextDocument(snippetUri);
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Snippet ${snippetName}.php konnte nicht gefunden werden.`
        );
      }
    }
  );
}

/**
 * Registers the command to create a snippet from selected text.
 * 
 * This command allows users to select text in the editor, create a new snippet file
 * with that content, and replace the selection with a snippet() function call.
 * 
 * @returns {vscode.Disposable} The disposable for the registered command.
 */
function registerCreateSnippetFromSelectionCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "kirbysnippetopener.createSnippetFromSelection",
    async () => {
      // Get the active editor and selected text
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found.");
        return;
      }

      const selectedText = editor.document.getText(editor.selection);
      if (!selectedText) {
        vscode.window.showErrorMessage("No text selected.");
        return;
      }

      // Prompt the user to enter a file path for the snippet
      const snippetPath = await promptForSnippetPath();
      if (!snippetPath) {
        return;
      }

      // Create the snippet file and replace selection if successful
      const success = await createSnippetFile(snippetPath, selectedText);
      if (success) {
        await replaceSelectionWithSnippetCall(editor, snippetPath);
      }
    }
  );
}

/**
 * Registers a Document Link provider for PHP files that detects snippets and makes
 * their paths clickable.
 *
 * This function uses a regular expression to find snippets in the document text,
 * creates a range for each snippet name, and associates a Document Link with the
 * corresponding snippet file.
 *
 * @returns {vscode.Disposable} The disposable for the registered provider.
 */
function registerSnippetDocumentLinkProvider(): vscode.Disposable {
  return vscode.languages.registerDocumentLinkProvider("php", {
    provideDocumentLinks(document) {
      const links: vscode.DocumentLink[] = [];
      const text = document.getText();
      const regex = getSnippetRegex();
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const snippetName = match[2];
        const link = createDocumentLink(document, match, snippetName);
        if (link) {
          links.push(link);
        }
      }
      
      return links;
    }
  });
}

/**
 * Creates a document link for a snippet match.
 * 
 * @param document - The text document containing the snippet call.
 * @param match - The regex match result for the snippet call.
 * @param snippetName - The name of the snippet to link to.
 * @returns {vscode.DocumentLink | null} The document link or null if URI cannot be created.
 */
function createDocumentLink(
  document: vscode.TextDocument, 
  match: RegExpExecArray, 
  snippetName: string
): vscode.DocumentLink | null {
  const snippetUri = getSnippetUri(snippetName);
  if (!snippetUri) {
    return null;
  }

  const range = getSnippetNameRange(document, match);
  const link = new vscode.DocumentLink(range, snippetUri);
  link.tooltip = `Open snippet: ${snippetName}.php`;
  
  return link;
}

/**
 * Gets the range of the snippet name within the document (excluding quotes).
 * 
 * @param document - The text document.
 * @param match - The regex match result.
 * @returns {vscode.Range} The range of the snippet name.
 */
function getSnippetNameRange(document: vscode.TextDocument, match: RegExpExecArray): vscode.Range {
  const quoteChar = match[1];
  const snippetName = match[2];
  const matchStart = match.index;
  
  // Find the exact position of the snippet name (excluding quotes)
  const snippetNameStartInMatch = match[0].indexOf(quoteChar) + 1;
  const snippetNameStart = document.positionAt(matchStart + snippetNameStartInMatch);
  const snippetNameEnd = document.positionAt(matchStart + snippetNameStartInMatch + snippetName.length);
  
  return new vscode.Range(snippetNameStart, snippetNameEnd);
}

/**
 * Gets the URI for a snippet file based on the snippet name and configuration.
 * 
 * @param snippetName - The name of the snippet.
 * @returns {vscode.Uri | null} The URI of the snippet file or null if not available.
 */
function getSnippetUri(snippetName: string): vscode.Uri | null {
  const config = getExtensionConfig();
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  
  if (!workspaceFolder || !config.snippetPath) {
    return null;
  }
  
  return vscode.Uri.joinPath(
    workspaceFolder.uri,
    config.snippetPath,
    `${snippetName}.php`
  );
}

/**
 * Gets the extension configuration settings.
 * 
 * @returns {object} Configuration object with snippetPath property.
 */
function getExtensionConfig() {
  const config = vscode.workspace.getConfiguration("kirbysnippetopener");
  return {
    snippetPath: config.get<string>("snippetPath")
  };
}

/**
 * Prompts the user to enter a snippet path.
 * 
 * @returns {Promise<string | undefined>} The entered snippet path or undefined if cancelled.
 */
async function promptForSnippetPath(): Promise<string | undefined> {
  return await vscode.window.showInputBox({
    prompt: "Enter the file path for the new snippet without suffix (e.g., components/card)",
    placeHolder: "components/card",
  });
}

/**
 * Creates a snippet file with the given content.
 * 
 * @param snippetPath - The relative path for the snippet file.
 * @param content - The content to write to the snippet file.
 * @returns {Promise<boolean>} True if the file was created successfully, false otherwise.
 */
async function createSnippetFile(snippetPath: string, content: string): Promise<boolean> {
  const config = getExtensionConfig();
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  
  if (!config.snippetPath) {
    vscode.window.showErrorMessage("You must set a snippet path in VS Code configuration.");
    return false;
  }
  
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("No workspace folder found.");
    return false;
  }

  // Construct the full file path
  const fullPath = path.join(
    workspaceFolder.uri.fsPath,
    config.snippetPath,
    `${snippetPath}.php`
  );

  // Write the selected text to the new snippet file
  try {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");
    vscode.window.showInformationMessage(`Snippet created at ${snippetPath}`);
    return true;
  } catch (error: any) {
    vscode.window.showErrorMessage(`Error creating snippet: ${error.message}`);
    return false;
  }
}

/**
 * Replaces the current selection with a snippet function call.
 * 
 * @param editor - The text editor containing the selection.
 * @param snippetPath - The path of the created snippet.
 */
async function replaceSelectionWithSnippetCall(
  editor: vscode.TextEditor, 
  snippetPath: string
): Promise<void> {
  // Clean the path by removing common prefixes and suffixes
  const cleanPath = snippetPath
    .replace(/^snippets\//, "")
    .replace(/\.php$/, "");
  
  const snippetCall = `snippet('${cleanPath}')`;
  
  // Replace the selected text with the snippet() function call
  await editor.edit((editBuilder) => {
    editBuilder.replace(editor.selection, snippetCall);
  });
}

/**
 * Returns a regular expression that matches the pattern `snippet('...')` or `snippet("...")`.
 * The pattern captures the quote character and the content within the quotes.
 *
 * @returns {RegExp} A regular expression to match snippet patterns.
 */
function getSnippetRegex(): RegExp {
  return /snippet\(\s*(['"])([^'"]+)\1[\s\S]*?\)/g;
}

// Export for testing
export { getSnippetRegex as snippetRegex, registerSnippetDocumentLinkProvider };
