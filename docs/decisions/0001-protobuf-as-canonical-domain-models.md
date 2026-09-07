# 0001: Protobuf as canonical domain models

Status: Accepted  
Date: 2026-09-07

## Originating prompt

The project should use Protobuf-based models across the frontend, backend, workers, retailer adapters, and domain logic. The question was whether Protobuf should merely define transport contracts or serve as the canonical CartHound domain model as well.

## Context

CartHound uses TypeScript across its major application components and communicates through gRPC and ConnectRPC/gRPC-Web.

Maintaining separate but substantially identical model layers such as transport DTOs, domain models, API models, and frontend models would introduce additional mapping code and create opportunities for those representations to drift apart.

The project needs one authoritative model definition that can be shared consistently across services and generated for TypeScript consumers.

## Decision

Protobuf definitions are the canonical CartHound domain models and API contracts.

Generated Protobuf types are used directly by the frontend, backend, workers, retailer adapters, and domain logic where applicable.

Duplicate DTO or domain-model layers must not be introduced without a concrete technical need.

Database persistence models and retailer-specific API models may differ from the canonical Protobuf domain model because they serve different external or physical-storage concerns.

## Rationale

Using Protobuf as the canonical model provides:

- one authoritative definition for shared data structures
- generated strongly typed models across application components
- explicit schema evolution through stable field numbers
- compatibility between independently deployed services
- less repetitive mapping code
- reduced risk of multiple representations drifting apart

CartHound favors data-oriented domain models with domain behavior implemented as functions operating on generated Protobuf types rather than requiring behavior-rich object-oriented domain classes.

## Alternatives considered

### Separate domain models and Protobuf transport models

This would isolate transport concerns from domain concerns but would require mapping between largely equivalent structures throughout the codebase.

It was rejected because CartHound currently has no demonstrated requirement that justifies the additional model layer and maintenance cost.

### TypeScript interfaces as canonical models

This would be simple inside TypeScript code but would weaken the API contract and make cross-service schema compatibility less explicit.

It was rejected because Protobuf already provides the shared contract needed by the application.

### Serialized Protobuf as the database format

This would make persistence serialization straightforward but would significantly reduce PostgreSQL's usefulness for relational queries, indexes, constraints, joins, and analytics.

It was rejected. Protobuf is the canonical application/domain model, not the physical database storage format.

## Consequences

- `.proto` files become central architectural artifacts and must be reviewed carefully.
- Protobuf schema evolution rules must be followed, including preserving field numbers and reserving removed fields or enum values.
- Generated types may appear throughout the application.
- Domain behavior should generally operate on generated Protobuf values instead of introducing parallel domain classes.
- The persistence layer is responsible for reconstructing Protobuf objects from relational data.
- Retailer adapters are responsible for translating retailer-specific responses into canonical Protobuf models.

## Assumptions

This decision assumes:

- TypeScript remains the primary implementation language across major CartHound components.
- Protobuf-generated TypeScript types remain practical to use directly in application and domain logic.
- ConnectRPC/gRPC-Web remains suitable for browser communication.
- Domain concepts can continue to be represented cleanly in Protobuf.

## Revisit when

Reconsider this decision if:

- generated Protobuf types materially interfere with domain logic
- important domain semantics cannot be represented cleanly in Protobuf
- transport concerns begin forcing undesirable domain-model compromises
- the frontend or backend moves to a technology that makes direct Protobuf model use impractical
- substantial duplicated mapping logic appears despite using Protobuf as the canonical model
- multiple independent representations become necessary for concrete technical reasons

## Related

- `AGENTS.md`
- `packages/proto`
- Decision 0003: Relational PostgreSQL persistence
