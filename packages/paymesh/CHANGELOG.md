# paymesh

## 1.0.0

### Major Changes

- 81f3825: Split the Stripe provider into a dedicated `@paymesh/stripe` package and remove the `paymesh/stripe` subpath export from the core package.

  Export provider-authoring helpers from `paymesh` root so external provider packages can be implemented without importing private core files.

### Minor Changes

- fcb6365: Add the official Paymesh MCP package with client/provider introspection tools, database-backed customer lookup by email and external id, and the corresponding docs page for installation and usage.

### Patch Changes

- a55bd12: Add a first-party in-memory database adapter with strict validation, seeding, CLI awareness, and documentation updates.
