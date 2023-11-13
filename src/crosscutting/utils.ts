import { readdir } from "fs"
import { posix } from "path"
import type { Uri } from "vscode"
import { window, workspace } from "vscode"

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
	return JSON.parse(readStr) as T
}

export const isNotNil = <T>(value: T | null | undefined): value is T =>
	value !== null && value !== undefined

export const getRelativePath = (base: string, file: string): string => {
	return posix.relative(base, file)
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

export const getParentFolder = (fsPath: string): string => {
	return posix.normalize(posix.join(fsPath, ".."))
}

export function readDir(path: string): Promise<string[]> {
	return new Promise<string[]>((resolve) => {
		readdir(path, (error, children) => {
			if (error) {
				void window.showErrorMessage(
					`Error reading directory ${path}: ${error.message}`,
				)
				resolve([])
				return
			}
			resolve(children.map((child) => posix.join(path, child)))
		})
	})
}
