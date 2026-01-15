import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerStepCommands, getStatusIcon, outputStepList } from '../src/index';

// Mock chalk
vi.mock('chalk', () => ({
    default: {
        green: (s: string) => s,
        red: (s: string) => s,
        yellow: (s: string) => s,
        blue: (s: string) => s,
        dim: (s: string) => s,
        bold: (s: string) => s,
    }
}));

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
    writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock riotplan
const mockLoadPlan = vi.fn();
const mockInsertStep = vi.fn();
const mockRemoveStep = vi.fn();
const mockStartStep = vi.fn();
const mockCompleteStep = vi.fn();
const mockBlockStep = vi.fn();
const mockUnblockStep = vi.fn();
const mockSkipStep = vi.fn();
const mockUpdateStatus = vi.fn();
const mockGenerateStatus = vi.fn();

vi.mock('@riotprompt/riotplan', () => ({
    loadPlan: (...args: unknown[]) => mockLoadPlan(...args),
    insertStep: (...args: unknown[]) => mockInsertStep(...args),
    removeStep: (...args: unknown[]) => mockRemoveStep(...args),
    startStep: (...args: unknown[]) => mockStartStep(...args),
    completeStep: (...args: unknown[]) => mockCompleteStep(...args),
    blockStep: (...args: unknown[]) => mockBlockStep(...args),
    unblockStep: (...args: unknown[]) => mockUnblockStep(...args),
    skipStep: (...args: unknown[]) => mockSkipStep(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
    generateStatus: (...args: unknown[]) => mockGenerateStatus(...args),
}));

describe('commands-step', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    const mockPlan = {
        metadata: { name: 'Test Plan', code: 'test-plan', path: '/test' },
        state: { status: 'in_progress' },
        steps: [
            { number: 1, title: 'Step 1', status: 'completed' },
            { number: 2, title: 'Step 2', status: 'in_progress' },
            { number: 3, title: 'Step 3', status: 'pending' },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(process, 'exit').mockImplementation((() => {
            throw new Error('process.exit called');
        }) as never);
        
        mockLoadPlan.mockResolvedValue(mockPlan);
        mockInsertStep.mockResolvedValue({
            step: { number: 4, title: 'New Step' },
            createdFile: 'plan/04-new-step.md',
            renamedFiles: [],
        });
        mockRemoveStep.mockResolvedValue({
            removedStep: { number: 2, title: 'Step 2' },
            deletedFile: 'plan/02-step-2.md',
            renamedFiles: [],
        });
        mockStartStep.mockReturnValue({ number: 2, title: 'Step 2' });
        mockCompleteStep.mockReturnValue({ number: 2, title: 'Step 2' });
        mockBlockStep.mockReturnValue({ number: 2, title: 'Step 2' });
        mockUnblockStep.mockReturnValue({ number: 2, title: 'Step 2' });
        mockSkipStep.mockReturnValue({ number: 2, title: 'Step 2' });
        mockUpdateStatus.mockReturnValue(mockPlan);
        mockGenerateStatus.mockReturnValue('# Status');
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        vi.restoreAllMocks();
    });

    describe('getStatusIcon', () => {
        it('should return correct icons', () => {
            expect(getStatusIcon('pending')).toBe('⬜');
            expect(getStatusIcon('in_progress')).toBe('🔄');
            expect(getStatusIcon('completed')).toBe('✅');
            expect(getStatusIcon('blocked')).toBe('⏸️');
            expect(getStatusIcon('skipped')).toBe('⏭️');
            expect(getStatusIcon('failed')).toBe('❌');
            expect(getStatusIcon('unknown')).toBe('⬜');
        });
    });

    describe('outputStepList', () => {
        it('should output steps with icons', () => {
            outputStepList(mockPlan.steps as any);
            expect(consoleSpy).toHaveBeenCalledTimes(3);
        });
    });

    describe('registerStepCommands', () => {
        it('should register step command group', () => {
            const program = new Command();
            registerStepCommands(program);
            
            const stepCmd = program.commands.find(cmd => cmd.name() === 'step');
            expect(stepCmd).toBeDefined();
        });

        it('step list should show steps', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'list']);
            expect(mockLoadPlan).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('step list --pending should filter steps', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'list', '--pending']);
            expect(mockLoadPlan).toHaveBeenCalled();
        });

        it('step list --completed should filter steps', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'list', '--completed']);
            expect(mockLoadPlan).toHaveBeenCalled();
        });

        it('step list should handle errors', async () => {
            mockLoadPlan.mockRejectedValue(new Error('Load failed'));
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await expect(program.parseAsync(['node', 'test', 'step', 'list']))
                .rejects.toThrow('process.exit called');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to list steps'));
        });

        it('step add should create step', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'add', 'New Step']);
            expect(mockLoadPlan).toHaveBeenCalled();
            expect(mockInsertStep).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Added step'));
        });

        it('step add with renames should show count', async () => {
            mockInsertStep.mockResolvedValue({
                step: { number: 2, title: 'New Step' },
                createdFile: 'plan/02-new-step.md',
                renamedFiles: ['f1', 'f2'],
            });
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'add', 'New Step', '--position', '2']);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Renumbered'));
        });

        it('step add should handle errors', async () => {
            mockInsertStep.mockRejectedValue(new Error('Insert failed'));
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await expect(program.parseAsync(['node', 'test', 'step', 'add', 'New Step']))
                .rejects.toThrow('process.exit called');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to add step'));
        });

        it('step remove without --force should warn', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await expect(program.parseAsync(['node', 'test', 'step', 'remove', '2']))
                .rejects.toThrow('process.exit called');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Will remove'));
        });

        it('step remove --force should remove step', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'remove', '2', '--force']);
            expect(mockRemoveStep).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Removed step'));
        });

        it('step remove with renames should show count', async () => {
            mockRemoveStep.mockResolvedValue({
                removedStep: { number: 2, title: 'Step 2' },
                deletedFile: 'plan/02-step-2.md',
                renamedFiles: ['f1', 'f2'],
            });
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'remove', '2', '--force']);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Renumbered'));
        });

        it('step remove non-existent step should error', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await expect(program.parseAsync(['node', 'test', 'step', 'remove', '99']))
                .rejects.toThrow('process.exit called');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Step 99 not found'));
        });

        it('step remove should handle errors', async () => {
            mockRemoveStep.mockRejectedValue(new Error('Remove failed'));
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await expect(program.parseAsync(['node', 'test', 'step', 'remove', '2', '--force']))
                .rejects.toThrow('process.exit called');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to remove step'));
        });

        it('step start should update status', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'start', '2']);
            expect(mockStartStep).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Started step'));
        });

        it('step start should handle errors', async () => {
            mockStartStep.mockImplementation(() => { throw new Error('Start failed'); });
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await expect(program.parseAsync(['node', 'test', 'step', 'start', '2']))
                .rejects.toThrow('process.exit called');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to start step'));
        });

        it('step complete should mark complete', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'complete', '2']);
            expect(mockCompleteStep).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Completed step'));
        });

        it('step complete should handle errors', async () => {
            mockCompleteStep.mockImplementation(() => { throw new Error('Complete failed'); });
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await expect(program.parseAsync(['node', 'test', 'step', 'complete', '2']))
                .rejects.toThrow('process.exit called');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to complete step'));
        });

        it('step block should mark blocked', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'block', '2', 'Test reason']);
            expect(mockBlockStep).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Blocked step'));
        });

        it('step block should handle errors', async () => {
            mockBlockStep.mockImplementation(() => { throw new Error('Block failed'); });
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await expect(program.parseAsync(['node', 'test', 'step', 'block', '2', 'reason']))
                .rejects.toThrow('process.exit called');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to block step'));
        });

        it('step unblock should unblock', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'unblock', '2']);
            expect(mockUnblockStep).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unblocked step'));
        });

        it('step unblock should handle errors', async () => {
            mockUnblockStep.mockImplementation(() => { throw new Error('Unblock failed'); });
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await expect(program.parseAsync(['node', 'test', 'step', 'unblock', '2']))
                .rejects.toThrow('process.exit called');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to unblock step'));
        });

        it('step skip should skip step', async () => {
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await program.parseAsync(['node', 'test', 'step', 'skip', '2']);
            expect(mockSkipStep).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipped step'));
        });

        it('step skip should handle errors', async () => {
            mockSkipStep.mockImplementation(() => { throw new Error('Skip failed'); });
            const program = new Command();
            program.exitOverride();
            registerStepCommands(program);
            
            await expect(program.parseAsync(['node', 'test', 'step', 'skip', '2']))
                .rejects.toThrow('process.exit called');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to skip step'));
        });
    });
});
