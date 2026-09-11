import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from "@typescript-eslint/utils"
import { unionConstituents } from "ts-api-utils"
import type { Type } from "typescript"

type NumericType = "google.type.Money" | "google.type.Decimal"
type Options = [{ allow?: NumericType[] }]

export default ESLintUtils.RuleCreator.withoutDocs<Options, "money" | "decimal">({
	meta: {
		type: "problem",
		docs: { description: "Use canonical utilities instead of reading Protobuf numeric storage fields." },
		messages: {
			money: "Direct access to the fields of google.type.Money is prohibited. Use Money.toNumber() or Money.toString() to compare or display this value.",
			decimal: "Direct access to the fields of google.type.Decimal is prohibited. Use Decimal.toNumber() to compare or display this value.",
		},
		schema: [{
			type: "object",
			properties: {
				allow: {
					type: "array",
					items: { type: "string", enum: ["google.type.Money", "google.type.Decimal"] },
					uniqueItems: true,
				},
			},
			additionalProperties: false,
		}],
	},
	defaultOptions: [{}],
	create(context, [options]) {
		const services = ESLintUtils.getParserServices(context)
		const checker = services.program.getTypeChecker()

		function stringLiterals(type: Type) {
			return unionConstituents(type).flatMap(part => part.isStringLiteral() ? [part.value] : [])
		}

		function propertyNames(node: TSESTree.Node, computed: boolean) {
			if (!computed && node.type === AST_NODE_TYPES.Identifier) {
				return [node.name]
			}
			return stringLiterals(services.getTypeAtLocation(node))
		}

		function check(object: TSESTree.Node, keys: string[], reportNode: TSESTree.Node, types = [services.getTypeAtLocation(object)]) {
			if (!keys.some(key => key === "units" || key === "nanos" || key === "value")) {
				return
			}
			const location = services.esTreeNodeToTSNodeMap.get(object)
			const reported = new Set<NumericType>()
			const visited = new Set<Type>()
			function visit(type: Type): void {
				if (visited.has(type)) {
					return
				}
				visited.add(type)
				const constraint = checker.getBaseConstraintOfType(type)
				if (constraint && constraint !== type) {
					visit(constraint)
					return
				}
				if (type.isUnion()) {
					type.types.forEach(visit)
					return
				}
				const tag = type.getProperty("$typeName")
				if (!tag) {
					return
				}
				const names = stringLiterals(checker.getTypeOfSymbolAtLocation(tag, location))
				for (const name of names) {
					if ((name === "google.type.Money" && keys.some(key => key === "units" || key === "nanos")) ||
						(name === "google.type.Decimal" && keys.includes("value"))) {
						if (!options.allow?.includes(name) && !reported.has(name)) {
							reported.add(name)
							context.report({ node: reportNode, messageId: name === "google.type.Money" ? "money" : "decimal" })
						}
					}
				}
			}
			types.forEach(visit)
		}

		function patternTypes(pattern: TSESTree.ObjectPattern): Type[] {
			const parent = pattern.parent
			if (parent.type === AST_NODE_TYPES.AssignmentExpression && parent.left === pattern) {
				return [services.getTypeAtLocation(parent.right)]
			}
			if (parent.type === AST_NODE_TYPES.Property && parent.parent.type === AST_NODE_TYPES.ObjectPattern) {
				const names = propertyNames(parent.key, parent.computed)
				return patternTypes(parent.parent).flatMap(unionConstituents).flatMap(type => names.flatMap(name => {
					const property = type.getProperty(name)
					return property ? [checker.getTypeOfSymbolAtLocation(property, services.esTreeNodeToTSNodeMap.get(pattern))] : []
				}))
			}
			return [services.getTypeAtLocation(pattern)]
		}

		return {
			MemberExpression(node) {
				const parent = node.parent
				// Plain assignment and delete do not read the field. Compound writes do.
				if ((parent.type === AST_NODE_TYPES.AssignmentExpression && parent.left === node && parent.operator === "=") ||
					(parent.type === AST_NODE_TYPES.UnaryExpression && parent.operator === "delete")) {
					return
				}
				check(node.object, propertyNames(node.property, node.computed), node)
			},
			Property(node) {
				if (node.parent.type === AST_NODE_TYPES.ObjectPattern) {
					check(node.parent, propertyNames(node.key, node.computed), node, patternTypes(node.parent))
				}
			},
		}
	},
})
