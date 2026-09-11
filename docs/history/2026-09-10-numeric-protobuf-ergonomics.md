# 2026-09-10: Numeric Protobuf ergonomics investigation

## User request

> The google.type.Money and google.type.Decimal types aren't very developer friendly to use.
>
> Looking at the generated code for decimal it stores the value as a string and the generated code for Money has units and nanos. Obviously this data structure is the most efficient way to store this type of data but the programming experience with this will suck since comparisions, math, and display require more work than if you're dealing with a standard numerical type.
>
> What I want you to do is to figure out if there is some way we can make this more developer friendly. I still want the data to be transferred across the wire using the built in proto types, but from the developer point of view I want to make sure the objects they are working with can still be used like a normal numerical type (possibly by implicit conversion from the proto type to a numerical type). I don't want to have conversion methods that need to be called, I want the type that the developer sees to abstract all of this away so as far as they're concerned it's a number but behind the scenes the actual stored data value will contune to be back by the proto.
>
> Is this possible?

## Findings

This is a feasibility investigation, not authorization to replace the runtime models. Inspected the installed Protobuf-ES 2.14.1 generator options and create implementation, the ECMAScript arithmetic specification, decimal.js documentation, and TC39's decimal/operator-overloading work.

JavaScript does not support user-defined arithmetic operator overloading. Symbol.toPrimitive/valueOf can turn an object into a primitive before arithmetic, but they do not control the operator or wrap its result. Returning Number loses exactness; returning bigint permits integer arithmetic but does not carry decimal scale or currency, and multiplication/division do not maintain fixed-point scaling automatically. Strict equality between objects tests identity. TypeScript annotations and native type stripping cannot change those runtime semantics.

An in-memory probe on Node 26.8.2 confirmed that decimal-backed objects coerced to Number produce 0.30000000000000004 for 0.1 + 0.2, return a primitive number, collapse the difference between 9007199254740993 and 9007199254740992 to zero, and retain object-identity strict equality. No source implementation or persistent test fixture was added for this probe.

The installed Protobuf-ES runtime creates data messages, not numeric classes. No documented generator option maps google.type.Money/Decimal to custom arithmetic objects. A custom class or prototype modification alone would not make all newly decoded, cloned, or nested messages acquire that behavior automatically.

## Proposed direction, not an accepted architectural change

A narrowly scoped numeric behavior layer could hide conversion from application callers while retaining Google's wire schemas and canonical Protobuf values. Arithmetic/comparison methods could operate on exact values and return similarly usable protobuf-backed values; formatting could handle locale and currency. Application syntax would be methods such as price.mul(quantity), total.lt(budget), and total.format(locale), not overloaded +, <, or === operators. Division and currency compatibility need explicit policies; no representation makes every division result a finite exact decimal.

Automatic integration would require deliberate creation/decoding/serialization boundaries and corresponding TypeScript types. It must cover nested messages and future RPC decoding; this is not a built-in Protobuf-ES switch. Prefer enriching only these numeric value objects over introducing duplicate Product/Offer DTOs. Any departure from the accepted direct-generated-model policy needs an explicit design decision before implementation. A compiler transform could rewrite arithmetic operators but conflicts with the native type-stripping architecture and is not recommended here.

Only this research history was added. No numeric facade, arithmetic library, schema change, or conversion infrastructure was implemented.

## Sources

- [ECMAScript operator semantics](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-applystringornumericbinaryoperator)
- [Protobuf-ES generator options](https://github.com/bufbuild/protobuf-es/tree/main/packages/protoc-gen-es)
- [decimal.js arithmetic API](https://mikemcl.github.io/decimal.js/)
- [TC39 decimal proposal](https://github.com/tc39/proposal-decimal)
- [Withdrawn operator-overloading proposal](https://github.com/tc39/proposal-operator-overloading)
