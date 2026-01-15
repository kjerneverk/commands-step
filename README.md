# @riotprompt/riotplan-commands-step

Step management commands for RiotPlan CLI.

## Installation

```bash
npm install @riotprompt/riotplan-commands-step
```

## Commands

- `step list [path]` - List all steps
- `step add <title> [path]` - Add a new step  
- `step remove <number> [path]` - Remove a step
- `step start <number> [path]` - Mark step as in progress
- `step complete <number> [path]` - Mark step as completed
- `step block <number> <reason> [path]` - Mark step as blocked
- `step unblock <number> [path]` - Unblock a step
- `step skip <number> [path]` - Skip a step

## License

Apache-2.0
