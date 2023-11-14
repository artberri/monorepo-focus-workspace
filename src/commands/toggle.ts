import { window } from "vscode"
import { Config } from "../crosscutting/config"
import { Logger } from "../crosscutting/logger"
import { getMonorepos } from "../main/monorepoService"

export const toggleCommand = async () => {
	const logger = Logger.instance()
	logger.logInfo("Command monorepoFocusWorkspace.toggle called")

	const monorepos = await getMonorepos()

	const toggled = await Promise.all(
		monorepos.map((monorepo) =>
			Config.instance().toggleIgnoredFiles(monorepo.workspaceFolder),
		),
	)

	if (toggled.every((t) => !t)) {
		await window.showWarningMessage(
			"Nothing to toggle. You have not focused any workspace yet.",
		)
		return
	}
}
