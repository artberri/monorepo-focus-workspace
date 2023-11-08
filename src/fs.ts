import { Uri, workspace } from "vscode"

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