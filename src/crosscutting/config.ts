import type { WorkspaceFolder } from "vscode"
import { ConfigurationTarget, window, workspace } from "vscode"
import { extensionName, isNotNil } from "./utils"

export interface MonorepoFocusWorkspaceVSCodeConfig {
	enableLogs: boolean
	rootPackageJsonRelativePath: string
	configurationTarget: ConfigurationTarget
	internal: Record<
		string,
		{
			managedFilesIgnoreEntries: string[]
			focusedWorkspace: string
		}
	>
}

export class Config {
	private static _instance: Config | undefined
	private readonly subscription: { dispose(): void }
	public readonly enableLogs: boolean

	private constructor() {
		const { enableLogs } = getConfig()
		this.enableLogs = enableLogs
		this.subscription = workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(`${extensionName}.enableLogs`)) {
				void window.showWarningMessage(
					`Reload required to apply changes to "${extensionName}.enableLogs".`,
				)
			}
		})
	}

	public static instance(): Config {
		if (!Config._instance) {
			Config._instance = new Config()
		}

		return Config._instance
	}

	public getConfig(
		workspaceFolder: WorkspaceFolder,
	): MonorepoFocusWorkspaceVSCodeConfig {
		return getConfig(workspaceFolder)
	}

	public async updateIgnoredFiles(
		pickedWorkspace: string,
		monorepoName: string,
		workspaceFolder: WorkspaceFolder,
		ignoredFiles: Map<string, boolean>,
	): Promise<void> {
		const { configurationTarget, internal } =
			Config.instance().getConfig(workspaceFolder)

		const existingConfiguration = getExistingExcludedFiles(
			workspaceFolder,
			configurationTarget,
		)

		// Keep existingConfiguration entries that are not managed by this extension
		;(internal[monorepoName]?.managedFilesIgnoreEntries ?? []).forEach(
			(entry) => {
				existingConfiguration.delete(entry)
			},
		)

		// Do not add entries that are already being managed by the user
		for (const existingConfigurationEntry of existingConfiguration.keys()) {
			ignoredFiles.delete(existingConfigurationEntry)
		}

		await Promise.all([
			workspace.getConfiguration("files", workspaceFolder).update(
				"exclude",
				{
					...Object.fromEntries(ignoredFiles.entries()),
					...Object.fromEntries(existingConfiguration.entries()),
				},
				configurationTarget,
			),
			workspace.getConfiguration(extensionName, workspaceFolder).update(
				"internal",
				{
					...internal,
					[monorepoName]: {
						managedFilesIgnoreEntries: Array.from(ignoredFiles.keys()),
						focusedWorkspace: pickedWorkspace,
					},
				},
				configurationTarget,
			),
		])
	}

	public async resetIgnoredFiles(
		workspaceFolder: WorkspaceFolder,
	): Promise<void> {
		const { configurationTarget, internal } =
			Config.instance().getConfig(workspaceFolder)
		const existingConfiguration = getExistingExcludedFiles(
			workspaceFolder,
			configurationTarget,
		)

		const allManagedFilesIgnoreEntries = Object.values(internal)
			.map((i) => i.managedFilesIgnoreEntries)
			.flat()

		allManagedFilesIgnoreEntries.forEach((entry) => {
			existingConfiguration.delete(entry)
		})

		await Promise.all([
			workspace
				.getConfiguration("files", workspaceFolder)
				.update(
					"exclude",
					Object.fromEntries(existingConfiguration.entries()),
					configurationTarget,
				),
			workspace
				.getConfiguration(extensionName, workspaceFolder)
				.update("internal", undefined, configurationTarget),
		])
	}

	public async toggleIgnoredFiles(
		workspaceFolder: WorkspaceFolder,
	): Promise<boolean> {
		const { configurationTarget, internal } =
			Config.instance().getConfig(workspaceFolder)
		const existingConfiguration = getExistingExcludedFiles(
			workspaceFolder,
			configurationTarget,
		)

		const activeFocusedWorkspaces = Object.values(internal)
		if (activeFocusedWorkspaces.length === 0) {
			return false
		}

		const allManagedFilesIgnoreEntries = activeFocusedWorkspaces
			.map((i) => i.managedFilesIgnoreEntries)
			.flat()

		allManagedFilesIgnoreEntries.forEach((entry) => {
			existingConfiguration.set(entry, !existingConfiguration.get(entry))
		})

		await Promise.all([
			workspace
				.getConfiguration("files", workspaceFolder)
				.update(
					"exclude",
					Object.fromEntries(existingConfiguration.entries()),
					configurationTarget,
				),
		])

		return true
	}

	public dispose(): void {
		this.subscription.dispose()
	}
}

function getExistingExcludedFiles(
	workspaceFolder: WorkspaceFolder,
	configurationTarget: ConfigurationTarget,
): Map<string, boolean> {
	const existingConfiguration = workspace
		.getConfiguration("files", workspaceFolder)
		.inspect<Record<string, boolean>>("exclude")

	switch (configurationTarget) {
		case ConfigurationTarget.Global:
			return mapRecordToMap(existingConfiguration?.globalValue ?? {})
		case ConfigurationTarget.Workspace:
			return mapRecordToMap(existingConfiguration?.workspaceValue ?? {})
		case ConfigurationTarget.WorkspaceFolder:
		default:
			return mapRecordToMap(existingConfiguration?.workspaceFolderValue ?? {})
	}
}

function getConfig(
	workspaceFolder?: WorkspaceFolder,
): MonorepoFocusWorkspaceVSCodeConfig {
	const config = workspace.getConfiguration(extensionName, workspaceFolder)

	return {
		enableLogs: !!config.enableLogs,
		rootPackageJsonRelativePath: (
			(config.rootPackageJsonRelativePath as string | undefined) ??
			"package.json"
		).toString(),
		configurationTarget: mapConfigurationTarget(
			config.configurationTarget as string | undefined,
		),
		internal: config.internal
			? Object.entries((config.internal as object | undefined) ?? {}).reduce<
					Record<
						string,
						{
							managedFilesIgnoreEntries: string[]
							focusedWorkspace: string
						}
					>
			  >((acc, [key, value]) => {
					const valueObject =
						(value as
							| {
									managedFilesIgnoreEntries?: string[]
									focusedWorkspace?: string
							  }
							| undefined) ?? {}
					if (typeof valueObject.focusedWorkspace !== "string") {
						return acc
					}

					acc[key.toString()] = {
						focusedWorkspace: valueObject.focusedWorkspace.toString(),
						managedFilesIgnoreEntries: Array.isArray(
							valueObject.managedFilesIgnoreEntries,
						)
							? valueObject.managedFilesIgnoreEntries
									.map((path: string | undefined) => path?.toString())
									.filter(isNotNil)
							: [],
					}
					return acc
			  }, {})
			: {},
	}
}

const mapConfigurationTarget = (input?: string): ConfigurationTarget => {
	switch (input) {
		case "global":
			return ConfigurationTarget.Global
		case "workspace-folder":
			return ConfigurationTarget.WorkspaceFolder
		case "workspace":
		default:
			return ConfigurationTarget.Workspace
	}
}

export const mapRecordToMap = (data: Record<string, boolean>) =>
	Object.entries(data).reduce<Map<string, boolean>>((acc, [key, value]) => {
		acc.set(key, value)
		return acc
	}, new Map())
