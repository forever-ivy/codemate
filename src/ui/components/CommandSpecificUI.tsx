/**
 * 命令特定UI组件
 *
 * 根据不同的命令类型显示不同的UI界面
 */
import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme/ThemeSystem.js';

interface CommandUIProps {
  command: string;
  data?: any;
  onSelect?: (item: any) => void;
  onCancel?: () => void;
}

/**
 * 会话列表UI - /sessions 命令
 */
export const SessionListUI: React.FC<{ sessions: any[]; onSelect: (session: any) => void }> = ({
  sessions,
  onSelect: _onSelect,
}) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.primary} bold>
        📋 Active Sessions
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {sessions.map((session, index) => (
          <Box key={session.id} flexDirection="row" paddingY={0}>
            <Text color={colors.text.secondary}>{index + 1}.</Text>
            <Box marginLeft={1} flexGrow={1}>
              <Text color={colors.text.primary}>
                {session.name || `Session ${session.id.slice(0, 8)}`}
              </Text>
              <Text color={colors.text.secondary} dimColor>
                {' '}
                ({session.messages?.length || 0} messages)
              </Text>
            </Box>
            <Text color={colors.info}>{new Date(session.createdAt).toLocaleDateString()}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={colors.text.secondary} dimColor>
          Use ↑↓ to navigate, Enter to select, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
};

/**
 * 模型选择UI - /model 命令
 */
export const ModelSelectionUI: React.FC<{
  models: string[];
  currentModel: string;
  onSelect: (model: string) => void;
}> = ({ models, currentModel, onSelect: _onSelect }) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.primary} bold>
        🤖 Available Models
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {models.map((model) => (
          <Box key={model} flexDirection="row" paddingY={0}>
            <Text color={model === currentModel ? colors.success : colors.text.secondary}>
              {model === currentModel ? '●' : '○'}
            </Text>
            <Box marginLeft={1}>
              <Text
                color={model === currentModel ? colors.success : colors.text.primary}
                bold={model === currentModel}
              >
                {model}
              </Text>
              {model === currentModel && (
                <Text color={colors.success} dimColor>
                  {' '}
                  (current)
                </Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={colors.text.secondary} dimColor>
          Use ↑↓ to navigate, Enter to select, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
};

/**
 * 配置管理UI - /config 命令
 */
export const ConfigManagementUI: React.FC<{
  configs: Record<string, any>;
  onEdit: (key: string, value: any) => void;
}> = ({ configs, onEdit: _onEdit }) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.primary} bold>
        ⚙️ Configuration Settings
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {Object.entries(configs).map(([key, value]) => (
          <Box key={key} flexDirection="row" paddingY={0}>
            <Box width={20}>
              <Text color={colors.accent}>{key}</Text>
            </Box>
            <Text color={colors.text.secondary}>:</Text>
            <Box marginLeft={1}>
              <Text color={colors.text.primary}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={colors.text.secondary} dimColor>
          Use ↑↓ to navigate, Enter to edit, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
};

/**
 * 技能管理UI - /skill 命令
 */
export const SkillManagementUI: React.FC<{
  skills: Array<{ name: string; description: string; source: string }>;
  onInstall: (skill: string) => void;
  onRemove: (skill: string) => void;
}> = ({ skills, onInstall: _onInstall, onRemove: _onRemove }) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.primary} bold>
        🎯 Skills Management
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {skills.map((skill) => (
          <Box key={skill.name} flexDirection="column" paddingY={0}>
            <Box flexDirection="row">
              <Text color={colors.success}>✓</Text>
              <Box marginLeft={1} flexGrow={1}>
                <Text color={colors.text.primary} bold>
                  {skill.name}
                </Text>
                <Text color={colors.text.secondary} dimColor>
                  {' '}
                  ({skill.source})
                </Text>
              </Box>
            </Box>
            <Box marginLeft={2}>
              <Text color={colors.text.secondary}>{skill.description}</Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={colors.text.secondary} dimColor>
          Available actions: install, remove, list
        </Text>
      </Box>
    </Box>
  );
};

/**
 * 智能提交UI - /commit 命令
 */
export const CommitUI: React.FC<{
  changes: Array<{ file: string; status: string; additions: number; deletions: number }>;
  suggestedMessage: string;
  onCommit: (message: string) => void;
}> = ({ changes, suggestedMessage, onCommit: _onCommit }) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.primary} bold>
        📝 Smart Commit
      </Text>

      {/* 文件变更列表 */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.accent} bold>
          Changes to commit:
        </Text>
        {changes.map((change) => (
          <Box key={change.file} flexDirection="row" paddingY={0}>
            <Text color={change.status === 'modified' ? colors.warning : colors.success}>
              {change.status === 'modified' ? 'M' : 'A'}
            </Text>
            <Box marginLeft={1} flexGrow={1}>
              <Text color={colors.text.primary}>{change.file}</Text>
            </Box>
            <Text color={colors.success}>+{change.additions}</Text>
            <Text color={colors.error}> -{change.deletions}</Text>
          </Box>
        ))}
      </Box>

      {/* AI生成的提交信息 */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.accent} bold>
          Suggested commit message:
        </Text>
        <Box borderStyle="round" borderColor={colors.border} paddingX={1} marginTop={1}>
          <Text color={colors.text.primary}>{suggestedMessage}</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={colors.text.secondary} dimColor>
          Press Enter to commit, E to edit message, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
};

/**
 * 工作区管理UI - /workspace 命令
 */
export const WorkspaceUI: React.FC<{
  workspaces: Array<{ name: string; branch: string; path: string; active: boolean }>;
  onSwitch: (workspace: string) => void;
  onCreate: (name: string, branch: string) => void;
}> = ({ workspaces, onSwitch: _onSwitch, onCreate: _onCreate }) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.primary} bold>
        🏗️ Workspace Management
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {workspaces.map((workspace) => (
          <Box key={workspace.name} flexDirection="row" paddingY={0}>
            <Text color={workspace.active ? colors.success : colors.text.secondary}>
              {workspace.active ? '●' : '○'}
            </Text>
            <Box marginLeft={1} flexGrow={1}>
              <Text
                color={workspace.active ? colors.success : colors.text.primary}
                bold={workspace.active}
              >
                {workspace.name}
              </Text>
              <Text color={colors.text.secondary} dimColor>
                {' '}
                ({workspace.branch})
              </Text>
            </Box>
            <Text color={colors.info}>{workspace.path}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={colors.text.secondary} dimColor>
          Actions: create, switch, delete, list
        </Text>
      </Box>
    </Box>
  );
};

/**
 * 主命令UI路由器
 */
export const CommandSpecificUI: React.FC<CommandUIProps> = ({
  command,
  data,
  onSelect,
  onCancel,
}) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();

  // 根据命令类型渲染不同的UI
  switch (command) {
    case '/sessions':
      return <SessionListUI sessions={data?.sessions || []} onSelect={onSelect || (() => {})} />;

    case '/model':
      return (
        <ModelSelectionUI
          models={data?.models || []}
          currentModel={data?.currentModel || ''}
          onSelect={onSelect || (() => {})}
        />
      );

    case '/config':
      return <ConfigManagementUI configs={data?.configs || {}} onEdit={onSelect || (() => {})} />;

    case '/skill':
      return (
        <SkillManagementUI
          skills={data?.skills || []}
          onInstall={onSelect || (() => {})}
          onRemove={onCancel || (() => {})}
        />
      );

    case '/commit':
      return (
        <CommitUI
          changes={data?.changes || []}
          suggestedMessage={data?.suggestedMessage || ''}
          onCommit={onSelect || (() => {})}
        />
      );

    case '/workspace':
      return (
        <WorkspaceUI
          workspaces={data?.workspaces || []}
          onSwitch={onSelect || (() => {})}
          onCreate={onCancel || (() => {})}
        />
      );

    default:
      // 默认的通用命令UI
      return (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Text color={colors.primary} bold>
            {command}
          </Text>
          <Text color={colors.text.secondary}>Command executed successfully</Text>
        </Box>
      );
  }
};
