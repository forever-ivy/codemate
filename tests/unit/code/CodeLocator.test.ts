import { describe, it, expect } from 'vitest';
import { CodeParser } from '../../../src/code/CodeParser';
import { CodeLocator } from '../../../src/code/CodeLocator';

describe('CodeLocator', () => {
  const parser = new CodeParser();
  const locator = new CodeLocator();

  it('should find function', () => {
    const code = 'function add(a, b) { return a + b; }';
    const ast = parser.parse(code, 'test.js');
    const element = locator.find(ast, 'add', 'function');

    expect(element).toBeDefined();
    expect(element?.name).toBe('add');
    expect(element?.type).toBe('function');
  });

  it('should find class', () => {
    const code = 'class User { constructor(name) { this.name = name; } }';
    const ast = parser.parse(code, 'test.js');
    const element = locator.find(ast, 'User', 'class');

    expect(element).toBeDefined();
    expect(element?.name).toBe('User');
    expect(element?.type).toBe('class');
  });

  it('should find method in class', () => {
    const code = `
      class User {
        getName() {
          return this.name;
        }
      }
    `;
    const ast = parser.parse(code, 'test.js');
    const element = locator.find(ast, 'getName', 'method', 'User');

    expect(element).toBeDefined();
    expect(element?.name).toBe('getName');
    expect(element?.type).toBe('method');
    expect(element?.parent).toBe('User');
  });

  it('should list all functions', () => {
    const code = `
      function add(a, b) { return a + b; }
      function subtract(a, b) { return a - b; }
    `;
    const ast = parser.parse(code, 'test.js');
    const functions = locator.listFunctions(ast);

    expect(functions).toHaveLength(2);
    expect(functions[0].name).toBe('add');
    expect(functions[1].name).toBe('subtract');
  });
});
