import type { OutputStyleOpts } from '../base/OutputStyle';

/**
 * 默认样式
 */
export const defaultOutputStyle: OutputStyleOpts = {
  name: 'Default',
  description: 'Default output style with balanced detail',
  isCodingRelated: true,
  prompt: `Please provide clear and helpful responses.
- Use proper formatting for code blocks
- Explain your reasoning when relevant
- Be concise but thorough`,
};

/**
 * 简洁样式
 */
export const conciseOutputStyle: OutputStyleOpts = {
  name: 'Concise',
  description: 'Brief and direct responses',
  isCodingRelated: true,
  prompt: `Please provide concise and direct answers.
- Focus on essential information only
- Use bullet points for lists
- Minimize explanations`,
};

/**
 * 详细样式
 */
export const verboseOutputStyle: OutputStyleOpts = {
  name: 'Verbose',
  description: 'Detailed explanations with examples',
  isCodingRelated: true,
  prompt: `Please provide detailed and comprehensive responses.
- Include thorough explanations
- Provide multiple examples
- Explain edge cases and best practices
- Add relevant context and background`,
};

/**
 * 代码审查样式
 */
export const codeReviewOutputStyle: OutputStyleOpts = {
  name: 'Code Review',
  description: 'Focused on code quality and best practices',
  isCodingRelated: true,
  prompt: `Please review code with focus on:
- Code quality and readability
- Potential bugs and edge cases
- Performance considerations
- Security issues
- Best practices and patterns
- Suggest specific improvements`,
};

/**
 * 教学样式
 */
export const tutorialOutputStyle: OutputStyleOpts = {
  name: 'Tutorial',
  description: 'Educational style with step-by-step explanations',
  isCodingRelated: true,
  prompt: `Please provide educational responses in tutorial style:
- Break down concepts step by step
- Use analogies and examples
- Explain the "why" behind each step
- Include practice exercises when relevant
- Build from basics to advanced`,
};

/**
 * 获取所有内置样式
 */
export function getBuiltinOutputStyles(): OutputStyleOpts[] {
  return [
    defaultOutputStyle,
    conciseOutputStyle,
    verboseOutputStyle,
    codeReviewOutputStyle,
    tutorialOutputStyle,
  ];
}
