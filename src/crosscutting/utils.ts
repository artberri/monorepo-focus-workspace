import { posix } from "path"
import type { Uri } from "vscode"
import { workspace } from "vscode"

export const extensionName = "monorepoFocusWorkspace"

export const doesUriExists = async (uri: Uri): Promise<boolean> => {
	try {
		await workspace.fs.stat(uri)
		return true
	} catch {
		return false
	}
}

export const readJson = async <T>(fileUri: Uri): Promise<T> => {
	const readData = await workspace.fs.readFile(fileUri)
	const readStr = Buffer.from(readData).toString("utf8")
	return JSON.parse(readStr)
}

export const isNotNil = <T>(value: T | null | undefined): value is T =>
	value !== null && value !== undefined

export const getRelativePath = (base: Uri, file: Uri): string => {
	const baseDir = posix.dirname(base.path)
	const fileDir = posix.dirname(file.path)
	return posix.relative(baseDir, fileDir)
}

export const getDirname = (file: string): string => {
	return posix.dirname(file)
}

export const joinPaths = (...paths: string[]): string => {
	return posix.join(...paths)
}

export const toGlobPattern = (path: string): string => {
	const globPath = path.replaceAll(posix.sep, "/")

	if (globPath.startsWith("./")) {
		return globPath.slice(2)
	}

	return globPath
}
