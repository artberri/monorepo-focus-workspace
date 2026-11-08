# Change Log

All notable changes to the "monorepo-focus-workspace" extension will be documented in this file.

## 1.0.1

- Fix focusing in a multi-root workspace hiding folders in the other projects ([#1](https://github.com/artberri/monorepo-focus-workspace/issues/1)). The focus is now kept in each folder's settings; a focus left in the `.code-workspace` file by an earlier version is removed the next time you run a command.
- Show a spinner in the status bar while focusing, toggling or resetting ([#2](https://github.com/artberri/monorepo-focus-workspace/issues/2)).
- Smaller extension: the bundle is now minified.
- Publish to Open VSX as well as the VS Code Marketplace, with build provenance attached to each GitHub release.

## 1.0.0

- Initial release
