# Superpowers Workflow

## Purpose

`superpowers` is the lightweight Superpowers overlay.

Its main goal is to let the user work as if Superpowers were installed, without making Superpowers the permanent default workflow.

## Behavior

When the user enters `superpowers`:

- keep Base active
- load Superpowers skills and instructions
- provide lightweight workflow/process visibility in the sidebar

For v1, `superpowers` should stay simple.

It is **not** intended to deeply adopt the custom orchestrator/task system used by `alignment` and `autonomous`.

## Scope in v1

The initial implementation should focus on:

- loading Superpowers
- showing enough process state to orient the user
- avoiding extra complexity

It should not attempt to fully merge Superpowers into the custom task and approval model.

## Relationship to Base

`superpowers` always runs on top of Base.

It should not unload Base skills.

## State Machine

`superpowers` should have its own explicit state machine, even if it stays relatively small.

The exact state names can be finalized during implementation, but the sidebar should orient the user around the active Superpowers process stage.

Examples of stage concepts that may appear:

- idle
- design/spec
- planning
- implementing
- reviewing
- finishing

## Safety

`superpowers` uses the normal safety model unless explicitly changed later.

For v1, no special sandbox or guard override model is required.

## Sidebar

The sidebar should be adaptive and mostly read-only.

In `superpowers`, it should focus on orientation:

- active workflow: `superpowers`
- current workflow state
- current process stage
- any important next gate or milestone

The sidebar does not need to expose the richer task/alignment inspection model required by `alignment`.
