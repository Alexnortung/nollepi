# Pi Coding Agent Config

This repository is my personal [pi](https://pi.dev) package for coding agent configuration.

## What’s in here

- `package.json` — marks this repo as a pi package
- `extensions/path-guard.ts` — prompts before file access outside the current working directory

## Install on a new machine

1. Install pi if you have not already:

   ```bash
   npm install -g @mariozechner/pi-coding-agent
   ```

2. Install this package from git:

   ```bash
   pi install git:github.com/Alexnortung/nollepi
   ```

3. Start or reload pi.

## Nix flake

This repo also ships a flake.

- `nix build` builds a reproducible Pi package directory from the tracked files in this repo.
- `nix run` launches upstream Pi with that packaged directory.
- `nix develop` opens a shell with Node tooling for hacking on the extensions.

## Path guard allowlist

The extension stores its persistent allowlist here:

```bash
~/.pi/agent/path-guard-allowlist.json
```

It records exact files and directories that you chose to trust.

When you choose **Always allow this directory**, path guard asks which directory to trust. It offers the nearest directory first, then each parent directory upward, excluding `/`.

## Bash command guard allowlist

The bash command guard extension intercepts `bash` tool calls and asks before execution.
It stores three kinds of allowlist entries:

- `exact`
- `prefix`
- `template`

Multi-segment commands are evaluated per top-level segment, such as `cd folder`, `pnpm install`, and `pnpm build` in `cd folder && pnpm install && pnpm build`.
If every segment is already allowlisted, the full command runs without prompting.
If only some segments are missing from the allowlist, the guard prompts only for those missing segments, in order.

Prefix entries are literal command prefixes. If `pnpm run test` is saved as a prefix, any command starting with `pnpm run test` runs without prompting.
When you choose "Always allow prefix", the UI lets you pick how much of the current segment to save, such as `pnpm`, `pnpm run`, or `pnpm run test`.
Exact-command approvals are also saved for the selected segment only, not the whole multi-segment command.

Redirection targets like `>` and `>>` are checked per segment against the path-guard allowlist.
If a redirection target is already path-allowlisted, it does not prompt.
If not, the bash guard reuses the path-guard approval prompt for that target after the segment's command approval succeeds.

## Adding extensions

Drop additional `.ts` files or extension directories into `extensions/` and reload pi.
