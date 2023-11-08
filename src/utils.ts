import { workspace } from "vscode"

interface FocusWorkspaceVSCodeConfig {
	enableLogs: boolean
	rootPackageJsonRelativePath: string | null
}

export function getConfig(): FocusWorkspaceVSCodeConfig {
	const config = workspace.getConfiguration(
		"focusWorkspace",
	) as unknown as FocusWorkspaceVSCodeConfig

	// Some settings are disabled for untrusted workspaces
	// because they can be used for bad things.
	if (!workspace.isTrusted) {
		const newConfig = {
			...config,
			prettierPath: false,
			rootPackageJsonRelativePath: null,
		}
		return newConfig
	}

	return config
}
