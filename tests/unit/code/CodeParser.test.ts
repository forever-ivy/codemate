import { describe, it, expect } from 'vitest';
import { CodeParser } from '../../../src/code/CodeParser';

describe('CodeParser', () => {
  const parser = new CodeParser();

  it('should parse JavaScript code', () => {
    const code = 'function add(a, b) { return a + b; }';
    const ast = parser.parse(code, 'test.js');

    expect(ast).toBeDefined();
    expect(ast.type).toBe('File');
  });

  it('should parse TypeScript code', () => {
    const code = 'function add(a: number, b: number): number { return a + b; }';
    const ast = parser.parse(code, 'test.ts');

    expect(ast).toBeDefined();
  });

  it('should validate correct code', () => {
    const code = 'const x = 1;';
    const isValid = parser.validate(code, 'test.js');

    expect(isValid).toBe(true);
  });

  it('should detect syntax errors', () => {
    const code = 'const x = ;'; // 语法错误
    const isValid = parser.validate(code, 'test.js');

    expect(isValid).toBe(false);
  });
});
