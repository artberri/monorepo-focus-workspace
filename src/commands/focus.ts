import { window } from "vscode"
import { Config } from "../crosscutting/config"
import { Logger } from "../crosscutting/logger"
import { getMonorepos } from "../main/monorepoRepository"

export const focusCommand = async () => {
	const logger = Logger.instance()
	logger.logInfo("Command monorepoFocusWorkspace.focus called")

	const monorepos = await getMonorepos()

	if (!monorepos[0]) {
		logger.logError(`Monorepos not found`)
		await window.showWarningMessage(
			"Monorepo not found. Check that a `package.json` file exists in the root of your workspace folder and that includes a `workspaces` property. If you are using a custom path for your `package.json` file, check that the `monorepoFocusWorkspace.rootPackageJsonRelativePath` setting is correct.",
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
		await window.showWarningMessage(
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

	const ignoredFiles = selectedMonorepo.getIgnoreConfig(picked.workspace)

	await Config.instance().updateIgnoredFiles(
		selectedMonorepo.name,
		selectedMonorepo.workspaceFolder,
		ignoredFiles,
	)
}
