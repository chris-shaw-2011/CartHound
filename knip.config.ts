import {
	createKnipConfig,
	rootWorkspaceConfig,
	workspaceConfig,
	type SharedKnipConfig,
} from "@chris-shaw-2011/lint/knip"

const config: SharedKnipConfig = createKnipConfig({
	workspaces: {
		".": rootWorkspaceConfig({
			// Buf invokes this local plugin through packages/proto/buf.gen.yaml.
			ignoreDependencies: ["@bufbuild/protoc-gen-es"],
		}),
		"apps/*": workspaceConfig(),
		"packages/*": workspaceConfig({ entry: ["src/index.ts"] }),
	},
})

export default config
