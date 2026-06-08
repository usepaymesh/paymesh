# Changesets

Run `bun run changeset` for package-facing changes.

The release flow is automated with `changesets/action`:

- merge PRs with changeset files into `main`
- GitHub opens or updates a `Version Packages` release PR
- merge that release PR to `main`
- GitHub publishes the changed packages to npm automatically

Do not create GitHub Releases manually to publish packages.
