/**
 * @kjerneverk/riotplan-commands-step
 * 
 * Step management commands for RiotPlan CLI
 */

import { Command } from "commander";
import chalk from "chalk";
import {
    loadPlan,
    insertStep,
    removeStep,
    startStep,
    completeStep,
    blockStep,
    unblockStep,
    skipStep,
    updateStatus,
    generateStatus,
} from "@kjerneverk/riotplan";
import type { PlanStep } from "@kjerneverk/riotplan";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Get status icon for a given status
 */
export function getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
        pending: "⬜",
        in_progress: "🔄",
        completed: "✅",
        failed: "❌",
        blocked: "⏸️",
        skipped: "⏭️",
    };
    return icons[status] || "⬜";
}

/**
 * Output step list
 */
export function outputStepList(steps: PlanStep[]): void {
    for (const step of steps) {
        const icon = getStatusIcon(step.status);
        // eslint-disable-next-line no-console
        console.log(`  ${icon} ${String(step.number).padStart(2, "0")}. ${step.title}`);
    }
}

/**
 * Register step commands on the program
 */
export function registerStepCommands(program: Command): void {
    const stepCmd = program
        .command("step")
        .description("Step management commands");

    // List steps
    stepCmd
        .command("list")
        .description("List all steps")
        .argument("[path]", "Path to plan directory", ".")
        .option("--pending", "Show only pending steps")
        .option("--completed", "Show only completed steps")
        .action(async (path, options) => {
            try {
                const plan = await loadPlan(path);
                let steps = plan.steps;

                if (options.pending) {
                    steps = steps.filter((s) => s.status === "pending");
                } else if (options.completed) {
                    steps = steps.filter((s) => s.status === "completed");
                }

                // eslint-disable-next-line no-console
                console.log();
                // eslint-disable-next-line no-console
                console.log(chalk.bold(`${plan.metadata.name} - Steps`));
                // eslint-disable-next-line no-console
                console.log();
                outputStepList(steps);
                // eslint-disable-next-line no-console
                console.log();
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(chalk.red("✗") + ` Failed to list steps: ${(error as Error).message}`);
                process.exit(1);
            }
        });

    // Add step
    stepCmd
        .command("add")
        .description("Add a new step")
        .argument("<title>", "Step title")
        .argument("[path]", "Path to plan directory", ".")
        .option("-p, --position <n>", "Position to insert at")
        .option("-a, --after <n>", "Insert after step number")
        .action(async (title, path, options) => {
            try {
                const plan = await loadPlan(path);
                const result = await insertStep(plan, {
                    title,
                    position: options.position ? parseInt(options.position) : undefined,
                    after: options.after ? parseInt(options.after) : undefined,
                });

                // eslint-disable-next-line no-console
                console.log(chalk.green("✓") + ` Added step ${result.step.number}: ${result.step.title}`);
                // eslint-disable-next-line no-console
                console.log(chalk.dim(`File: ${result.createdFile}`));

                if (result.renamedFiles.length > 0) {
                    // eslint-disable-next-line no-console
                    console.log(chalk.dim(`Renumbered ${result.renamedFiles.length} existing step(s)`));
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(chalk.red("✗") + ` Failed to add step: ${(error as Error).message}`);
                process.exit(1);
            }
        });

    // Remove step
    stepCmd
        .command("remove")
        .description("Remove a step")
        .argument("<number>", "Step number to remove")
        .argument("[path]", "Path to plan directory", ".")
        .option("-f, --force", "Skip confirmation")
        .action(async (number, path, options) => {
            try {
                const stepNum = parseInt(number);
                const plan = await loadPlan(path);
                const step = plan.steps.find((s) => s.number === stepNum);

                if (!step) {
                    // eslint-disable-next-line no-console
                    console.error(chalk.red("✗") + ` Step ${stepNum} not found`);
                    process.exit(1);
                }

                if (!options.force) {
                    // eslint-disable-next-line no-console
                    console.log(chalk.yellow(`Will remove step ${stepNum}: ${step.title}`));
                    // eslint-disable-next-line no-console
                    console.log(chalk.dim("Use --force to skip this warning"));
                    process.exit(0);
                }

                const result = await removeStep(plan, stepNum);

                // eslint-disable-next-line no-console
                console.log(chalk.green("✓") + ` Removed step ${result.removedStep.number}: ${result.removedStep.title}`);

                if (result.renamedFiles.length > 0) {
                    // eslint-disable-next-line no-console
                    console.log(chalk.dim(`Renumbered ${result.renamedFiles.length} remaining step(s)`));
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(chalk.red("✗") + ` Failed to remove step: ${(error as Error).message}`);
                process.exit(1);
            }
        });

    // Start step
    stepCmd
        .command("start")
        .description("Mark a step as in progress")
        .argument("<number>", "Step number")
        .argument("[path]", "Path to plan directory", ".")
        .action(async (number, path) => {
            try {
                const stepNum = parseInt(number);
                const plan = await loadPlan(path);
                const updatedStep = startStep(plan, stepNum);

                const updatedPlan = updateStatus(plan, {
                    step: stepNum,
                    stepStatus: "in_progress",
                });

                const statusContent = await generateStatus(updatedPlan);
                await writeFile(join(path, "STATUS.md"), statusContent);

                // eslint-disable-next-line no-console
                console.log(chalk.green("✓") + ` ${getStatusIcon("in_progress")} Started step ${stepNum}: ${updatedStep.title}`);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(chalk.red("✗") + ` Failed to start step: ${(error as Error).message}`);
                process.exit(1);
            }
        });

    // Complete step
    stepCmd
        .command("complete")
        .description("Mark a step as completed")
        .argument("<number>", "Step number")
        .argument("[path]", "Path to plan directory", ".")
        .option("-n, --notes <notes>", "Completion notes")
        .action(async (number, path, options) => {
            try {
                const stepNum = parseInt(number);
                const plan = await loadPlan(path);
                const updatedStep = await completeStep(plan, stepNum, options.notes);

                const updatedPlan = updateStatus(plan, {
                    step: stepNum,
                    stepStatus: "completed",
                });

                const statusContent = await generateStatus(updatedPlan);
                await writeFile(join(path, "STATUS.md"), statusContent);

                // eslint-disable-next-line no-console
                console.log(chalk.green("✓") + ` ${getStatusIcon("completed")} Completed step ${stepNum}: ${updatedStep.title}`);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(chalk.red("✗") + ` Failed to complete step: ${(error as Error).message}`);
                process.exit(1);
            }
        });

    // Block step
    stepCmd
        .command("block")
        .description("Mark a step as blocked")
        .argument("<number>", "Step number")
        .argument("<reason>", "Reason for blocking")
        .argument("[path]", "Path to plan directory", ".")
        .action(async (number, reason, path) => {
            try {
                const stepNum = parseInt(number);
                const plan = await loadPlan(path);
                const updatedStep = blockStep(plan, stepNum, reason);

                const updatedPlan = updateStatus(plan, {
                    step: stepNum,
                    stepStatus: "blocked",
                });

                const statusContent = await generateStatus(updatedPlan);
                await writeFile(join(path, "STATUS.md"), statusContent);

                // eslint-disable-next-line no-console
                console.log(chalk.green("✓") + ` ${getStatusIcon("blocked")} Blocked step ${stepNum}: ${updatedStep.title}`);
                // eslint-disable-next-line no-console
                console.log(chalk.dim(`Reason: ${reason}`));
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(chalk.red("✗") + ` Failed to block step: ${(error as Error).message}`);
                process.exit(1);
            }
        });

    // Unblock step
    stepCmd
        .command("unblock")
        .description("Unblock a step")
        .argument("<number>", "Step number")
        .argument("[path]", "Path to plan directory", ".")
        .action(async (number, path) => {
            try {
                const stepNum = parseInt(number);
                const plan = await loadPlan(path);
                const updatedStep = unblockStep(plan, stepNum);

                const updatedPlan = updateStatus(plan, {
                    step: stepNum,
                    stepStatus: "pending",
                });

                const statusContent = await generateStatus(updatedPlan);
                await writeFile(join(path, "STATUS.md"), statusContent);

                // eslint-disable-next-line no-console
                console.log(chalk.green("✓") + ` ${getStatusIcon("pending")} Unblocked step ${stepNum}: ${updatedStep.title}`);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(chalk.red("✗") + ` Failed to unblock step: ${(error as Error).message}`);
                process.exit(1);
            }
        });

    // Skip step
    stepCmd
        .command("skip")
        .description("Skip a step")
        .argument("<number>", "Step number")
        .argument("[path]", "Path to plan directory", ".")
        .option("-r, --reason <reason>", "Reason for skipping")
        .action(async (number, path, options) => {
            try {
                const stepNum = parseInt(number);
                const plan = await loadPlan(path);
                const updatedStep = skipStep(plan, stepNum, options.reason);

                const updatedPlan = updateStatus(plan, {
                    step: stepNum,
                    stepStatus: "skipped",
                });

                const statusContent = await generateStatus(updatedPlan);
                await writeFile(join(path, "STATUS.md"), statusContent);

                // eslint-disable-next-line no-console
                console.log(chalk.green("✓") + ` ${getStatusIcon("skipped")} Skipped step ${stepNum}: ${updatedStep.title}`);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(chalk.red("✗") + ` Failed to skip step: ${(error as Error).message}`);
                process.exit(1);
            }
        });
}
