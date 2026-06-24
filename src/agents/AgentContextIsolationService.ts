import type { ToolManager } from '../managers/ToolManager';
import type { AgentContext } from '../types/index';

export interface AgentIsolationMetadata {
  agentName: string;
  parentRunId: string;
  allowedTools: string[];
  disallowedTools: string[];
  contextSummary?: string;
}

export interface AgentContextIsolationInput {
  parentContext: AgentContext;
  agentName: string;
  parentRunId: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  contextSummary?: string;
}

export type IsolatedAgentContext = AgentContext & {
  isolation: AgentIsolationMetadata;
};

/**
 * Builds a restricted view of the parent AgentContext for subagent execution.
 *
 * The parent context remains the source of truth for services. The returned
 * context wraps toolManager so subagents can only list, inspect and execute the
 * tools explicitly allowed by the parent orchestration layer.
 */
export class AgentContextIsolationService {
  build(input: AgentContextIsolationInput): IsolatedAgentContext {
    const allowedTools = this.resolveAllowedTools(input);
    const disallowedTools = input.disallowedTools ?? [];

    return {
      ...input.parentContext,
      toolManager: this.createRestrictedToolManager({
        parentToolManager: input.parentContext.toolManager,
        agentName: input.agentName,
        allowedTools,
      }),
      isolation: {
        agentName: input.agentName,
        parentRunId: input.parentRunId,
        allowedTools,
        disallowedTools,
        contextSummary: input.contextSummary,
      },
    };
  }

  private resolveAllowedTools(input: AgentContextIsolationInput): string[] {
    const parentTools = input.parentContext.toolManager.list();
    const allowedSet = new Set(input.allowedTools ?? parentTools);
    const disallowedSet = new Set(input.disallowedTools ?? []);

    return parentTools.filter(
      (toolName) => allowedSet.has(toolName) && !disallowedSet.has(toolName)
    );
  }

  private createRestrictedToolManager(input: {
    parentToolManager: ToolManager;
    agentName: string;
    allowedTools: string[];
  }): ToolManager {
    const allowedSet = new Set(input.allowedTools);
    const assertAllowed = (toolName: string) => {
      if (!allowedSet.has(toolName)) {
        throw new Error(`Tool not allowed for subagent ${input.agentName}: ${toolName}`);
      }
    };

    const restrictedToolManager = {
      ...input.parentToolManager,
      list: () => input.allowedTools,
      has: (toolName: string) => allowedSet.has(toolName) && input.parentToolManager.has(toolName),
      get: (toolName: string) => {
        if (!allowedSet.has(toolName)) {
          return undefined;
        }
        return input.parentToolManager.get(toolName);
      },
      getAllTools: () => {
        const parentToolManager = input.parentToolManager as ToolManager & {
          getAllTools?: () => Array<{ name?: string }>;
        };
        const parentTools = parentToolManager.getAllTools?.() ?? [];
        return parentTools.filter(
          (tool: { name?: string }) => tool.name && allowedSet.has(tool.name)
        );
      },
      execute: async (toolName: string, toolInput: unknown) => {
        assertAllowed(toolName);
        return input.parentToolManager.execute(toolName, toolInput);
      },
    };

    return restrictedToolManager as unknown as ToolManager;
  }
}
