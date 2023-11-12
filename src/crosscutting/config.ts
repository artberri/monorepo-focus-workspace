import type { WorkspaceFolder } from "vscode"
import { ConfigurationTarget, window, workspace } from "vscode"
import { extensionName } from "./utils"

export interface MonorepoFocusWorkspaceVSCodeConfig {
	enableLogs: boolean
	rootPackageJsonRelativePath: string
	configurationTarget: ConfigurationTarget
	managedFilesIgnoreEntries: Record<string, string[]>
}

export class Config {
	private static _instance: Config
	private readonly subscription: { dispose(): void }
	public readonly enableLogs: boolean

	private constructor() {
		const { enableLogs } = getConfig()
		this.enableLogs = enableLogs
		this.subscription = workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(`${extensionName}.enableLogs`)) {
				window.showWarningMessage(
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

	public updateIgnoredFiles(
		monorepoName: string,
		workspaceFolder: WorkspaceFolder,
		ignoredFiles: Record<string, boolean>,
	): void {
		const { configurationTarget, managedFilesIgnoreEntries } =
			Config.instance().getConfig()

		const existingConfiguration = getExistingExcludedFiles(
			workspaceFolder,
			configurationTarget,
		)

		;(managedFilesIgnoreEntries[monorepoName] ?? []).forEach((entry) => {
			delete existingConfiguration[entry]
		})

		workspace.getConfiguration("files", workspaceFolder).update(
			"exclude",
			{
				...existingConfiguration,
				...ignoredFiles,
			},
			configurationTarget,
		)

		workspace.getConfiguration(extensionName).update(
			"managedFilesIgnoreEntries",
			{
				...managedFilesIgnoreEntries,
				[monorepoName]: Object.keys(ignoredFiles),
			},
			configurationTarget,
		)
	}

	public resetIgnoredFiles(workspaceFolders: WorkspaceFolder[]): void {
		const { configurationTarget, managedFilesIgnoreEntries } =
			Config.instance().getConfig()

		const allManagedFilesIgnoreEntries = Object.values(
			managedFilesIgnoreEntries,
		).flat()

		workspaceFolders.forEach((workspaceFolder) => {
			const existingConfiguration = getExistingExcludedFiles(
				workspaceFolder,
				configurationTarget,
			)

			allManagedFilesIgnoreEntries.forEach((entry) => {
				delete existingConfiguration[entry]
			})

			workspace
				.getConfiguration("files", workspaceFolder)
				.update("exclude", existingConfiguration, configurationTarget)

			workspace
				.getConfiguration(extensionName)
				.update("managedFilesIgnoreEntries", undefined, configurationTarget)
		})
	}

	public dispose(): void {
		this.subscription.dispose()
	}
}

function getExistingExcludedFiles(
	workspaceFolder: WorkspaceFolder,
	configurationTarget: ConfigurationTarget,
): Record<string, boolean> {
	const existingConfiguration = workspace
		.getConfiguration("files", workspaceFolder)
		.inspect<Record<string, boolean>>("exclude")

	switch (configurationTarget) {
		case ConfigurationTarget.Global:
			return existingConfiguration?.globalValue ?? {}
		case ConfigurationTarget.Workspace:
			return existingConfiguration?.workspaceValue ?? {}
		case ConfigurationTarget.WorkspaceFolder:
		default:
			return existingConfiguration?.workspaceFolderValue ?? {}
	}
}

function getConfig(): MonorepoFocusWorkspaceVSCodeConfig {
	const config = workspace.getConfiguration(extensionName)

	return {
		enableLogs: !!config.enableLogs,
		rootPackageJsonRelativePath: config.rootPackageJsonRelativePath?.toString(),
		configurationTarget: mapConfigurationTarget(config.configurationTarget),
		managedFilesIgnoreEntries: config.managedFilesIgnoreEntries
			? Object.entries(config.managedFilesIgnoreEntries).reduce(
					(acc, [key, value]) => {
						acc[key.toString()] = Array.isArray(value)
							? value.map((path) => path?.toString())
							: []
						return acc
					},
					{} as Record<string, string[]>,
			  )
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
