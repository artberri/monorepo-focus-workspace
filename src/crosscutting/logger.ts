import { window } from "vscode"
import { Config } from "./config"

export class Logger {
	private static _instance?: Logger

	public static instance(): Logger {
		if (!Logger._instance) {
			Logger._instance = new Logger()
		}

		return Logger._instance
	}

	private constructor() {}

	private outputChannel = window.createOutputChannel("FocusWorkspace")

	public logInfo(message: string, data?: unknown): void {
		if (!Config.instance().enableLogs) {
			return
		}

		this.logMessage(message, "INFO")
		if (data) {
			this.logObject(data)
		}
	}

	public logError(message: string, error?: unknown) {
		if (!Config.instance().enableLogs) {
			return
		}

		this.logMessage(message, "ERROR")
		if (typeof error === "string") {
			// Errors as a string usually only happen with
			// plugins that don't return the expected error.
			this.outputChannel.appendLine(error)
		} else if (error instanceof Error) {
			if (error?.message) {
				this.logMessage(error.message, "ERROR")
			}
			if (error?.stack) {
				this.outputChannel.appendLine(error.stack)
			}
		} else if (error) {
			this.logObject(error)
		}
	}

	public dispose(): void {
		Logger._instance = undefined
	}

	private logObject(data: unknown): void {
		const message = JSON.stringify(data, null, 2)
		this.outputChannel.appendLine(message)
	}

	private logMessage(message: string, logLevel: string): void {
		const title = new Date().toLocaleTimeString()
		this.outputChannel.appendLine(`["${logLevel}" - ${title}] ${message}`)
	}
}
