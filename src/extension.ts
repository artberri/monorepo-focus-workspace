import type { ExtensionContext } from "vscode"
import { commands } from "vscode"
import { focusCommand } from "./commands/focus"
import { resetCommand } from "./commands/reset"
import { Config } from "./crosscutting/config"
import { Logger } from "./crosscutting/logger"
import { extensionName } from "./crosscutting/utils"

export function activate(context: ExtensionContext) {
	const config = Config.instance()
	const logger = Logger.instance()

	logger.logInfo(`Extension Version: ${context.extension.packageJSON.version}.`)

	const focusCommandDisposable = commands.registerCommand(
		`${extensionName}.focus`,
		focusCommand,
	)

	const resetCommandDisposable = commands.registerCommand(
		`${extensionName}.reset`,
		resetCommand,
	)

	context.subscriptions.push(
		logger,
		config,
		focusCommandDisposable,
		resetCommandDisposable,
	)
}

export function deactivate() {}
