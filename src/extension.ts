import { posix } from "path"
import { ExtensionContext, commands, window, workspace } from "vscode"
import { Logger } from "./logger"
import { getConfig } from "./utils"
import { Workspaces } from "./workspaces"

export function activate(context: ExtensionContext) {
	const logger = Logger.instance()
	const { enableLogs } = getConfig()
	logger.setEnabled(enableLogs)

	context.subscriptions.push(
		workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("focusWorkspace.enableLogs")) {
				const { enableLogs } = getConfig()
				logger.setEnabled(enableLogs)
			}
		}),
	)

	logger.logInfo(`Extension Version: ${context.extension.packageJSON.version}.`)

	const disposable = commands.registerCommand("focus-workspace.focus", () => {
		const { rootPackageJsonRelativePath } = getConfig()
		workspace.workspaceFolders?.forEach(async (folder) => {
			const packageJSONPath = rootPackageJsonRelativePath
				? posix.join(
						folder.uri.path,
						rootPackageJsonRelativePath,
						"package.json",
				  )
				: posix.join(folder.uri.path, "package.json")

			const workspaces = await Workspaces.fromUri(
				folder.uri.with({ path: packageJSONPath }),
			)

			if (workspaces) {
				window.showInformationMessage(
					`Monorepo found with the following workspaces: ${workspaces.workspaces.join()}`,
				)
			}
		})
	})

	context.subscriptions.push(disposable)
}

// This method is called when your extension is deactivated
export function deactivate() {
	Logger.dispose()
}
