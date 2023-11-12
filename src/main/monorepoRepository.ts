import type { Uri, WorkspaceFolder } from "vscode"
import { RelativePattern, workspace } from "vscode"
import { Config } from "../crosscutting/config"
import { Logger } from "../crosscutting/logger"
import {
	doesUriExists,
	getDirname,
	isNotNil,
	joinPaths,
	readJson,
	toGlobPattern,
} from "../crosscutting/utils"
import { Monorepo } from "./monorepo"
import type { Workspace } from "./workspace"

export interface PackageJson {
	name: string
	version?: string
	workspaces?: string[]
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
}

export const getMonorepos = async (): Promise<Monorepo[]> => {
	return (
		await Promise.all((workspace.workspaceFolders ?? []).map(getMonorepo))
	).filter(isNotNil)
}

export const getMonorepo = async (
	folder: WorkspaceFolder,
): Promise<Monorepo | undefined> => {
	const logger = Logger.instance()
	const { rootPackageJsonRelativePath } = Config.instance().getConfig()
	const packageJSONPath = joinPaths(
		folder.uri.path,
		rootPackageJsonRelativePath,
	)
	const rootPackageJson = folder.uri.with({ path: packageJSONPath })
	logger.logInfo(`Parsing ${rootPackageJson.fsPath} file`)

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
		logger.logError(`Can not parse JSON file ${rootPackageJson.fsPath}`, error)
		return undefined
	}

	if (!rootPackageJsonData.workspaces) {
		logger.logInfo(
			`This package.json has not workspaces: ${rootPackageJson.fsPath}`,
		)
		return undefined
	}

	logger.logInfo(`Found ${rootPackageJsonData.workspaces.join()} workspaces`)

	const workspacePackageJsons = (
		await Promise.all(
			rootPackageJsonData.workspaces.map(
				getWorkspacePackageJsons({ folder, rootPackageJsonRelativePath }),
			),
		)
	).flat()

	const workspaces = (
		await Promise.all(workspacePackageJsons.map(getRawWorkspace))
	).filter(isNotNil)

	workspaces.forEach((workspace) => {
		logger.logInfo(
			`Found workspace ${workspace.name} in the ${rootPackageJsonData.name} monorepo`,
		)
	})

	return Monorepo.create({
		name: rootPackageJsonData.name,
		workspaceFolder: folder,
		workspaces,
		packageJsonUri: rootPackageJson,
	})
}

const getWorkspacePackageJsons =
	({
		folder,
		rootPackageJsonRelativePath,
	}: {
		folder: WorkspaceFolder
		rootPackageJsonRelativePath: string
	}) =>
	async (workspacePattern: string): Promise<Uri[]> => {
		const logger = Logger.instance()
		const fullPattern = toGlobPattern(
			`${getDirname(
				rootPackageJsonRelativePath,
			)}/${workspacePattern}/package.json`,
		)
		const searchPattern = new RelativePattern(folder, fullPattern)
		logger.logInfo(`Searching files using pattern ${searchPattern.pattern}...`)

		return workspace.findFiles(searchPattern, null)
	}

const getRawWorkspace = async (
	packageJson: Uri,
): Promise<Workspace | undefined> => {
	let packageJsonData: PackageJson
	try {
		packageJsonData = await readJson<PackageJson>(packageJson)
	} catch (error) {
		const logger = Logger.instance()
		logger.logError(`Can not parse JSON file ${packageJson.fsPath}`, error)
		return undefined
	}

	return {
		name: packageJsonData.name,
		packageJsonUri: packageJson,
		dependencies: packageJsonData.dependencies
			? Object.keys(packageJsonData.dependencies)
			: [],
		devDependencies: packageJsonData.devDependencies
			? Object.keys(packageJsonData.devDependencies)
			: [],
	}
}
