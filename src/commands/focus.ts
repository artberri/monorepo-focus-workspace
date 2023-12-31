import { window } from "vscode"
import { Config } from "../crosscutting/config"
import { Logger } from "../crosscutting/logger"
import type { MonorepoWorkspace } from "../main/monorepo"
import { getIgnoreConfig, getMonorepos } from "../main/monorepoService"

export const enum FocusMode {
	Normal = 1,
	WithoutDevDependencies = 2,
	Only = 3,
	Pick = 4,
}

export const focusCommand = (mode: FocusMode) => async () => {
	const logger = Logger.instance()
	logger.logInfo(
		`Command monorepoFocusWorkspace.focus called with mode ${mode}`,
	)

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
			description: `at ${monorepo.workspaceFolderName}`,
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
			description: `at ${workspace.fsPath}`,
		}
	})

	const picked = (await window.showQuickPick<PickItem>(items, {
		matchOnDescription: true,
		title: "Pick a workspace to focus",
		canPickMany: mode === FocusMode.Pick,
	})) as PickItem | PickItem[] | undefined

	if (!picked || (Array.isArray(picked) && picked.length === 0)) {
		logger.logInfo(`Workspace not selected`)
		return
	}

	const pickedWorkspaces = Array.isArray(picked) ? picked : [picked]
	pickedWorkspaces.forEach((item) => {
		logger.logInfo(
			`Picked this ${selectedMonorepo.name}/${item.workspace.name} workspace`,
		)
	})

	const toKeepWorkspaces = Array.isArray(picked)
		? picked.map((item) => item.workspace)
		: mode === FocusMode.Only
		? [picked.workspace]
		: [
				picked.workspace,
				...selectedMonorepo.getWorkspaceDependencies(
					picked.workspace,
					mode === FocusMode.Normal,
				),
		  ]

	const ignoredFiles = await getIgnoreConfig(selectedMonorepo, toKeepWorkspaces)

	await Config.instance().updateIgnoredFiles(
		Array.isArray(picked)
			? picked.map((item) => item.workspace.name).join("&")
			: picked.workspace.name,
		selectedMonorepo.name,
		selectedMonorepo.workspaceFolder,
		ignoredFiles,
	)
}

type PickItem = {
	workspace: MonorepoWorkspace
	label: string
	description: string
}
