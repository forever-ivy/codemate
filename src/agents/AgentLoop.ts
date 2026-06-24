import type { ContextBuilderService } from '../context/ContextBuilderService';
import type { RepoMapService, SelectedContext } from '../context/RepoMapService';
import type { ToolManager } from '../managers/ToolManager';
import type {
  MemoryGovernanceResult,
  MemoryGovernanceService,
} from '../memory/MemoryGovernanceService';
import type {
  MemoryRetrievalService,
  RetrievedMemorySnapshot,
} from '../memory/MemoryRetrievalService';
import type {
  ProjectInstructionService,
  ProjectInstructionSnapshot,
} from '../memory/ProjectInstructionService';
import type { ProjectMemoryService, ProjectMemorySnapshot } from '../memory/ProjectMemoryService';
import type { SessionMemoryService, SessionMemorySnapshot } from '../memory/SessionMemoryService';
import type {
  UserPreferenceMemoryService,
  UserPreferenceMemorySnapshot,
} from '../memory/UserPreferenceMemoryService';
import type { EventBus } from '../services/EventBus';
import type { ModelService } from '../services/ModelService';
import type { SessionService } from '../services/SessionService';
import type { FileHistory } from '../snapshot/FileHistory';
import type { FileChangeRecord } from '../tools/FileChangeTracker';
import type { Tool } from '../tools/base/Tool';
import type { AIResponse, Message } from '../types/index';
import {
  VerificationErrorParser,
  type VerificationIssue,
} from '../verification/VerificationErrorParser';
import type { VerificationResult, VerificationService } from '../verification/VerificationService';
import { type AgentRunIntentDecision, AgentRunIntentService } from './AgentRunIntentService';
import { AgentRunReporter } from './AgentRunReporter';
import type { AgentRuntimeEvent, AgentRuntimeLifecycle } from './AgentRuntimeEvent';
import {
  type AgentStructuredOutput,
  AgentStructuredOutputService,
} from './AgentStructuredOutputService';
import { FailureRecoveryPromptService } from './FailureRecoveryPromptService';
import { type TaskCompletionDecision, TaskCompletionService } from './TaskCompletionService';

export type AgentLoopPhase =
  | 'received'
  | 'intent'
  | 'snapshot'
  | 'context'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'repairing'
  | 'responding'
  | 'completed'
  | 'incomplete'
  | 'failed';

export interface AgentLoopEvent {
  runId: string;
  phase: AgentLoopPhase;
  description: string;
  timestamp: number;
  runtimeKind?: AgentRuntimeEvent['kind'];
  turnId?: string;
  stepId?: string;
  toolCallId?: string;
  operationId?: string;
  lifecycle?: AgentRuntimeLifecycle;
  durationMs?: number;
  error?: string;
}

export interface AgentLoopResult {
  runId: string;
  success: boolean;
  response?: AIResponse;
  verification?: VerificationResult;
  repair?: AgentRepairAttempt;
  fileChanges?: FileChangeRecord[];
  completion?: TaskCompletionDecision;
  intent?: AgentRunIntentDecision;
  failureRecoveryPrompt?: string;
  structuredOutput?: AgentStructuredOutput;
  error?: string;
}

export interface AgentRepairAttempt {
  attempted: boolean;
  response?: AIResponse;
  verification?: VerificationResult;
  issues: VerificationIssue[];
  fileChanges?: FileChangeRecord[];
  error?: string;
}

export interface AgentLoopDependencies {
  modelService: Pick<ModelService, 'chatWithTools'>;
  toolManager: ToolManager;
  sessionService: Pick<SessionService, 'addMessage'> & Partial<Pick<SessionService, 'getMessages'>>;
  eventBus: EventBus;
  fileHistory?: Pick<FileHistory, 'createSnapshot'>;
  repoMapService?: Pick<RepoMapService, 'selectForMessage'> &
    Partial<Pick<RepoMapService, 'selectForVerificationIssues'>>;
  contextBuilderService?: Pick<ContextBuilderService, 'build'>;
  memoryGovernanceService?: Pick<MemoryGovernanceService, 'apply'>;
  memoryRetrievalService?: Pick<MemoryRetrievalService, 'build'>;
  userPreferenceMemoryService?: Pick<UserPreferenceMemoryService, 'build'>;
  projectInstructionService?: Pick<ProjectInstructionService, 'build'>;
  projectMemoryService?: Pick<ProjectMemoryService, 'build'>;
  sessionMemoryService?: Pick<SessionMemoryService, 'build'>;
  verificationService?: Pick<VerificationService, 'verify'>;
}

/**
 * AgentLoop turns a user request into a structured coding-agent run.
 *
 * The loop owns task phases and orchestration. UI components submit work to it,
 * while model/tool services keep their narrower responsibilities.
 */
export class AgentLoop {
  private verificationErrorParser = new VerificationErrorParser();
  private reporter = new AgentRunReporter();
  private intentService = new AgentRunIntentService();
  private completionService = new TaskCompletionService();
  private recoveryPromptService = new FailureRecoveryPromptService();
  private structuredOutputService = new AgentStructuredOutputService();
  private activeRun?: { runId: string; abortController: AbortController };

  constructor(private deps: AgentLoopDependencies) {}

  cancelActiveRun(): boolean {
    if (!this.activeRun || this.activeRun.abortController.signal.aborted) {
      return false;
    }

    this.activeRun.abortController.abort();
    return true;
  }

  async execute(userMessage: string): Promise<AgentLoopResult> {
    const runId = `agent-run-${Date.now()}`;
    const activeRun = {
      runId,
      abortController: new AbortController(),
    };
    this.activeRun = activeRun;

    try {
      this.emitPhase(runId, 'received', 'Received user request');
      const intent = this.intentService.classify(userMessage);
      this.emitPhase(runId, 'intent', `Classified run intent: ${intent.intent}`);

      const userPreferences = await this.buildUserPreferences(runId);
      const projectInstructions = await this.buildProjectInstructions(runId);
      const projectMemory = await this.buildProjectMemory(runId);
      const retrievedMemory = this.retrieveLongTermMemory(runId, userMessage, {
        userPreferences,
        projectMemory,
      });
      const sessionMemory = this.buildSessionMemory(runId);

      const userSessionMessage: Message = {
        role: 'user',
        content: userMessage,
      };
      await this.deps.sessionService.addMessage(userSessionMessage);

      await this.createSnapshot(runId, userMessage);

      const selectedContext = this.selectContext(runId, userMessage);
      const modelMessage = this.buildModelMessage(
        userMessage,
        intent,
        selectedContext,
        sessionMemory,
        projectInstructions,
        projectMemory,
        userPreferences,
        retrievedMemory
      );

      this.emitPhase(runId, 'planning', 'Planning the coding task');
      const tools = this.getAvailableTools();
      const fileChanges = this.collectFileChanges();

      this.emitPhase(runId, 'executing', 'Executing model-guided tool calls');
      let response: AIResponse;
      try {
        response = await this.deps.modelService.chatWithTools(
          modelMessage,
          tools,
          this.deps.toolManager,
          {
            runId,
            abortSignal: activeRun.abortController.signal,
            onRuntimeEvent: (event) => this.emitRuntimeEvent(event),
            onStreamEvent: (event) => this.deps.eventBus.emit('model_stream_event', event),
          }
        );
      } finally {
        fileChanges.stop();
      }

      const verification = await this.runVerification(runId, fileChanges.changes);
      const repair = await this.repairIfNeeded(
        runId,
        userMessage,
        response,
        verification,
        tools,
        activeRun.abortController.signal
      );
      const finalVerification = repair?.verification ?? verification;
      const allFileChanges = [...fileChanges.changes, ...(repair?.fileChanges ?? [])];
      const completion = this.completionService.evaluate({
        responseContent: response.content,
        fileChanges: allFileChanges,
        verification: finalVerification,
        repairAttempted: repair?.attempted,
        repairError: repair?.error,
        intentDecision: intent,
      });
      const failureRecoveryPrompt = this.recoveryPromptService.build({
        userMessage,
        completion,
        verification: finalVerification,
        repair,
        fileChanges: allFileChanges,
      });
      const responseContent = this.reporter.build({
        responseContent: response.content,
        intent,
        completion,
        fileChanges: fileChanges.changes,
        initialVerification: verification,
        finalVerification,
        repair,
        failureRecoveryPrompt,
      });
      const structuredOutput = this.structuredOutputService.build({
        runId,
        status: completion.complete ? 'completed' : 'incomplete',
        success: completion.complete,
        assistantMessage: responseContent,
        intent,
        fileChanges: allFileChanges,
        verification: finalVerification,
        repair,
        completion,
        failureRecoveryPrompt,
        usage: response.usage,
      });

      this.emitPhase(runId, 'responding', 'Saving assistant response');
      const assistantMessage: Message = {
        role: 'assistant',
        content: responseContent,
      };
      await this.deps.sessionService.addMessage(assistantMessage);

      if (completion.complete) {
        this.emitPhase(runId, 'completed', 'Agent run completed');
      } else {
        this.emitPhase(
          runId,
          'incomplete',
          'Agent run did not meet completion conditions',
          completion.reasons.join('\n')
        );
      }

      return {
        runId,
        success: completion.complete,
        response: {
          ...response,
          content: responseContent,
        },
        verification: finalVerification,
        repair,
        fileChanges: allFileChanges,
        completion,
        intent,
        failureRecoveryPrompt,
        structuredOutput,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const structuredOutput = this.structuredOutputService.buildError({
        runId,
        error: errorMessage,
      });
      this.emitPhase(runId, 'failed', 'Agent run failed', errorMessage);

      try {
        await this.deps.sessionService.addMessage({
          role: 'assistant',
          content: `❌ Error: ${errorMessage}`,
        });
      } catch {
        // If session persistence is the failing step, avoid hiding the original error.
      }

      return {
        runId,
        success: false,
        error: errorMessage,
        structuredOutput,
      };
    } finally {
      if (this.activeRun === activeRun) {
        this.activeRun = undefined;
      }
    }
  }

  private async createSnapshot(runId: string, userMessage: string): Promise<void> {
    if (!this.deps.fileHistory) {
      return;
    }

    this.emitPhase(runId, 'snapshot', 'Creating file snapshot');
    await this.deps.fileHistory.createSnapshot(runId, `Before: ${userMessage.substring(0, 50)}`);
  }

  private getAvailableTools(): Tool[] {
    return this.deps.toolManager
      .list()
      .map((name: string) => this.deps.toolManager.get(name))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  private selectContext(runId: string, userMessage: string): SelectedContext | undefined {
    if (!this.deps.repoMapService) {
      return undefined;
    }

    this.emitPhase(runId, 'context', 'Selecting repository context');
    const selectedContext = this.deps.repoMapService.selectForMessage(userMessage);
    if (!this.deps.contextBuilderService) {
      return selectedContext;
    }

    return this.deps.contextBuilderService.build(selectedContext);
  }

  private buildSessionMemory(runId: string): SessionMemorySnapshot | undefined {
    if (!this.deps.sessionMemoryService || !this.deps.sessionService.getMessages) {
      return undefined;
    }

    const messages = this.deps.sessionService.getMessages();
    const memory = this.deps.sessionMemoryService.build(messages);
    if (memory.prompt.trim()) {
      this.emitPhase(runId, 'context', 'Building session memory');
      return memory;
    }

    return undefined;
  }

  private async buildProjectMemory(runId: string): Promise<ProjectMemorySnapshot | undefined> {
    if (!this.deps.projectMemoryService) {
      return undefined;
    }

    const memory = await this.deps.projectMemoryService.build();
    if (memory.prompt.trim()) {
      this.emitPhase(runId, 'context', 'Loading project memory');
      return memory;
    }

    return undefined;
  }

  private async buildProjectInstructions(
    runId: string
  ): Promise<ProjectInstructionSnapshot | undefined> {
    if (!this.deps.projectInstructionService) {
      return undefined;
    }

    const instructions = await this.deps.projectInstructionService.build();
    if (instructions.prompt.trim()) {
      this.emitPhase(runId, 'context', 'Loading project instructions');
      return instructions;
    }

    return undefined;
  }

  private async buildUserPreferences(
    runId: string
  ): Promise<UserPreferenceMemorySnapshot | undefined> {
    if (!this.deps.userPreferenceMemoryService) {
      return undefined;
    }

    const memory = await this.deps.userPreferenceMemoryService.build();
    if (memory.prompt.trim()) {
      this.emitPhase(runId, 'context', 'Loading user preferences');
      return memory;
    }

    return undefined;
  }

  private retrieveLongTermMemory(
    runId: string,
    userMessage: string,
    memory: {
      userPreferences?: UserPreferenceMemorySnapshot;
      projectMemory?: ProjectMemorySnapshot;
    }
  ): RetrievedMemorySnapshot | MemoryGovernanceResult | undefined {
    if (!this.deps.memoryRetrievalService) {
      return undefined;
    }

    const retrievedMemory = this.deps.memoryRetrievalService.build({
      userMessage,
      userPreferences: memory.userPreferences,
      projectMemory: memory.projectMemory,
    });
    if (!retrievedMemory.prompt.trim()) {
      return undefined;
    }

    this.emitPhase(runId, 'context', 'Retrieving relevant memory');
    if (this.deps.memoryGovernanceService) {
      const governedMemory = this.deps.memoryGovernanceService.apply(retrievedMemory.entries);
      if (governedMemory.prompt.trim()) {
        this.emitPhase(runId, 'context', 'Applying memory governance');
        return governedMemory;
      }
    }

    return retrievedMemory;
  }

  private buildModelMessage(
    userMessage: string,
    intent: AgentRunIntentDecision,
    selectedContext?: SelectedContext,
    sessionMemory?: SessionMemorySnapshot,
    projectInstructions?: ProjectInstructionSnapshot,
    projectMemory?: ProjectMemorySnapshot,
    userPreferences?: UserPreferenceMemorySnapshot,
    retrievedMemory?: RetrievedMemorySnapshot | MemoryGovernanceResult
  ): string {
    const sections: string[] = [];

    if (intent.intent === 'code-change') {
      sections.push(
        [
          '## Agent Run Contract',
          '',
          'This request requires workspace changes.',
          '- Inspect relevant files before editing.',
          '- Edit files through available tools when changes are required.',
          '- Run or request verification after changes.',
          '- If you cannot edit files or run verification, explain the blocker clearly.',
          `Intent reason: ${intent.reason}`,
        ].join('\n')
      );
    }

    if (retrievedMemory?.prompt.trim()) {
      sections.push(retrievedMemory.prompt);
    } else {
      if (userPreferences?.prompt.trim()) {
        sections.push(userPreferences.prompt);
      }
    }

    if (projectInstructions?.prompt.trim()) {
      sections.push(projectInstructions.prompt);
    }

    if (!retrievedMemory?.prompt.trim()) {
      if (projectMemory?.prompt.trim()) {
        sections.push(projectMemory.prompt);
      }
    }

    if (sessionMemory?.prompt.trim()) {
      sections.push(sessionMemory.prompt);
    }

    if (selectedContext?.prompt.trim()) {
      sections.push(selectedContext.prompt);
    }

    if (sections.length === 0) {
      return userMessage;
    }

    return `${sections.join('\n\n---\n\n')}\n\n---\n\nUser request:\n${userMessage}`;
  }

  private collectFileChanges(): { changes: FileChangeRecord[]; stop: () => void } {
    const changes: FileChangeRecord[] = [];
    const handler = (event: { change?: FileChangeRecord }) => {
      if (event.change) {
        changes.push(event.change);
      }
    };

    this.deps.eventBus.on('file_change', handler);

    return {
      changes,
      stop: () => this.deps.eventBus.off('file_change', handler),
    };
  }

  private async runVerification(
    runId: string,
    fileChanges: FileChangeRecord[]
  ): Promise<VerificationResult | undefined> {
    if (!this.deps.verificationService || fileChanges.length === 0) {
      return undefined;
    }

    this.emitPhase(runId, 'verifying', 'Running project verification');
    return this.deps.verificationService.verify();
  }

  private async repairIfNeeded(
    runId: string,
    userMessage: string,
    initialResponse: AIResponse,
    verification: VerificationResult | undefined,
    tools: Tool[],
    abortSignal?: AbortSignal
  ): Promise<AgentRepairAttempt | undefined> {
    if (!verification || verification.success || !this.deps.verificationService) {
      return undefined;
    }

    const issues = this.verificationErrorParser.parse(verification);
    const repairContext = this.selectVerificationContext(runId, userMessage, issues);
    const repairPrompt = this.buildRepairPrompt(
      userMessage,
      initialResponse.content,
      verification,
      issues,
      repairContext
    );

    this.emitPhase(runId, 'repairing', 'Attempting one verification-guided repair');
    const repairChanges = this.collectFileChanges();
    let collectingRepairChanges = true;
    const stopCollectingRepairChanges = () => {
      if (!collectingRepairChanges) {
        return;
      }

      collectingRepairChanges = false;
      repairChanges.stop();
    };

    try {
      let repairResponse: AIResponse;
      try {
        repairResponse = await this.deps.modelService.chatWithTools(
          repairPrompt,
          tools,
          this.deps.toolManager,
          {
            runId,
            abortSignal,
            onRuntimeEvent: (event) => this.emitRuntimeEvent(event),
            onStreamEvent: (event) => this.deps.eventBus.emit('model_stream_event', event),
          }
        );
      } finally {
        stopCollectingRepairChanges();
      }

      const repairVerification =
        repairChanges.changes.length > 0
          ? await this.runVerification(runId, repairChanges.changes)
          : verification;

      return {
        attempted: true,
        response: repairResponse,
        verification: repairVerification,
        issues,
        fileChanges: repairChanges.changes,
      };
    } catch (error) {
      stopCollectingRepairChanges();
      return {
        attempted: true,
        issues,
        fileChanges: repairChanges.changes,
        error: error instanceof Error ? error.message : 'Unknown repair error',
      };
    }
  }

  private buildRepairPrompt(
    userMessage: string,
    initialResponse: string,
    verification: VerificationResult,
    issues: VerificationIssue[],
    repairContext?: SelectedContext
  ): string {
    const formattedIssues = this.verificationErrorParser.formatForPrompt(issues);
    const verificationContext = repairContext?.prompt.trim()
      ? ['Verification-driven repository context:', repairContext.prompt, ''].join('\n')
      : '';

    return [
      'The previous coding attempt changed files, but project verification failed.',
      '',
      'Original user request:',
      userMessage,
      '',
      'Previous assistant response:',
      initialResponse,
      '',
      'Structured verification issues:',
      formattedIssues,
      '',
      verificationContext,
      'Raw verification summary:',
      verification.summary,
      '',
      'Repair instructions:',
      '- Make the smallest code change needed to fix the verification failure.',
      '- Read the relevant files before editing if needed.',
      '- Do not rewrite unrelated files.',
      '- After your repair, stop and report what you changed.',
    ].join('\n');
  }

  private selectVerificationContext(
    runId: string,
    userMessage: string,
    issues: VerificationIssue[]
  ): SelectedContext | undefined {
    if (!this.deps.repoMapService?.selectForVerificationIssues || issues.length === 0) {
      return undefined;
    }

    this.emitPhase(runId, 'context', 'Selecting verification-driven context');
    const selectedContext = this.deps.repoMapService.selectForVerificationIssues(
      userMessage,
      issues
    );
    if (!this.deps.contextBuilderService) {
      return selectedContext;
    }

    return this.deps.contextBuilderService.build(selectedContext);
  }

  private emitPhase(
    runId: string,
    phase: AgentLoopPhase,
    description: string,
    error?: string,
    runtime?: Pick<
      AgentLoopEvent,
      | 'runtimeKind'
      | 'turnId'
      | 'stepId'
      | 'toolCallId'
      | 'operationId'
      | 'lifecycle'
      | 'durationMs'
    >
  ): void {
    const event: AgentLoopEvent = {
      runId,
      phase,
      description,
      timestamp: Date.now(),
      ...runtime,
      error,
    };

    this.deps.eventBus.emit('agent_loop_event', event);
  }

  private emitRuntimeEvent(event: AgentRuntimeEvent): void {
    if (event.lifecycle === 'delta') {
      return;
    }

    this.emitPhase(
      event.runId,
      event.type === 'model_completed' ? 'responding' : 'executing',
      event.description,
      event.error,
      {
        runtimeKind: event.kind,
        turnId: event.turnId,
        stepId: event.stepId,
        toolCallId: 'toolCallId' in event ? event.toolCallId : undefined,
        operationId: event.operationId,
        lifecycle: event.lifecycle,
        durationMs: event.durationMs,
      }
    );
  }
}
