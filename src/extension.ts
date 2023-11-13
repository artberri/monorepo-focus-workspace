import type { ExtensionContext } from "vscode"
import { commands } from "vscode"
import { FocusMode, focusCommand } from "./commands/focus"
import { resetCommand } from "./commands/reset"
import { Config } from "./crosscutting/config"
import { Logger } from "./crosscutting/logger"
import { extensionName } from "./crosscutting/utils"
import type { PackageJson } from "./main/monorepoService"

export function activate(context: ExtensionContext) {
	const config = Config.instance()
	const logger = Logger.instance()

	logger.logInfo(
		`Extension Version: ${
			(context.extension.packageJSON as PackageJson).version
		}.`,
	)

	const focusCommandDisposable = commands.registerCommand(
		`${extensionName}.focus`,
		focusCommand(FocusMode.Normal),
	)

	const focusWithoutDevDependenciesCommandDisposable = commands.registerCommand(
		`${extensionName}.focusWithoutDevDependencies`,
		focusCommand(FocusMode.WithoutDevDependencies),
	)

	const focusOnlyCommandDisposable = commands.registerCommand(
		`${extensionName}.focusOnly`,
		focusCommand(FocusMode.Only),
	)

	const resetCommandDisposable = commands.registerCommand(
		`${extensionName}.reset`,
		resetCommand,
	)

	context.subscriptions.push(
		logger,
		config,
		focusCommandDisposable,
		focusWithoutDevDependenciesCommandDisposable,
		focusOnlyCommandDisposable,
		resetCommandDisposable,
	)
}

export function deactivate() {}
