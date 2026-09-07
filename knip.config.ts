import {
	createKnipConfig,
	rootWorkspaceConfig,
	workspaceConfig,
	type SharedKnipConfig,
} from "@chris-shaw-2011/lint/knip"

const config: SharedKnipConfig = createKnipConfig({
	workspaces: {
		".": rootWorkspaceConfig(),
		"apps/*": workspaceConfig(),
		"packages/*": workspaceConfig({ entry: ["src/index.ts"] }),
	},
})

export default config
