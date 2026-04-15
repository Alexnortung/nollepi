# Workflow System Overview

## Goal

Build a workflow control plane for pi that lets the user switch between a small set of named workflows while keeping a stable Base runtime.

This system is not only about loading skills. It also controls runtime state, orchestration behavior, workflow-specific UI, safety policy, task state, and approval gates.

## Named Workflows

The user-facing workflows are:

- `base`
- `superpowers`
- `alignment`
- `autonomous`

These are named workflows only. The user should not compose arbitrary combinations of modes in the UI.

## Runtime Model

The system has three conceptual layers:

1. **Base runtime**
   - Always active
   - Contains the user’s lightweight default behavior and trusted general-purpose skills

2. **Workflow overlay**
   - Exactly one named workflow overlay is active at a time
   - Switching workflows unloads the previous workflow overlay and loads the next one
   - Base remains active when overlays change

3. **Shared execution primitives**
   - Reusable state, helpers, and UI building blocks shared by multiple workflows
   - Examples: task model, sidebar primitives, worktree helpers, approval tracking, persistence, and subagent dispatch helpers

## Persistence

Workflow-specific state should persist across:

- `/reload`
- session resume

This includes workflow progress, task state, alignment state, and other workflow-owned source-of-truth artifacts.

## Workflow Switching

For v1, workflow switching is intentionally restrictive.

The user may only switch workflows when the current workflow is done.

This avoids partial-state transitions and simplifies implementation.

### Completion model

- `base` is effectively lightweight and not treated as a long-running structured workflow
- `superpowers` is done when its active structured process is finished or when no structured process is active
- `alignment` is done only after reaching an explicit wrap-up/finish state
- `autonomous` is done only after its full execution flow is complete

## Shared Principles

Across workflows, the system should preserve these principles:

- the human is the final authority
- human concerns must be taken seriously and investigated
- human manual edits are protected by default
- the agent may question a human edit, but if the human insists, the agent must not change it
- source-of-truth workflow artifacts should be kept current as understanding evolves

## Source-of-Truth Artifacts

The workflow system should maintain structured artifacts that are more authoritative than transient chat phrasing.

These artifacts include:

- mental alignment categories and parts
- task lists
- task descriptions and summaries
- step descriptions and summaries
- approval status
- workflow state
- live workflow/task/step markdown files

These artifacts should be detailed enough that a fresh agent can pick up a task or step and proceed without depending on the full prior conversation.

## Implementation note

The first implementation lives in `extensions/workflows/` and derives durable workflow state from markdown workflow artifacts. Any session persistence is limited to derived UI/session convenience state.

## Live Workflow Artifact Storage

Active workflow run artifacts should live under:

```text
docs/.workflows/runs/
```

This path is intentionally separate from the design docs in `docs/workflows/`.

The design docs describe the system.
The files under `docs/.workflows/runs/` represent the current operational source of truth for active workflow runs.
