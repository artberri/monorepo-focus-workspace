import { Config } from "../crosscutting/config"
import { Logger } from "../crosscutting/logger"
import { getMonorepos } from "../main/monorepoService"

export const resetCommand = async () => {
	const logger = Logger.instance()
	logger.logInfo("Command monorepoFocusWorkspace.reset called")

	const monorepos = await getMonorepos()

	await Promise.all(
		monorepos.map((monorepo) =>
			Config.instance().resetIgnoredFiles(monorepo.workspaceFolder),
		),
	)
}
