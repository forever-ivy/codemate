import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/cli.ts'],
	format: ['esm'],
	dts: false, // 不生成类型定义文件，加快构建速度
	sourcemap: false,
	clean: true,
	shims: true, // 添加 import.meta.url 等 shim
	splitting: false,
	treeshake: true,
	minify: false, // CLI 不需要压缩
	target: 'node20',
	outDir: 'dist',
	bundle: true, // 打包所有依赖
	external: [
		// 排除 node 内置模块
		'node:*',
		// 排除生产依赖，让 npm 安装它们
		'@ai-sdk/openai',
		'@babel/generator',
		'@babel/parser',
		'@babel/traverse',
		'@babel/types',
		'ai',
		'commander',
		'dotenv',
		'express',
		'ink',
		'ink-spinner',
		'ink-text-input',
		'openai',
		'react',
		'ws',
		'zod',
		'zod-to-json-schema',
	],
});
