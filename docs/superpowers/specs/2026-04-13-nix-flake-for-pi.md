# Nix flake for nollepi

## Goal
Add a Nix flake to this repository that provides:

- a reproducible package containing the repo’s current Pi extensions
- a runnable app that launches the upstream `pi` package with those extensions
- a development shell for hacking on the extensions and running the existing Node-based tests

The packaged app must be reproducible from the flake source and lock file alone. It should not depend on a pre-downloaded checkout at runtime.

## Non-goals

- Reworking the extension implementation itself
- Adding extra tooling beyond a minimal dev shell
- Building a custom Pi binary from source

## Design

### Inputs
The flake will pin:

- `nixpkgs`
- `llm-agents.nix`

The upstream `pi` package will come from `llm-agents.nix`.

### Package
The flake will expose a default package that contains the files Pi needs to load this repo as a package:

- `package.json`
- `extensions/`

The package source will be taken from the flake’s own repository contents (`src = ./.` or an equivalent filtered source expression). The package should be filtered so that only runtime-relevant files are included, keeping the output stable and minimal.

### App
The flake will expose a default app that runs upstream `pi` and points it at the packaged repository contents by setting `PI_PACKAGE_DIR` to the built package output.

This ensures `nix run .` starts Pi with the exact extensions in the flake input, regardless of the caller’s working tree.

### Dev shell
The flake will expose a default dev shell with the tools needed to work on this repo’s JavaScript/TypeScript code. It should be minimal and include at least Node.js and npm-compatible tooling so the existing test script can be run locally.

## Expected user experience

- `nix build` builds the reproducible package with the current extensions
- `nix run` starts Pi using that package
- `nix develop` opens a shell suitable for extension development and testing

## Validation

The implementation is considered done when:

- the flake evaluates successfully
- `nix build` succeeds for the package
- `nix run` launches Pi via the flake app wrapper
- `nix develop` provides a usable shell for repo hacking

## Risks / notes

- The exact wiring for the upstream Pi runtime may require a wrapper that sets `PI_PACKAGE_DIR` explicitly.
- The dev shell should avoid unnecessary custom behavior so it remains predictable and easy to maintain.
