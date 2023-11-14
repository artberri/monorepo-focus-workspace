import type { Uri, WorkspaceFolder } from "vscode"
import { RelativePattern, workspace } from "vscode"
import { Config } from "../crosscutting/config"
import { Logger } from "../crosscutting/logger"
import {
	doesUriExists,
	getDirname,
	getParentFolder,
	getRelativePath,
	isNotNil,
	joinPaths,
	readDir,
	readJson,
	readYaml,
	toGlobPattern,
} from "../crosscutting/utils"
import type { MonorepoWorkspace } from "./monorepo"
import { Monorepo } from "./monorepo"
import type { Workspace } from "./workspace"

export interface PackageJson {
	name: string
	version?: string
	workspaces?: string[] | { packages: string[] }
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
	const { rootPackageJsonRelativePath } = Config.instance().getConfig(folder)
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

	const patterns = await getWorkspacePatterns(
		rootPackageJson,
		rootPackageJsonData,
	)
	if (patterns.length === 0) {
		logger.logInfo(
			`This package.json has not workspaces: ${rootPackageJson.fsPath}`,
		)
		return undefined
	}

	logger.logInfo(`Found ${patterns.join()} workspaces`)

	const workspacePackageJsons = (
		await Promise.all(
			patterns.map(
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
		patterns,
	})
}

export const getIgnoreConfig = async (
	monorepo: Monorepo,
	toKeepWorkspaces: MonorepoWorkspace[],
): Promise<Record<string, boolean>> => {
	const logger = Logger.instance()

	const pathsToAnalyze = [
		monorepo.workspaceFolder.uri.fsPath,
		joinPaths(monorepo.workspaceFolder.uri.fsPath, monorepo.fsPath),
		...new Set(
			monorepo.workspaces.map((workspace) =>
				getParentFolder(
					joinPaths(
						monorepo.workspaceFolder.uri.fsPath,
						monorepo.fsPath,
						workspace.fsPath,
					),
				),
			),
		),
	]

	const toKeepPatterns = toKeepWorkspaces
		.map((workspace) => joinPaths(monorepo.fsPath, workspace.fsPath))
		.map(toGlobPattern)

	const toHide = [
		...new Set(
			(
				await Promise.all(
					pathsToAnalyze.map((path) => {
						logger.logInfo(`Looking for files in path ${path}`)
						return readDir(path)
					}),
				)
			).flat(),
		),
	]
		.map((path) => getRelativePath(monorepo.workspaceFolder.uri.fsPath, path))
		.map(toGlobPattern)
		.filter((path) =>
			toKeepPatterns.every(
				(pattern) => !path.startsWith(pattern) && !pattern.startsWith(path),
			),
		)

	logger.logInfo(`Ignoring paths ${toHide.join(", ")}`)

	return toHide.reduce<Record<string, boolean>>((acc, path) => {
		logger.logInfo(`Ignoring path ${path}`)
		acc[path] = true
		return acc
	}, {})
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

const getWorkspacePatterns = async (
	rootPackageJson: Uri,
	rootPackageJsonData: PackageJson,
): Promise<string[]> => {
	if (
		Array.isArray(rootPackageJsonData.workspaces) &&
		rootPackageJsonData.workspaces.length > 0
	) {
		return rootPackageJsonData.workspaces
	}

	if (
		rootPackageJsonData.workspaces &&
		!Array.isArray(rootPackageJsonData.workspaces) &&
		Array.isArray(rootPackageJsonData.workspaces.packages) &&
		rootPackageJsonData.workspaces.packages.length > 0
	) {
		return rootPackageJsonData.workspaces.packages
	}

	const patterns = await getPnpmWorkspacePatterns(rootPackageJson)
	if (patterns.length > 0) {
		return patterns
	}

	return await getLernaWorkspacePatterns(rootPackageJson)
}

const getPnpmWorkspacePatterns = async (
	rootPackageJson: Uri,
): Promise<string[]> => {
	const logger = Logger.instance()
	const pnpmWorkspaceYaml = rootPackageJson.with({
		path: joinPaths(getDirname(rootPackageJson.fsPath), "pnpm-workspace.yaml"),
	})
	const pnpmWorkspaceExists = await doesUriExists(pnpmWorkspaceYaml)
	if (!pnpmWorkspaceExists) {
		logger.logInfo(
			`Can not find root pnpm-workspace.yaml ${pnpmWorkspaceYaml.fsPath}`,
		)
		return []
	}

	let pnpmWorkspaceYamlData: { packages?: string[] }
	try {
		pnpmWorkspaceYamlData = await readYaml<{ packages?: string[] }>(
			pnpmWorkspaceYaml,
		)
		return pnpmWorkspaceYamlData.packages ?? []
	} catch (error) {
		logger.logError(
			`Can not parse YAML file ${pnpmWorkspaceYaml.fsPath}`,
			error,
		)
		return []
	}
}

const getLernaWorkspacePatterns = async (
	rootPackageJson: Uri,
): Promise<string[]> => {
	const logger = Logger.instance()
	const lernaJson = rootPackageJson.with({
		path: joinPaths(getDirname(rootPackageJson.fsPath), "lerna.json"),
	})
	const lernaWorkspaceExists = await doesUriExists(lernaJson)
	if (!lernaWorkspaceExists) {
		logger.logInfo(`Can not find root lerna.json file ${lernaJson.fsPath}`)
		return []
	}

	let lernaWorkspaceJsonData: { packages?: string[] }
	try {
		lernaWorkspaceJsonData = await readJson<{ packages?: string[] }>(lernaJson)
		return lernaWorkspaceJsonData.packages ?? []
	} catch (error) {
		logger.logError(`Can not parse JSON file ${lernaJson.fsPath}`, error)
		return []
	}
}
