---
"paymesh": major
"@paymesh/stripe": minor
---

Split the Stripe provider into a dedicated `@paymesh/stripe` package and remove the `paymesh/stripe` subpath export from the core package.

Export provider-authoring helpers from `paymesh` root so external provider packages can be implemented without importing private core files.
