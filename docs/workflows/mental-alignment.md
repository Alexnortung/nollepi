# Mental Alignment Protocol

## Purpose

Mental alignment is the process of aligning the human’s and agent’s mental models.

It is not just a workflow. It is a reusable protocol that can appear:

- at a high level before work begins
- at the task level before execution
- during execution when new ambiguity or risk appears

## Core Rules

- do not repeat parts that are already aligned
- each part only becomes aligned when the human explicitly confirms it
- the human may say a part is not aligned
- the human may say a part is not relevant
- the human may say "just go" when additional alignment is unnecessary for the current task

## Purpose of the Protocol

Mental alignment exists to make sure both sides understand:

- the needs
- the constraints
- the risks
- the domain concepts
- the intended direction of the work

If the human raises a risk, the agent must take it seriously.

The agent should:

1. assess whether the concern is actually a problem
2. do the extra investigation needed to understand it
3. steer toward a solution that eliminates the risk when the risk is real
4. explain clearly when it believes something is not actually a risk
5. continue trying to explain if the human still sees risk
6. yield if the human insists that the work must be done a certain way

## Data Model

Mental alignment uses a hybrid model:

### Fixed category skeleton

A default visible set of categories exists at the start.

Representative categories include:

- objective
- scope
- constraints
- risks
- domain language / ubiquitous language
- approach
- open questions

Categories can be marked not relevant.

### Freeform parts inside categories

Within each category, the orchestrator can create concrete parts that matter for the current work.

Examples:

- a naming decision
- a specific risk
- a task boundary question
- a domain-language clarification
- an approach choice

## Part States

Each part can be in a state such as:

- unaligned
- under discussion
- aligned
- skipped / just go
- not relevant

A part is only aligned after explicit human confirmation.

## Summaries and Source of Truth

Alignment parts should contain summaries of what was agreed and the important details discussed.

These summaries are part of the source of truth for later work.

Mental alignment should update and verify these summaries over time.

## Human Verification Pattern

For each meaningful part, the agent should ask a question that lets the human confirm or deny that the part is aligned.

This gives the human a clear checkpoint instead of assuming agreement.

## Workflow-Specific Depth

### In `alignment`

Mental alignment is deep and central to the workflow.

It happens:

- at the high level
- during task-list formation
- before tasks, unless the human says "just go"
- whenever new ambiguity or risk appears

### In `autonomous`

Mental alignment still exists, but it is lighter and more high-level.

The workflow should investigate uncertainty aggressively and proceed more independently.

### In `superpowers`

Mental alignment is not the main custom protocol for v1.

### In `base`

Mental alignment is not a required formal process.
