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

	public getConfig(): MonorepoFocusWorkspaceVSCodeConfig {
		return getConfig()
	}

	public async updateIgnoredFiles(
		pickedWorkspace: string,
		monorepoName: string,
		workspaceFolder: WorkspaceFolder,
		ignoredFiles: Record<string, boolean>,
	): Promise<void> {
		const { configurationTarget, internal } = Config.instance().getConfig()

		const existingConfiguration = getExistingExcludedFiles(
			workspaceFolder,
			configurationTarget,
		)

		;(internal[monorepoName]?.managedFilesIgnoreEntries ?? []).forEach(
			(entry) => {
				existingConfiguration.delete(entry)
			},
		)

		await Promise.all([
			workspace.getConfiguration("files", workspaceFolder).update(
				"exclude",
				{
					...Object.fromEntries(existingConfiguration.entries()),
					...ignoredFiles,
				},
				configurationTarget,
			),

			workspace.getConfiguration(extensionName).update(
				"internal",
				{
					...internal,
					[monorepoName]: {
						managedFilesIgnoreEntries: Object.keys(ignoredFiles),
						focusedWorkspace: pickedWorkspace,
					},
				},
				configurationTarget,
			),
		])
	}

	public async resetIgnoredFiles(
		workspaceFolders: WorkspaceFolder[],
	): Promise<void> {
		const { configurationTarget, internal } = Config.instance().getConfig()

		const allManagedFilesIgnoreEntries = Object.values(internal)
			.map((i) => i.managedFilesIgnoreEntries)
			.flat()

		await Promise.all([
			workspaceFolders.map(async (workspaceFolder) => {
				const existingConfiguration = getExistingExcludedFiles(
					workspaceFolder,
					configurationTarget,
				)

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
						.getConfiguration(extensionName)
						.update("internal", undefined, configurationTarget),
				])
			}),
		])
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

function getConfig(): MonorepoFocusWorkspaceVSCodeConfig {
	const config = workspace.getConfiguration(extensionName)

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
