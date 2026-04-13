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

Prefix entries are literal command prefixes. If `pnpm run test` is saved as a prefix, any command starting with `pnpm run test` runs without prompting.

When you choose "Always allow prefix", the UI lets you pick how much of the command to save, such as `pnpm`, `pnpm run`, or `pnpm run test`.

Redirection targets like `>` and `>>` are checked with the path-guard allowlist before the command runs.

## Adding extensions

Drop additional `.ts` files or extension directories into `extensions/` and reload pi.
