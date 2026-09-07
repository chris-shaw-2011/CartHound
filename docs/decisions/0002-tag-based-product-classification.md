# 0002: Tag-based product classification and search

Status: Accepted  
Date: 2026-09-07

## Originating prompt

The initial design considered introducing an abstract canonical product concept such as "butter" or "milk" to group specific retailer products.

That approach was rejected because such concepts would be difficult to define consistently and could become simultaneously too broad and too specific.

The preferred design is to classify concrete products using tags and represent generic shopping intent through logical tag-based searches.

## Context

CartHound must support both exact-product shopping and flexible shopping intent.

Examples include:

- "Kerrygold Salted Butter 8 oz" — an exact product
- "butter" — any acceptable butter
- "organic unsalted butter" — products matching several characteristics
- "butter but not plant-based" — products satisfying both positive and negative criteria

A fixed hierarchy or abstract canonical-product layer would require CartHound to define and maintain a taxonomy whose boundaries would often be subjective.

The system instead needs a flexible model that can express arbitrary combinations of product characteristics.

## Decision

CartHound will not use a separate abstract canonical-product-concept layer.

A `Product` represents a specific real-world product, preferably identified by UPC/GTIN when available.

Products are classified using first-class `Tag` entities.

Generic shopping intents such as "butter", "milk", or "paper towels" are represented as product-search expressions rather than abstract product records.

Search expressions support logical operators including:

- AND
- OR
- NOT

Saved product-search expressions may be used as shopping-list items.

A shopping-list item may therefore represent either:

- an exact Product
- a saved search describing a set of acceptable Products

## Rationale

Tags allow CartHound to classify products along multiple independent dimensions without forcing them into a rigid hierarchy.

For example, a product could be tagged with:

- butter
- salted
- organic
- dairy

A query can then express:

`butter AND organic AND NOT plant-based`

This provides substantially more flexibility than maintaining abstract product categories or canonical concepts.

It also lets shopping intent remain a query concern rather than requiring artificial product records representing vague concepts.

## Tag rules

Tags are first-class database entities rather than arbitrary strings embedded directly on Products.

Tag names are normalized and unique.

Retailer adapters do not automatically create new Tags.

Tags describe semantic product characteristics.

Examples include:

- butter
- salted
- unsalted
- organic
- dairy
- plant-based

Measurable or transactional properties are not Tags.

Examples of data that must remain structured rather than tagged include:

- package quantity
- weight
- volume
- pack count
- price
- availability
- retailer
- store

## Alternatives considered

### Canonical product concepts

Under this design, a concept such as `Butter` would exist separately from concrete products.

It was rejected because determining the correct granularity and boundaries for concepts would be subjective and difficult to apply consistently.

### Fixed product-category hierarchy

A taxonomy such as grocery > dairy > butter would provide organization but would not adequately represent cross-cutting attributes such as organic, salted, plant-based, low-sodium, or store-brand.

It was rejected as the primary product-matching mechanism.

A hierarchy could still be introduced later for navigation if needed, but it would not replace tag-based search.

### Free-form product tags

Allowing arbitrary strings directly on products would be easy initially but would quickly create inconsistent values such as `Butter`, `butter`, `butters`, or multiple synonymous spellings.

It was rejected in favor of controlled first-class Tag records.

## Consequences

- Product classification becomes flexible rather than hierarchical.
- Product search becomes a significant domain capability.
- Saved searches become useful reusable entities.
- Tag governance matters because inconsistent tags would reduce search reliability.
- The search engine must eventually compile logical tag expressions into efficient PostgreSQL queries.
- Exact-product matching and generic shopping intent remain separate concepts.
- Product attributes with numeric or measurable semantics remain structured fields.

## Assumptions

This decision assumes:

- products can be described effectively through combinations of semantic tags and structured attributes
- controlled tag creation is practical for the expected scale of CartHound
- PostgreSQL can efficiently query tag relationships using relational indexes
- logical query expressions are sufficient for the initial search requirements

## Revisit when

Reconsider this decision if:

- tag management becomes too difficult to keep consistent
- a clear stable product taxonomy becomes necessary for major features
- users need hierarchical browsing that cannot be implemented cleanly on top of tags
- product matching requires semantic relationships that AND/OR/NOT expressions cannot represent effectively
- automated classification becomes a major requirement and needs a richer ontology

## Related

- `AGENTS.md`
- `packages/core`
- Decision 0003: Relational PostgreSQL persistence
