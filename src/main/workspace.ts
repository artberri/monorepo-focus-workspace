import type { Uri } from "vscode"

export interface Workspace {
	name: string
	dependencies: string[]
	devDependencies: string[]
	packageJsonUri: Uri
}
