import { Uri, WorkspaceFolder } from "vscode"
import { Workspace } from "./workspace"

export interface Monorepo {
	readonly name: string
	readonly workspaceFolder: WorkspaceFolder
	readonly workspaces: Workspace[]
	readonly packageJsonUri: Uri
}
