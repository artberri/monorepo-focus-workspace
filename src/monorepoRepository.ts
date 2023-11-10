import { posix } from "path"
import { RelativePattern, Uri, WorkspaceFolder, workspace } from "vscode"
import { getConfig } from "./getConfig"
import { Logger } from "./logger"
import { Monorepo } from "./monorepo"
import { doesUriExists, isNotNil, readJson } from "./utils"
import { Workspace } from "./workspace"

interface PackageJson {
	name: string
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
	const { rootPackageJsonRelativePath } = getConfig()
	const packageJSONPath = posix.join(
		folder.uri.path,
		rootPackageJsonRelativePath,
		"package.json",
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
		const fullPattern = rootPackageJsonRelativePath
			? `${rootPackageJsonRelativePath}/${workspacePattern}`
			: workspacePattern
		const searchPattern = new RelativePattern(
			folder,
			`${fullPattern}/package.json`,
		)
		logger.logInfo(`Searching files using pattern ${searchPattern.pattern}...`)

		return workspace.findFiles(searchPattern)
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
