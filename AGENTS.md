# CartHound

CartHound is a self-hosted grocery price comparison application.

## Goals

- Compare grocery prices between local stores.
- Maintain reusable shopping lists.
- Determine the cheapest retailer for individual products.
- Compare total basket cost.
- Normalize package sizes and unit pricing.
- Maintain price history.
- Product tags which allow complex searching such as getting the cheapest "butter"
- Support for: Kroger, Meijer, Walmart, Sam's Club, Costco, ALDI

## Architecture

Protobuf definitions are the canonical CartHound domain models and API contracts.

Generated Protobuf types are used directly by frontend, backend, workers, retailer adapters, and domain logic where applicable.

Do not create duplicate DTO/domain model layers.

Internal backend services communicate using native gRPC.

Typescript & React based Web frontend.

Nodejs & typescript based API/backend.

The React frontend communicates with the backend using ConnectRPC/gRPC-Web over HTTP.

Monetary amounts are not represented using JavaScript floating-point numbers.

Integer minor units (cents) or PostgreSQL NUMERIC/DECIMAL is used for prices.

Retailer integrations implement a common adapter interface.

Application code does not directly depend on retailer-specific APIs.

Retailer-specific API payloads, authentication details, URLs, scraping logic, cookies, headers, and identifiers exist only in the retailer adapter.

Adapters convert retailer-specific data into CartHound domain models.

Adding a new retailer adapter does not require changes to existing retailer adapters. Changes outside packages/retailers is limited to registration/configuration unless new domain capabilities are required.

Retailer adapters:
- KrogerAdapter
- MeijerAdapter
- WalmartAdapter
- SamsClubAdapter
- CostcoAdapter
- AldiAdapter

If implementing a feature requires violating one of these architectural rules, do not work around the rule silently, call out the conflict and propose an architectural change first.

## Repository structure

Use a monorepo.

- apps/web - React frontend
- apps/api - Node.js/TypeScript API
- apps/worker - background jobs and price refresh
- packages/proto - protobuf API definitions and generated models
- packages/core - shared domain logic
- packages/retailers - retailer adapter interfaces and implementations

## Data model principles

Separate:
- products
- retailer listings
- stores
- offers/prices
- historical price snapshots
- tags
- saved product searches

A Product represents a specific real-world product, preferably identified by UPC/GTIN when available.

The same Product may have listings at multiple retailers.

Retailer listings represent a retailer's representation of a Product and contain retailer-specific identifiers and metadata.

Products may have multiple Tags, referenced in the canonical Product message by
their normalized names.

Tags provide semantic classification and enable flexible product matching and searching.

Generic shopping intents such as "butter", "milk", or "paper towels" should be represented as tag-based search expressions rather than abstract product records.

Search expressions support logical operators such as AND, OR, and NOT.

Saved search expressions are used as shopping-list items, allowing a shopping list item to represent either an exact Product or a set of acceptable Products.

Prices and availability belong to an offer associated with:

- retailer product
- physical/store location
- timestamp

Unit normalization and price-per-unit calculations are in the domain layer.

Adapters return the retailer's raw package quantity/size along with normalized measurements when confidently available.

## Tags

Tags are first-class database entities whose normalized names are their globally
unique identifiers. Product's repeated tag strings are references to those managed
identifiers, not arbitrary retailer-supplied values.

Tag names are normalized and unique.

Retailer adapters do not create new Tags automatically.

Tags represent semantic product characteristics such as:
- butter
- salted
- unsalted
- organic
- dairy
- plant-based

Measurable or transactional properties such as package size, quantity, price, and availability are modeled as structured data rather than Tags.

## Persistence

PostgreSQL uses a normalized relational schema optimized for querying, constraints, and indexing.

Protobuf messages are the canonical CartHound application/domain models but are not stored as serialized Protobuf blobs.

The persistence layer is responsible for converting between relational database rows and canonical Protobuf messages.

Database implementation details and row types must not leak outside the persistence layer.

Core queryable fields are stored in typed relational columns rather than JSONB.

JSONB may be used for retailer-specific raw payloads, debugging metadata, or other genuinely schemaless data.

Database schema design should prioritize effective indexes and query performance rather than attempting to mirror the serialized Protobuf wire format.

## Development priorities

Implement retailers in this order:

1. Kroger
2. Meijer
3. Walmart
4. Sam's Club
5. ALDI
6. Costco

Start with Kroger because it provides the cleanest official API.

## General

- Dockerized development and production environment.
- PostgreSQL database.
- Separate background worker for price updates.
- Prefer maintainability over clever abstractions.

## Testing

- Core domain logic has unit tests.
- Each retailer adapter has fixture-based tests using captured/sanitized responses.
- Tests do not depend on live retailer APIs.
- Live integration tests are explicitly separated from the normal test suite.
- Product normalization and unit-price calculations have unit tests.

## Development history

The repository is the durable historical record of CartHound development.

Agent conversations must not be treated as the only source of historical context.

For development work, preserve the user input that initiated or materially changed the work, along with the important conclusions, assertions, assumptions, and decisions made by the agent.

Store development history under:

- `docs/history/` for chronological interaction/work records
- `docs/decisions/` for significant architectural or design decisions

### History records

Create or update a history record for each meaningful development session or task.

History records should preserve, in chronological order:

- user prompts and follow-up instructions
- clarifications supplied by the user
- important assertions made by the agent
- assumptions relied upon by the agent
- decisions made during implementation
- alternatives discussed when relevant
- discoveries that affected the implementation
- changes made to the repository
- related decision records
- related commits or pull requests when available

User prompts should be preserved verbatim when practical.

Agent content does not need to preserve private internal reasoning. Instead, record the conclusions, assertions, assumptions, rationale, and decisions that were communicated or materially affected the implementation.

History records are append-only historical documents. Do not rewrite prior history to make earlier reasoning appear consistent with later decisions.

If an earlier assertion or assumption is later found to be incorrect, preserve the original record and add a later entry explaining the correction.

### Security and privacy

Never store secrets or sensitive credentials in development history.

Before recording user input or tool output, remove or redact:

- passwords
- API keys
- authentication tokens
- cookies or session credentials
- private keys
- connection strings containing credentials
- other secrets that should not be committed to source control

Do not store large raw tool outputs, generated files, dependency logs, or other low-value data merely for completeness. Record the relevant conclusions and references instead.

### Decision records

Significant decisions must additionally be documented under `docs/decisions/`.

History records explain what happened during development.

Decision records explain the durable architectural decision and why it was made.

History records should link to resulting decision records, and decision records should link back to the relevant history record when useful.

#IMPORTANT
A development task is not complete until its material user instructions, decisions, assumptions, and resulting repository changes have been recorded in the appropriate history record.
