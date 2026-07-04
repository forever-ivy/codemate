import { describe, it, expect, vi } from 'vitest';
import { MCPCommand } from '../../../src/commands/mcp/MCPCommand';
import { EventBus } from '../../../src/services/EventBus';

describe('MCPCommand', () => {
  it('should have correct name and description', () => {
    const eventBus = new EventBus();
    const command = new MCPCommand(eventBus);

    expect(command.name).toBe('mcp');
    expect(command.description).toBe('MCP servers management');
  });

  it('should emit show_mcp_manager event when executed', async () => {
    const eventBus = new EventBus();
    const emitSpy = vi.spyOn(eventBus, 'emit');

    const command = new MCPCommand(eventBus);
    await command.execute();

    expect(emitSpy).toHaveBeenCalledWith('show_mcp_manager', {});
  });

  it('should validate arguments correctly', () => {
    const eventBus = new EventBus();
    const command = new MCPCommand(eventBus);

    // MCP命令不需要参数
    expect(command.validate([])).toBe(true);
    expect(command.validate(['arg1'])).toBe(true); // 允许参数但忽略
  });

  it('should return correct command info', () => {
    const eventBus = new EventBus();
    const command = new MCPCommand(eventBus);

    const info = command.getInfo();
    expect(info.name).toBe('mcp');
    expect(info.description).toBe('MCP servers management');
    expect(info.aliases).toEqual([]);
  });
});
