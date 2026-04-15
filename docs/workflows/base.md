# Base Workflow

## Purpose

`base` is the lightweight default workflow.

It should support normal chat-and-do-work behavior with minimal ceremony while keeping the user’s trusted general-purpose skills active.

## Behavior

Base is intentionally simple:

- chat
- inspect code
- edit files
- run commands
- use the user’s non-Superpowers general-purpose skills

Base should not impose the heavier orchestration rules used by `alignment` or `autonomous`.

## Relationship to Other Workflows

Base acts as the foundation for the other workflows.

When another workflow is activated:

- Base remains active
- the other workflow is treated as an overlay on top of Base

When switching between non-Base workflows:

- unload the previous overlay
- keep Base active
- load the next overlay

## State Machine

Base may have only a minimal visible state machine in v1.

Possible states are intentionally simple, for example:

- idle
- chatting
- executing

The exact Base state machine is less important than the more structured workflows.

## Safety

Base uses the normal safety setup for this pi environment, including existing command and path guard behavior.

## Sidebar

Base likely needs only minimal sidebar support in v1.

The sidebar may show:

- active workflow: `base`
- current activity

No richer orchestration UI is required for the initial version.
