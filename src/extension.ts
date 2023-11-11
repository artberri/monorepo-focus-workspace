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

			if (!monorepos[0]) {
				logger.logError(`Monorepos not found`)
				window.showWarningMessage(
					"Monorepo not found. Check that a `package.json` file exists in the root of your workspace folder and that includes a `workspaces` property. If you are using a custom path for your `package.json` file, check that the `focusWorkspace.rootPackageJsonRelativePath` setting is correct.",
				)
				return
			}

			let selectedMonorepo = monorepos[0]
			if (monorepos.length > 1) {
				const items = monorepos.map((monorepo) => ({
					monorepo,
					label: monorepo.name,
					description: `at ${monorepo.path}`,
				}))
				const pickedMonorepo = await window.showQuickPick(items, {
					matchOnDescription: true,
					title: "Pick a monorepo to focus",
				})

				if (pickedMonorepo) {
					selectedMonorepo = pickedMonorepo.monorepo
				} else {
					logger.logInfo(`Monorepo not selected`)
					return
				}
			}

			if (selectedMonorepo.workspaces.length === 0) {
				logger.logError(`Workspaces not found on Monorepo`)
				window.showWarningMessage(
					"Workspaces not found on Monorepo. Check that the `workspaces` property of your `package.json` file is not empty.",
				)
				return
			}

			const items = selectedMonorepo.workspaces.map((workspace) => {
				return {
					workspace,
					label: `${workspace.emoji} ${workspace.name}`,
					description: `at ${workspace.path}`,
				}
			})

			const picked = await window.showQuickPick(items, {
				matchOnDescription: true,
				title: "Pick a workspace to focus",
			})

			if (!picked) {
				logger.logInfo(`Workspace not selected`)
				return
			}

			logger.logInfo(
				`Picked this ${selectedMonorepo.name}/${picked.workspace.name} workspace`,
			)

			selectedMonorepo
				.findWorkspaceDependencies(picked.workspace)
				.forEach((w) => {
					logger.logInfo(
						`Workspace ${w.name} is a dependency of ${picked.workspace.name}`,
					)
				})

			// workspace
			// 	.getConfiguration("files", selectedMonorepo.workspaceFolder)
			// 	.update(
			// 		"exclude",
			// 		{
			// 			...workspace
			// 				.getConfiguration("files", selectedMonorepo.workspaceFolder)
			// 				.get("exclude"),
			// 			"**": true,
			// 			...picked.workspace.exclude,
			// 		},
			// 		true,
			// 	)
		},
	)

	context.subscriptions.push(disposable)
}

// This method is called when your extension is deactivated
export function deactivate() {
	Logger.dispose()
}
