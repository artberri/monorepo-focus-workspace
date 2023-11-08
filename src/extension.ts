import { ExtensionContext, commands, window, workspace } from "vscode"
import { getConfig } from "./getConfig"
import { Logger } from "./logger"
import { getMonorepos } from "./monorepoRepository"

export function activate(context: ExtensionContext) {
	const logger = Logger.instance()
	const { enableLogs } = getConfig()
	logger.setEnabled(enableLogs)

	context.subscriptions.push(
		workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("focusWorkspace.enableLogs")) {
				window.showWarningMessage(
					`Reload required to apply changes to "focusWorkspace.enableLogs".`,
				)
			}
		}),
	)

	logger.logInfo(`Extension Version: ${context.extension.packageJSON.version}.`)

	const disposable = commands.registerCommand(
		"focus-workspace.focus",
		async () => {
			logger.logInfo("Command focus-workspace.focus called")

			const monorepos = await getMonorepos()

			if (!monorepos.length) {
				logger.logError(`Monorepos not found`)
				window.showWarningMessage(
					"Monorepo not found. Check that a `package.json` file exists in the root of your workspace folder and that includes a `workspaces` property. If you are using a custom path for your `package.json` file, check that the `focusWorkspace.rootPackageJsonRelativePath` setting is correct.",
				)
			}
		},
	)

	context.subscriptions.push(disposable)
}

// This method is called when your extension is deactivated
export function deactivate() {
	Logger.dispose()
}
