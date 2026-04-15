# Orchestrator and Subagents

## Purpose

The workflow system should present a single visible orchestrator to the human.

The orchestrator owns workflow state, transitions, approvals, and delegation.

This keeps the UX simple while still allowing multiple agents to contribute internally.

## Visible Model

The human should primarily interact with one orchestrator.

The orchestrator is responsible for:

- managing the active workflow
- tracking workflow state
- driving mental alignment
- creating and refining the task list
- requesting approvals
- integrating subagent findings
- protecting human edits and user decisions
- controlling transitions between workflow states

## v1 Delegation Model

For v1, subagent dispatch should be orchestrator-controlled.

The human does not need to directly request or manage subagent roles.

The orchestrator may still explain when and why it dispatched a subagent.

## v1 Subagent Roles

Start with two ephemeral specialist roles:

1. **investigator**
   - gathers information about the codebase, domain language, risks, or relevant files
   - helps the orchestrator understand uncertainty before asking the human focused questions

2. **reviewer**
   - reviews task work before the human review surface
   - checks implementation against the task description and expected quality bar

These subagents should be temporary and narrowly scoped.

## Why a Single Visible Orchestrator

A single visible orchestrator avoids:

- overlapping responsibilities
- confusing UX
- unclear ownership of the workflow state
- noisy multi-agent presentation to the human

The orchestrator remains the stable collaborator, while subagents provide focused help behind the scenes.

## Workflow-Specific Use

### Alignment

The orchestrator should:

- lead high-level and task-level alignment
- propose and refine tasks
- dispatch investigators when deeper codebase understanding is needed
- dispatch reviewers before human review

### Autonomous

The orchestrator should:

- handle intake and lighter high-level alignment
- coordinate planning and execution
- use subagents for investigation and review as needed
- progress the workflow more independently

### Superpowers

For v1, the orchestrator role is minimal because the workflow is intentionally kept simple.
