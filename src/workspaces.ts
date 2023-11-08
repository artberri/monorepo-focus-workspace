import { Uri } from "vscode"
import { doesUriExists, readJson } from "./fs"
import { Logger } from "./logger"

interface PackageJson {
	workspaces?: string[]
}

export class Workspaces {
	public static async fromUri(
		rootPackageJson: Uri,
	): Promise<Workspaces | undefined> {
		const logger = Logger.instance()
		const rootPackageJsonExists = await doesUriExists(rootPackageJson)
		if (!rootPackageJsonExists) {
			logger.logInfo(
				`Can not find root package.json file ${rootPackageJson.fsPath}`,
			)
			return undefined
		}

		let rootPackageJsonData: PackageJson
		try {
			rootPackageJsonData = await readJson<PackageJson>(rootPackageJson)
		} catch (error) {
			logger.logError(
				`Can not parse JSON file ${rootPackageJson.fsPath}`,
				error,
			)
			return undefined
		}

		if (!rootPackageJsonData.workspaces) {
			logger.logInfo(
				`This package.json has not workspaces: ${rootPackageJson.fsPath}`,
			)
			return undefined
		}

		return new Workspaces(rootPackageJsonData.workspaces)
	}

	private readonly logger = Logger.instance()

	public constructor(public readonly workspaces: string[]) {
		this.logger.logInfo(`Found ${this.workspaces.join()} workspaces`)
	}
}
