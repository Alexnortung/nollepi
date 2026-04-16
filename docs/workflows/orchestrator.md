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

Start with three ephemeral specialist roles:

1. **investigator**
   - gathers information about the codebase, domain language, risks, or relevant files
   - helps the orchestrator understand uncertainty before asking the human focused questions
   - is especially useful during mental alignment when repo facts are missing

2. **builder**
   - implements a single sufficiently aligned task or step
   - receives a task packet from the orchestrator containing aligned intent, constraints, and relevant findings
   - works in the same worktree as the orchestrator, but does not own workflow state or human communication

3. **reviewer**
   - reviews task work after implementation exists
   - checks implementation against the task description, aligned constraints, and expected quality bar

These subagents should be temporary and narrowly scoped.

## Ownership Boundaries

The orchestrator remains the only visible long-lived collaborator.

The orchestrator owns:

- workflow state
- workflow transitions
- mental alignment with the human
- task and step lifecycle
- dispatch decisions
- integration of subagent findings and results
- approvals and review surfaces

Subagents do not negotiate alignment or workflow progression directly with the human.

- the **investigator** informs the orchestrator
- the **builder** implements what the orchestrator has already aligned strongly enough to build
- the **reviewer** evaluates what was built and reports back to the orchestrator

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
- dispatch investigators when deeper codebase understanding is needed during alignment or execution
- dispatch builders only after the task is aligned strongly enough to implement
- dispatch reviewers after implementation exists and before the human review surface

### Autonomous

The orchestrator should:

- handle intake and lighter high-level alignment
- coordinate planning and execution
- use subagents for investigation, implementation, and review as needed
- progress the workflow more independently

## Dispatch Context Packets

Each dispatch should be built from an orchestrator-owned context packet rather than freeform chat alone.

### Common fields

Every subagent should receive:

- active workflow and workflow state
- run id
- current task id, summary, description, and status
- current step id, summary, and status when present
- dispatch goal
- hard constraints excerpt
- explicit success target for the dispatch
- relevant prior findings

### Investigator packet

The investigator should receive:

- current task or step context
- agreed objective, scope, constraints, and approach excerpts
- unresolved repo-facing questions only
- risks or open questions that require evidence from the codebase
- an explicit output shape: findings, relevant files, risks, and suggested next action

### Builder packet

The builder should receive:

- current task or step context
- implementation-relevant aligned context
  - objective
  - scope
  - constraints
  - approach
  - relevant domain language
- relevant investigator findings
- explicit build goal
- explicit done criteria
- an explicit instruction that the builder does not negotiate with the human

The builder should not receive broad unresolved alignment by default. If unresolved alignment would materially change implementation, the orchestrator should continue alignment or dispatch an investigator instead of a builder.

### Reviewer packet

The reviewer should receive:

- current task or step context
- agreed task intent and constraints
- relevant investigator findings when useful
- builder result summary
- changed files, commits, and verification outputs when available
- an explicit review goal: correctness, constraint compliance, risk check, and verification gaps

## Dispatch Lifecycle

1. the orchestrator decides the role and dispatch goal
2. the orchestrator builds the dispatch packet
3. the extension starts a background subagent process
4. the UI shows live running state in a widget
5. the subagent returns a structured result
6. the extension queues an internal orchestration result message
7. if the active workflow is `alignment` or `autonomous` and the orchestrator is idle, the extension may trigger a follow-up turn automatically
8. the orchestrator integrates the result and decides the next workflow step

## Background Execution Model

In v1, subagents should run in the background with a live widget surface.

The widget should make it easy to see:

- role
- running, done, or error state
- elapsed time
- a short task preview

Subagent output is ephemeral in v1.

- results should be delivered through runtime/session state and messages
- no markdown artifact is required for subagent logs or reports
- on reload or resume, finished results already in the session remain available, but in-flight subagents may be treated as gone

## Concurrency Rules

In v1, allow at most one background subagent of each specialist role:

- one investigator
- one builder
- one reviewer

The orchestrator itself is not counted as a subagent.

Because the builder works in the same worktree, the system should not run multiple builders concurrently.

Investigators and reviewers should remain read-mostly and may overlap with each other when useful.

### Superpowers

For v1, the orchestrator role is minimal because the workflow is intentionally kept simple.
