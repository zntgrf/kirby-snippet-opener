import * as vscode from "vscode";
import { getSnippetRegex } from "./snippetRegex";

export function activate(context: vscode.ExtensionContext) {
  const disposables = [
    registerOpenSnippetCommand(),
    registerCreateSnippetFromSelectionCommand(),
    registerSnippetDocumentLinkProvider()
  ];

  context.subscriptions.push(...disposables);
}

function registerOpenSnippetCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "kirbysnippetopener.openSnippet",
    async (snippetName: string) => {
      const snippetUri = await resolveSnippetUri(snippetName);
      if (!snippetUri) {
        vscode.window.showErrorMessage(
          `Snippet ${snippetName}.php could not be found.`
        );
        return;
      }

      const doc = await vscode.workspace.openTextDocument(snippetUri);
      await vscode.window.showTextDocument(doc);
    }
  );
}

function registerCreateSnippetFromSelectionCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "kirbysnippetopener.createSnippetFromSelection",
    async () => {
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

      const snippetPath = await promptForSnippetPath();
      if (!snippetPath) {
        return;
      }

      const success = await createSnippetFile(snippetPath, selectedText);
      if (success) {
        await replaceSelectionWithSnippetCall(editor, snippetPath);
      }
    }
  );
}

function registerSnippetDocumentLinkProvider(): vscode.Disposable {
  return vscode.languages.registerDocumentLinkProvider("php", {
    async provideDocumentLinks(document) {
      const links: vscode.DocumentLink[] = [];
      const text = document.getText();
      const regex = getSnippetRegex();
      let match;

      while ((match = regex.exec(text)) !== null) {
        const snippetName = match[2];
        const link = await createDocumentLink(document, match, snippetName);
        if (link) {
          links.push(link);
        }
      }

      return links;
    }
  });
}

async function createDocumentLink(
  document: vscode.TextDocument,
  match: RegExpExecArray,
  snippetName: string
): Promise<vscode.DocumentLink | null> {
  const snippetUri = await resolveSnippetUri(snippetName);
  if (!snippetUri) {
    return null;
  }

  const range = getSnippetNameRange(document, match);
  const link = new vscode.DocumentLink(range, snippetUri);
  link.tooltip = `Open snippet: ${snippetName}.php`;

  return link;
}

function getSnippetNameRange(document: vscode.TextDocument, match: RegExpExecArray): vscode.Range {
  const quoteChar = match[1];
  const snippetName = match[2];
  const matchStart = match.index;

  const snippetNameStartInMatch = match[0].indexOf(quoteChar) + 1;
  const snippetNameStart = document.positionAt(matchStart + snippetNameStartInMatch);
  const snippetNameEnd = document.positionAt(matchStart + snippetNameStartInMatch + snippetName.length);

  return new vscode.Range(snippetNameStart, snippetNameEnd);
}

/**
 * Resolves the URI for a snippet by searching all configured snippet paths.
 * Glob patterns (e.g. site/plugins/*\/snippets) are expanded.
 * Returns the first match found, or null if not found.
 */
async function resolveSnippetUri(snippetName: string): Promise<vscode.Uri | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return null;
  }

  const snippetPaths = getSnippetPaths();

  for (const pattern of snippetPaths) {
    if (pattern.includes("*")) {
      const globPattern = new vscode.RelativePattern(workspaceFolder, `${pattern}/${snippetName}.php`);
      const matches = await vscode.workspace.findFiles(globPattern, null, 1);
      if (matches.length > 0) {
        return matches[0];
      }
    } else {
      const uri = vscode.Uri.joinPath(workspaceFolder.uri, pattern, `${snippetName}.php`);
      try {
        await vscode.workspace.fs.stat(uri);
        return uri;
      } catch {
        // file not found, try next path
      }
    }
  }

  return null;
}

function getSnippetPaths(): string[] {
  const config = vscode.workspace.getConfiguration("kirbysnippetopener");

  // New multi-path setting takes precedence
  const snippetPaths = config.get<string[]>("snippetPaths");
  if (snippetPaths && snippetPaths.length > 0) {
    return snippetPaths;
  }

  // Fall back to deprecated single-path setting
  const snippetPath = config.get<string>("snippetPath");
  if (snippetPath) {
    return [snippetPath];
  }

  return ["site/snippets", "site/plugins/*/snippets"];
}

async function promptForSnippetPath(): Promise<string | undefined> {
  return await vscode.window.showInputBox({
    prompt: "Enter the file path for the new snippet without suffix (e.g., components/card)",
    placeHolder: "components/card",
  });
}

async function createSnippetFile(snippetPath: string, content: string): Promise<boolean> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const snippetPaths = getSnippetPaths();

  // Create new snippets in the first non-glob path
  const targetBase = snippetPaths.find(p => !p.includes("*"));

  if (!targetBase) {
    vscode.window.showErrorMessage("No valid snippet path configured for creating snippets.");
    return false;
  }

  if (!workspaceFolder) {
    vscode.window.showErrorMessage("No workspace folder found.");
    return false;
  }

  const fullUri = vscode.Uri.joinPath(
    workspaceFolder.uri,
    targetBase,
    `${snippetPath}.php`
  );

  const dirUri = vscode.Uri.joinPath(fullUri, "..");

  try {
    await vscode.workspace.fs.createDirectory(dirUri);
    await vscode.workspace.fs.writeFile(fullUri, Buffer.from(content, "utf8"));
    vscode.window.showInformationMessage(`Snippet created at ${snippetPath}`);
    return true;
  } catch (error: any) {
    vscode.window.showErrorMessage(`Error creating snippet: ${error.message}`);
    return false;
  }
}

async function replaceSelectionWithSnippetCall(
  editor: vscode.TextEditor,
  snippetPath: string
): Promise<void> {
  const cleanPath = snippetPath
    .replace(/^snippets\//, "")
    .replace(/\.php$/, "");

  const snippetCall = `snippet('${cleanPath}')`;

  await editor.edit((editBuilder) => {
    editBuilder.replace(editor.selection, snippetCall);
  });
}

// Export for testing
export { getSnippetRegex as snippetRegex, registerSnippetDocumentLinkProvider };
