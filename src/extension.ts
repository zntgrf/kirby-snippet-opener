import * as vscode from "vscode";
import {
  findSnippetCallAt,
  findSnippetCalls,
  findSnippetCreationBase,
  normalizeSnippetName,
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
    async (argument?: string) => {
      // Invoked from the command palette there is no argument, so fall back
      // to the call the cursor sits in.
      const snippetName = argument ?? findSnippetNameAtCursor();
      if (!snippetName) {
        vscode.window.showErrorMessage("No snippet call at the cursor.");
        return;
      }

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

/** The snippet name of the call the cursor is in, if there is one. */
function findSnippetNameAtCursor(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const offset = editor.document.offsetAt(editor.selection.active);

  return findSnippetCallAt(editor.document.getText(), offset)?.name;
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

      const snippetName = await promptForSnippetName();
      if (!snippetName) {
        return;
      }

      const success = await createSnippetFile(snippetName, selectedText);
      if (success) {
        await replaceSelectionWithSnippetCall(editor, snippetName);
      }
    }
  );
}

function registerSnippetDocumentLinkProvider(): vscode.Disposable {
  return vscode.languages.registerDocumentLinkProvider("php", {
    async provideDocumentLinks(document) {
      const calls = findSnippetCalls(document.getText());
      if (calls.length === 0) {
        return [];
      }

      // One resolver for the whole pass: the configuration is read once,
      // directory listings are shared between the globs, and a snippet used
      // several times in the same file is looked up once. This runs on every
      // edit, so a template with 30 calls must not mean 30 directory walks.
      const resolveSnippet = createSnippetResolver();

      const links = await Promise.all(
        calls.map(async (call) => {
          const snippetUri = await resolveSnippet(call.name);
          return snippetUri ? createDocumentLink(document, call, snippetUri) : null;
        })
      );

      return links.filter((link) => link !== null);
    }
  });
}

function createDocumentLink(
  document: vscode.TextDocument,
  call: SnippetCall,
  snippetUri: vscode.Uri
): vscode.DocumentLink {
  const range = new vscode.Range(
    document.positionAt(call.nameStart),
    document.positionAt(call.nameEnd)
  );

  const link = new vscode.DocumentLink(range, snippetUri);
  link.tooltip = `Open snippet: ${call.name}.php`;

  return link;
}

/** Resolves a single snippet to its URI, or null if it does not exist. */
async function resolveSnippetUri(snippetName: string): Promise<vscode.Uri | null> {
  return createSnippetResolver()(snippetName);
}

/**
 * A snippet lookup that memoizes within its own lifetime. Create one per
 * batch of lookups, never a long-lived one: it would not notice new files.
 */
function createSnippetResolver(): (name: string) => Promise<vscode.Uri | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return async () => null;
  }

  const fileSystem = createWorkspaceFileSystem(workspaceFolder);
  const paths = getSnippetPaths();
  const resolved = new Map<string, Promise<vscode.Uri | null>>();

  return (name) => {
    let pending = resolved.get(name);

    if (!pending) {
      pending = resolveSnippetFile(fileSystem, paths, name).then((relativePath) =>
        relativePath ? vscode.Uri.joinPath(workspaceFolder.uri, relativePath) : null
      );
      resolved.set(name, pending);
    }

    return pending;
  };
}

function createWorkspaceFileSystem(
  workspaceFolder: vscode.WorkspaceFolder
): SnippetFileSystem {
  const toUri = (path: string) =>
    path ? vscode.Uri.joinPath(workspaceFolder.uri, path) : workspaceFolder.uri;

  const listings = new Map<string, Promise<string[]>>();

  return {
    async fileExists(path) {
      try {
        await vscode.workspace.fs.stat(toUri(path));
        return true;
      } catch {
        return false;
      }
    },

    readDirectories(path) {
      let pending = listings.get(path);

      if (!pending) {
        pending = Promise.resolve(vscode.workspace.fs.readDirectory(toUri(path))).then(
          (entries) =>
            entries
              .filter(([, type]) => type === vscode.FileType.Directory)
              .map(([name]) => name),
          () => []
        );
        listings.set(path, pending);
      }

      return pending;
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

/** Asks for a snippet name and hands back the normalized form, or undefined. */
async function promptForSnippetName(): Promise<string | undefined> {
  const input = await vscode.window.showInputBox({
    prompt: "Enter the file path for the new snippet without suffix (e.g., components/card)",
    placeHolder: "components/card",
    validateInput: (value) =>
      value.trim() && !normalizeSnippetName(value)
        ? "Not a valid snippet path."
        : undefined,
  });

  return input ? normalizeSnippetName(input) ?? undefined : undefined;
}

async function createSnippetFile(snippetName: string, content: string): Promise<boolean> {
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
    `${snippetName}.php`
  );

  const dirUri = vscode.Uri.joinPath(fullUri, "..");

  try {
    await vscode.workspace.fs.createDirectory(dirUri);
    await vscode.workspace.fs.writeFile(fullUri, new TextEncoder().encode(content));
    vscode.window.showInformationMessage(`Snippet created at ${snippetName}`);
    return true;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error creating snippet: ${reason}`);
    return false;
  }
}

async function replaceSelectionWithSnippetCall(
  editor: vscode.TextEditor,
  snippetName: string
): Promise<void> {
  const snippetCall = `snippet('${snippetName}')`;

  await editor.edit((editBuilder) => {
    editBuilder.replace(editor.selection, snippetCall);
  });
}
