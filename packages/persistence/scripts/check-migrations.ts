import * as schema from "../src/schema.ts"
import { checkMigrationSnapshot } from "./migration-diff.ts"

await checkMigrationSnapshot(schema)
process.stdout.write("Committed migration snapshot matches the Drizzle schema\n")
