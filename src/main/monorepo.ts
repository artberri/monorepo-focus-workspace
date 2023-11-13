import type { Uri, WorkspaceFolder } from "vscode"
import {
	getDirname,
	getRelativePath,
	toGlobPattern,
} from "../crosscutting/utils"
import type { Workspace } from "./workspace"

export class Monorepo {
	public static create({
		name,
		workspaceFolder,
		workspaces,
		packageJsonUri,
		patterns,
	}: {
		name: string
		workspaceFolder: WorkspaceFolder
		workspaces: Workspace[]
		packageJsonUri: Uri
		patterns: string[]
	}) {
		return new Monorepo(
			name,
			workspaceFolder,
			packageJsonUri,
			workspaces,
			patterns,
		)
	}

	public readonly workspaces: MonorepoWorkspace[]

	private constructor(
		public readonly name: string,
		public readonly workspaceFolder: WorkspaceFolder,
		public readonly packageJsonUri: Uri,
		private readonly rawWorkspaces: Workspace[],
		public readonly patterns: string[],
	) {
		this.workspaces = this.buildWorspaces()
	}

	public get workspaceFolderName(): string {
		return this.workspaceFolder.name
	}

	public get fsPath(): string {
		return getRelativePath(
			this.workspaceFolder.uri.fsPath,
			getDirname(this.packageJsonUri.fsPath),
		)
	}

	public getIgnoreConfig(focusOn: MonorepoWorkspace): Record<string, boolean> {
		const includedWorkspaces = [
			...this.findWorkspaceDependencies(focusOn, true).map(
				(workspace) => workspace.name,
			),
			focusOn.name,
		]

		return this.workspaces
			.filter((w) => !includedWorkspaces.includes(w.name))
			.reduce<Record<string, boolean>>((acc, workspace) => {
				acc[workspace.ignorePath] = true
				return acc
			}, {})
	}

	public getWorkspaceDependencies(
		focusOn: MonorepoWorkspace,
		withDevDependencies: boolean,
	): MonorepoWorkspace[] {
		return this.findWorkspaceDependencies(focusOn, withDevDependencies)
	}

	private findWorkspaceDependencies(
		workspace: MonorepoWorkspace,
		withDevDependencies: boolean,
		alreadyFound: string[] = [],
	): MonorepoWorkspace[] {
		const dependencies = workspace.dependencies
			.filter((dependency) => !alreadyFound.includes(dependency))
			.map((dependency) => {
				const found = this.workspaces.find(
					(workspace) => workspace.name === dependency,
				)
				if (!found) {
					throw new Error(
						`Could not find workspace ${dependency} in monorepo ${this.name}`,
					)
				}
				return found
			})

		const devDependencies = withDevDependencies
			? workspace.devDependencies
					.filter((dependency) => !alreadyFound.includes(dependency))
					.map((dependency) => {
						const found = this.workspaces.find(
							(workspace) => workspace.name === dependency,
						)
						if (!found) {
							throw new Error(
								`Could not find workspace ${dependency} in monorepo ${this.name}`,
							)
						}
						return found
					})
			: []

		const found = [...dependencies, ...devDependencies]

		if (found.length === 0) {
			return []
		}

		return [
			...found,
			...found.flatMap((workspace) =>
				this.findWorkspaceDependencies(workspace, withDevDependencies, [
					...alreadyFound,
					...found.map((workspace) => workspace.name),
				]),
			),
		]
	}

	private buildWorspaces() {
		const workspaceNames = this.rawWorkspaces.map((workspace) => workspace.name)
		return this.rawWorkspaces
			.map(
				mapMonorepoWorkspace({
					workspaceNames,
					monorepoPackageJsonUri: this.packageJsonUri,
					workspaceFolderUri: this.workspaceFolder.uri,
				}),
			)
			.sort((a, b) => {
				if (a.weight === b.weight) {
					return a.name.localeCompare(b.name)
				}
				return a.weight - b.weight
			})
	}
}

export interface MonorepoWorkspace {
	name: string
	fsPath: string
	ignorePath: string
	emoji: "📦" | "🛠️" | "🚀" | "🧩"
	weight: number
	dependencies: string[]
	devDependencies: string[]
}

const mapMonorepoWorkspace =
	({
		workspaceNames,
		monorepoPackageJsonUri,
		workspaceFolderUri,
	}: {
		workspaceNames: string[]
		monorepoPackageJsonUri: Uri
		workspaceFolderUri: Uri
	}) =>
	(workspace: Workspace): MonorepoWorkspace => {
		const path = getRelativePath(
			getDirname(monorepoPackageJsonUri.fsPath),
			getDirname(workspace.packageJsonUri.fsPath),
		)
		const ignorePath = toGlobPattern(
			getRelativePath(
				workspaceFolderUri.fsPath,
				getDirname(workspace.packageJsonUri.fsPath),
			),
		)
		const emoji = path.startsWith("apps")
			? "🚀"
			: path.startsWith("packages")
			? "📦"
			: path.startsWith("tools")
			? "🛠️"
			: "🧩"

		const weight = path.startsWith("apps")
			? 10
			: path.startsWith("packages")
			? 20
			: path.startsWith("tools")
			? 30
			: 40

		return {
			name: workspace.name,
			fsPath: path,
			ignorePath,
			weight,
			emoji,
			dependencies: workspace.dependencies.filter((dependency) =>
				workspaceNames.includes(dependency),
			),
			devDependencies: workspace.devDependencies.filter((dependency) =>
				workspaceNames.includes(dependency),
			),
		}
	}
