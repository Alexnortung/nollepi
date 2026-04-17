# Orchestrators and Subagents

## Purpose

The workflow system should separate **workflow ownership** from **task-scoped collaboration** when that improves context control.

In `alignment`, this means using:

- a **high-level orchestrator** that owns workflow state, transitions, approvals, and task planning
- a **task orchestrator** that is spawned for one task at a time and collaborates with the human only on that task
- ephemeral specialist subagents that support execution behind the task orchestrator

This keeps the top-level context compact while still allowing deep task-level alignment and execution.

## Role Model

### High-level orchestrator

The high-level orchestrator is the long-lived owner of the workflow run.

It is responsible for:

- managing the active workflow
- tracking workflow state
- driving high-level mental alignment
- creating and refining the task list
- requesting task-list approval
- selecting the current task
- owning workflow transitions
- protecting human edits and user decisions
- retaining a compact high-level understanding of completed task outcomes

The high-level orchestrator should understand:

- the high-level objective
- approved task boundaries
- what each completed task developed at a summary level
- information from prior tasks that may matter to the human or later tasks

It should avoid carrying unnecessary low-level implementation detail for every task.

### Task orchestrator

The task orchestrator is an ephemeral, task-scoped collaborator.

For `alignment`, it should be a literal spawned interactive subagent session when the system supports that behavior.

It is responsible for:

- chatting with the human during task alignment for one task
- keeping context limited to what is relevant for that task
- directly dispatching specialist subagents for that task
- synthesizing specialist findings for the human
- explaining task changes and handling task execution follow-up
- returning a compact task outcome summary to the high-level orchestrator

The task orchestrator does **not** own:

- workflow state
- workflow transitions
- task-list approval
- global planning across the full run

## Visible Model

In `alignment`, the human should interact with different collaborators at different layers:

- the **high-level orchestrator** for intake, high-level alignment, task proposal, task-list alignment, and task-list approval
- the **task orchestrator** for the current task’s alignment and task execution follow-up

This is intentionally a two-orchestrator model.

The high-level orchestrator remains the owner of the workflow run, while the task orchestrator is the focused collaborator for one task.

## Specialist Subagent Roles

Start with three ephemeral specialist roles:

1. **investigator**
   - gathers information about the codebase, domain language, risks, or relevant files
   - helps the task orchestrator resolve repo uncertainty before or during task execution

2. **builder**
   - implements a single sufficiently aligned task or step
   - receives a task packet from the task orchestrator containing aligned intent, constraints, and relevant findings
   - works in the same worktree as the orchestrator system, but does not own workflow state

3. **reviewer**
   - reviews task work after implementation exists
   - checks implementation against the task description, aligned constraints, and expected quality bar

These specialist subagents should be temporary and narrowly scoped.

## Ownership Boundaries

### High-level orchestrator owns

- workflow state
- workflow transitions
- high-level mental alignment
- task-list creation and refinement
- task-list approval handling
- current-task selection
- run-level approvals and progression
- retained summaries of what each task produced
- integration of completed task outcomes into the overall run

### Task orchestrator owns

- task-level mental alignment for the active task
- direct human conversation for that task
- specialist dispatch decisions for that task
- integration of investigator, builder, and reviewer results for that task
- explanation of task-level changes and follow-up with the human

### Specialist subagents own

- focused repo investigation
- focused implementation
- focused review

Specialist subagents do not negotiate alignment or workflow progression directly with the human.

- the **investigator** informs the task orchestrator
- the **builder** implements what the task orchestrator has already aligned strongly enough to build
- the **reviewer** evaluates what was built and reports back to the task orchestrator

## Why the Two-Orchestrator Model

This model is intended to:

- reduce high-level orchestrator context growth across long runs
- keep task-level alignment sharply focused
- make specialist dispatch feel local to the task being discussed
- preserve clear workflow ownership while allowing deeper task collaboration

The high-level orchestrator stays concise and strategic.

The task orchestrator goes deep only where needed.

## Workflow-Specific Use

### Alignment

The high-level orchestrator should:

- lead intake and high-level alignment
- propose and refine tasks
- obtain task-list approval
- hand the active task to a task orchestrator
- retain a compact summary of what each finished task changed
- decide workflow progression after task completion

The task orchestrator should:

- lead task-level alignment
- dispatch investigators when repo facts are missing for the task
- dispatch builders only after the task is aligned strongly enough to implement
- dispatch reviewers after implementation exists and before task completion is accepted
- handle task execution follow-up with the human

### Autonomous

In `autonomous`, the system may remain closer to a single orchestrator model.

The orchestrator should:

- handle intake and lighter high-level alignment
- coordinate planning and execution
- use subagents for investigation, implementation, and review as needed
- progress the workflow more independently

## Context Packets

Each handoff or dispatch should be built from an owned context packet rather than freeform chat alone.

### High-level orchestrator → task orchestrator

The task orchestrator should receive only the context relevant to the active task, including:

- active workflow and workflow state
- run id
- current task id, summary, description, and status
- approved high-level objective, scope, constraints, and approach relevant to the task
- relevant domain language
- relevant outcomes from earlier tasks
- a compact record of what prior tasks changed when that matters to the task

### Task orchestrator → specialist subagents

Every specialist subagent should receive:

- active workflow and workflow state
- run id
- current task id, summary, description, and status
- current step id, summary, and status when present
- dispatch goal
- hard constraints excerpt
- explicit success target for the dispatch
- relevant prior findings

The task orchestrator should construct these packets from the task-scoped context it owns.

## Specialist Dispatch Guidance

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

The builder should not receive broad unresolved alignment by default. If unresolved alignment would materially change implementation, the task orchestrator should continue alignment or dispatch an investigator instead of a builder.

### Reviewer packet

The reviewer should receive:

- current task or step context
- agreed task intent and constraints
- relevant investigator findings when useful
- builder result summary
- changed files, commits, and verification outputs when available
- an explicit review goal: correctness, constraint compliance, risk check, and verification gaps

## Dispatch Lifecycle

In `alignment`, a typical task flow should be:

1. the high-level orchestrator selects the next approved task
2. the high-level orchestrator builds the task handoff packet
3. the extension starts a task orchestrator session
4. the human collaborates with the task orchestrator for task alignment and task follow-up
5. the task orchestrator dispatches specialist subagents as needed
6. specialist subagents return structured results to the task orchestrator
7. the task orchestrator returns a compact task outcome summary upward
8. the high-level orchestrator integrates that summary and decides the next workflow step

## Execution Surfaces

The task orchestrator is interactive and human-facing for one task.

Specialist subagents are background helpers.

The UI should make it easy to distinguish:

- the long-lived high-level workflow owner
- the current task orchestrator session
- specialist background subagents working under that task orchestrator

## Concurrency Rules

In `alignment`, allow at most:

- one active task orchestrator session
- one investigator
- one builder
- one reviewer

The high-level orchestrator is not counted as a subagent.

Because the builder works in the same worktree, the system should not run multiple builders concurrently.

Investigators and reviewers should remain read-mostly and may overlap with each other when useful.

### Superpowers

For v1, `superpowers` remains intentionally simpler and does not deeply adopt this two-orchestrator model.