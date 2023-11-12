import { Config } from "../crosscutting/config"
import { Logger } from "../crosscutting/logger"
import { getMonorepos } from "../main/monorepoRepository"

export const resetCommand = async () => {
	const logger = Logger.instance()
	logger.logInfo("Command monorepoFocusWorkspace.reset called")

	const monorepos = await getMonorepos()

	await Config.instance().resetIgnoredFiles(
		monorepos.map((monorepo) => monorepo.workspaceFolder),
	)
}
