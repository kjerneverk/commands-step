# AI Agent Guide: riotplan-commands-step

**Role**: You are an AI assistant working with `@riotprompt/riotplan-commands-step`.

**Goal**: Understand and extend step management commands for the RiotPlan CLI.

## Core Capabilities

This package provides step management commands for listing, adding, removing, and updating step statuses.

## Quick Start

```typescript
import { Command } from 'commander';
import { registerStepCommands } from '@riotprompt/riotplan-commands-step';

const program = new Command();
registerStepCommands(program);
program.parse();
```

## Links

- [RiotPlan Core](../riotplan/)
- [RiotPlan CLI](../riotplan-cli/)
