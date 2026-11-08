import { Config } from "../crosscutting/config"
import { Logger } from "../crosscutting/logger"
import { withStatusProgress } from "../crosscutting/utils"
import { getMonorepos } from "../main/monorepoService"

export const resetCommand = async () => {
	const logger = Logger.instance()
	logger.logInfo("Command monorepoFocusWorkspace.reset called")

	await withStatusProgress("Monorepo: resetting workspace focus", async () => {
		await Config.instance().removeWorkspaceLevelFocus()
		const monorepos = await getMonorepos()
		await Promise.all(
			monorepos.map((monorepo) =>
				Config.instance().resetIgnoredFiles(monorepo.workspaceFolder),
			),
		)
	})
}
