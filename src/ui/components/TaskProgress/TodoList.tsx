/**
 * Todo任务列表组件 - 显示任务状态和进度
 */
import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { TodoItem } from '../AgentProgress/types';

// 状态权重用于排序
const statusWeights = {
  completed: 0,
  in_progress: 1,
  pending: 2,
};

const priorityWeights = {
  high: 0,
  medium: 1,
  low: 2,
};

function compareTodos(todoA: TodoItem, todoB: TodoItem) {
  // 首先按状态排序
  const statusDiff = statusWeights[todoA.status] - statusWeights[todoB.status];
  if (statusDiff !== 0) return statusDiff;

  // 然后按优先级排序
  return priorityWeights[todoA.priority] - priorityWeights[todoB.priority];
}

interface TodoItemProps {
  todo: TodoItem;
  isCurrent: boolean;
  verbose: boolean;
  previousStatus?: string;
}

function TodoItemComponent({ todo, isCurrent = false, verbose, previousStatus }: TodoItemProps) {
  const color = useMemo(() => {
    if (previousStatus !== 'completed' && todo.status === 'completed') {
      return 'green';
    }
    if (previousStatus !== 'in_progress' && todo.status === 'in_progress') {
      return 'blue';
    }
    return undefined;
  }, [todo.status, previousStatus]);

  return (
    <Box flexDirection="row">
      <Box minWidth={2}>
        <Text color={color} bold={isCurrent}>
          {todo.status === 'completed' ? '✅' : '☐'}{' '}
        </Text>
      </Box>
      <Box>
        <Text bold={isCurrent} color={color} strikethrough={todo.status === 'completed'}>
          {todo.content}
        </Text>
        {verbose && (
          <Text dimColor>
            {' '}
            (P
            {todo.priority === 'high' ? '0' : todo.priority === 'medium' ? '1' : '2'})
          </Text>
        )}
      </Box>
    </Box>
  );
}

interface IndentedContainerProps {
  children: React.ReactNode;
  height: number;
}

function IndentedContainer({ children, height }: IndentedContainerProps) {
  return (
    <Box flexDirection="row" height={height} overflowY="hidden">
      <Text> │ </Text>
      {children}
    </Box>
  );
}

interface TodoListProps {
  oldTodos: TodoItem[];
  newTodos: TodoItem[];
  verbose?: boolean;
}

export function TodoList({ oldTodos, newTodos, verbose = false }: TodoListProps) {
  if (newTodos.length === 0) {
    return (
      <IndentedContainer height={1}>
        <Text dimColor>(Empty todo list)</Text>
      </IndentedContainer>
    );
  }

  return (
    <Box flexDirection="column">
      {newTodos.sort(compareTodos).map((todo) => {
        const oldTodo = oldTodos.find((t) => t.id === todo.id);
        return (
          <TodoItemComponent
            key={todo.id}
            todo={todo}
            isCurrent={todo.status === 'in_progress'}
            verbose={verbose}
            previousStatus={oldTodo?.status}
          />
        );
      })}
    </Box>
  );
}
