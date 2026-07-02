import React from 'react';
import { ButtonExample } from './ButtonExample';

/**
 * 主应用组件
 */
export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            React + TypeScript 按钮组件演示
          </h1>
          <p className="text-gray-600 mt-1">
            这是一个功能丰富的按钮组件示例，展示了React + TypeScript的最佳实践
          </p>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <ButtonExample />
        
        <div className="mt-12 p-6 bg-white rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">使用说明</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">安装和使用</h3>
              <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto">
{`import { Button } from './Button';

// 基本使用
<Button onClick={() => console.log('clicked')}>
  点击我
</Button>

// 带变体和大小的按钮
<Button variant="primary" size="lg">
  主要大按钮
</Button>

// 带图标的按钮
<Button 
  icon={<Icon />}
  loading={isLoading}
  disabled={isDisabled}
>
  提交
</Button>`}
              </pre>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Props 类型定义</h3>
              <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto">
{`interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
  className?: string;
}`}
              </pre>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-center text-gray-500">
            React + TypeScript 按钮组件示例 • 使用 Tailwind CSS 样式
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;