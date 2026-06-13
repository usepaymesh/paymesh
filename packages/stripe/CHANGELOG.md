# @paymesh/stripe

## 1.0.0

### Minor Changes

- 81f3825: Split the Stripe provider into a dedicated `@paymesh/stripe` package and remove the `paymesh/stripe` subpath export from the core package.

  Export provider-authoring helpers from `paymesh` root so external provider packages can be implemented without importing private core files.

### Patch Changes

- Updated dependencies [fcb6365]
- Updated dependencies [81f3825]
- Updated dependencies [a55bd12]
  - paymesh@1.0.0
