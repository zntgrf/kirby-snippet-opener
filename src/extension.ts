import * as vscode from "vscode";
import {
  findSnippetCalls,
  findSnippetCreationBase,
  resolveSnippetFile,
  resolveSnippetPaths,
  SnippetCall,
  SnippetFileSystem
} from "./snippets";

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

      for (const call of findSnippetCalls(document.getText())) {
        const link = await createDocumentLink(document, call);
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
  call: SnippetCall
): Promise<vscode.DocumentLink | null> {
  const snippetUri = await resolveSnippetUri(call.name);
  if (!snippetUri) {
    return null;
  }

  const range = new vscode.Range(
    document.positionAt(call.nameStart),
    document.positionAt(call.nameEnd)
  );

  const link = new vscode.DocumentLink(range, snippetUri);
  link.tooltip = `Open snippet: ${call.name}.php`;

  return link;
}

/**
 * Resolves the URI for a snippet by searching all configured snippet paths.
 * Returns the first match found, or null if not found.
 */
async function resolveSnippetUri(snippetName: string): Promise<vscode.Uri | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return null;
  }

  const relativePath = await resolveSnippetFile(
    createWorkspaceFileSystem(workspaceFolder),
    getSnippetPaths(),
    snippetName
  );

  if (!relativePath) {
    return null;
  }

  return vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
}

function createWorkspaceFileSystem(
  workspaceFolder: vscode.WorkspaceFolder
): SnippetFileSystem {
  const toUri = (path: string) =>
    path ? vscode.Uri.joinPath(workspaceFolder.uri, path) : workspaceFolder.uri;

  return {
    async fileExists(path) {
      try {
        await vscode.workspace.fs.stat(toUri(path));
        return true;
      } catch {
        return false;
      }
    },

    async readDirectories(path) {
      try {
        const entries = await vscode.workspace.fs.readDirectory(toUri(path));
        return entries
          .filter(([, type]) => type === vscode.FileType.Directory)
          .map(([name]) => name);
      } catch {
        return [];
      }
    }
  };
}

function getSnippetPaths(): string[] {
  const config = vscode.workspace.getConfiguration("kirbysnippetopener");

  return resolveSnippetPaths({
    snippetPaths: config.get<string[]>("snippetPaths"),
    snippetPath: config.get<string>("snippetPath")
  });
}

async function promptForSnippetPath(): Promise<string | undefined> {
  return await vscode.window.showInputBox({
    prompt: "Enter the file path for the new snippet without suffix (e.g., components/card)",
    placeHolder: "components/card",
  });
}

async function createSnippetFile(snippetPath: string, content: string): Promise<boolean> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const targetBase = findSnippetCreationBase(getSnippetPaths());

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
