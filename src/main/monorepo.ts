import type { Uri, WorkspaceFolder } from "vscode"
import { getRelativePath } from "../crosscutting/utils"
import type { Workspace } from "./workspace"

export class Monorepo {
	public static create({
		name,
		workspaceFolder,
		workspaces,
		packageJsonUri,
	}: {
		name: string
		workspaceFolder: WorkspaceFolder
		workspaces: Workspace[]
		packageJsonUri: Uri
	}) {
		return new Monorepo(name, workspaceFolder, packageJsonUri, workspaces)
	}

	public readonly workspaces: MonorepoWorkspace[]

	private constructor(
		public readonly name: string,
		public readonly workspaceFolder: WorkspaceFolder,
		public readonly packageJsonUri: Uri,
		private readonly rawWorkspaces: Workspace[],
	) {
		this.workspaces = this.buildWorspaces()
	}

	public get path(): string {
		return getRelativePath(this.workspaceFolder.uri, this.packageJsonUri)
	}

	public getIgnoreConfig(focusOn: MonorepoWorkspace): Record<string, boolean> {
		const includedWorkspaces = [
			...this.findWorkspaceDependencies(focusOn).map(
				(workspace) => workspace.name,
			),
			focusOn.name,
		]

		return this.workspaces
			.filter((w) => !includedWorkspaces.includes(w.name))
			.reduce(
				(acc, workspace) => {
					acc[workspace.path] = true
					return acc
				},
				{} as Record<string, boolean>,
			)
	}

	private findWorkspaceDependencies(
		workspace: MonorepoWorkspace,
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

		const devDependencies = workspace.devDependencies
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

		const found = [...dependencies, ...devDependencies]

		if (found.length === 0) {
			return []
		}

		return [
			...found,
			...found.flatMap((workspace) =>
				this.findWorkspaceDependencies(workspace, [
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
	path: string
	emoji: "📦" | "🛠️" | "🚀"
	weight: number
	dependencies: string[]
	devDependencies: string[]
}

const mapMonorepoWorkspace =
	({
		workspaceNames,
		monorepoPackageJsonUri,
	}: {
		workspaceNames: string[]
		monorepoPackageJsonUri: Uri
	}) =>
	(workspace: Workspace): MonorepoWorkspace => {
		const path = getRelativePath(
			monorepoPackageJsonUri,
			workspace.packageJsonUri,
		)
		const emoji = path.startsWith("apps")
			? "🚀"
			: path.startsWith("packages")
			? "📦"
			: "🛠️"

		const weight = path.startsWith("apps")
			? 10
			: path.startsWith("packages")
			? 20
			: 30

		return {
			name: workspace.name,
			path,
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
