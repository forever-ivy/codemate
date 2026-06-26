import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
}

interface ModelSelectorProps {
  models: ModelInfo[];
  currentModelId: string;
  onSelect: (modelId: string) => void;
  onClose: () => void;
}

export function ModelSelector({ models, currentModelId, onSelect, onClose }: ModelSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(
    models.findIndex((m) => m.id === currentModelId) || 0
  );

  useInput((_, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev === 0 ? models.length - 1 : prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev === models.length - 1 ? 0 : prev + 1));
    } else if (key.return) {
      const selectedModel = models[selectedIndex];
      if (selectedModel) {
        onSelect(selectedModel.id);
      }
    } else if (key.escape) {
      onClose();
    }
  });

  // 按提供商分组
  const groupedModels: Record<string, ModelInfo[]> = {};
  models.forEach((model) => {
    if (!groupedModels[model.provider]) {
      groupedModels[model.provider] = [];
    }
    groupedModels[model.provider].push(model);
  });

  return (
    <Box flexDirection="column" width="100%" height="100%" paddingX={2} paddingY={1}>
      {/* 背景遮罩效果 */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
        width="100%"
      >
        {/* 标题 */}
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🤖 Select Model
          </Text>
        </Box>

        {/* 当前模型 */}
        <Box marginBottom={1}>
          <Text>Current model: </Text>
          <Text color="green">{currentModelId}</Text>
        </Box>

        {/* 分隔线 */}
        <Box marginBottom={1}>
          <Text color="gray">{'─'.repeat(50)}</Text>
        </Box>

        {/* 按提供商分组显示模型 */}
        {Object.entries(groupedModels).map(([provider, providerModels]) => (
          <Box key={provider} flexDirection="column" marginBottom={1}>
            <Text color="magenta" bold>
              ▶ {provider}
            </Text>
            {providerModels.map((model) => {
              const globalIndex = models.findIndex((m) => m.id === model.id);
              const isSelected = globalIndex === selectedIndex;
              const isCurrent = model.id === currentModelId;

              return (
                <Box key={model.id} flexDirection="column" paddingLeft={2}>
                  <Box>
                    <Text color={isSelected ? 'cyan' : isCurrent ? 'green' : 'white'}>
                      {isSelected ? '❯ ' : '  '}
                      {model.name} ({model.id})
                    </Text>
                  </Box>
                  <Box paddingLeft={2}>
                    <Text dimColor>{model.description}</Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        ))}

        {/* 分隔线 */}
        <Box marginTop={1} marginBottom={1}>
          <Text color="gray">{'─'.repeat(50)}</Text>
        </Box>

        {/* 帮助文本 */}
        <Box>
          <Text dimColor>↑↓: navigate, Enter: select, ESC: cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}
