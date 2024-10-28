# Kirby Snippet Opener

**Kirby Snippet Opener** is a Visual Studio Code extension designed for developers working with the [Kirby CMS](https://getkirby.com). It simplifies the process of navigating and managing snippet templates in Kirby projects, allowing you to open snippet files directly from template calls in your code.

## Key Features

- **Snippet Opening via Click**: Click directly on `snippet('...')` calls in your Kirby templates to open the corresponding snippet file. This eliminates the need to manually locate and open snippet files.

- **Customizable Snippet Path**: Configure the relative path to your Kirby snippet directory in the extension settings to match your project's structure (default is `snippets`).

- **CodeLens Integration**: Easily see clickable `Open Snippet` links above each `snippet()` call, making it quick and efficient to navigate to snippet files without needing additional shortcuts.

## Usage

1. **Configure the Snippet Path**:
   Go to the VSCode settings and find **Kirby Snippet Opener**. Set the `snippetPath` configuration to match your Kirby project structure.

2. **Open Snippets with a Click**:
   Open any Kirby template containing `snippet('...')` calls. Click on the `Open Snippet` link that appears above each call, and the corresponding snippet file will open in the editor.

This extension streamlines working with Kirby snippets and enhances productivity by providing fast navigation within your Kirby templates. Perfect for developers who want a seamless way to handle snippet files in Kirby CMS projects.