import { Box, Text } from 'ink';
import { type Token, type Tokens, marked } from 'marked';
import React, { useMemo } from 'react';
import { useTheme } from '../theme/ThemeSystem';

interface TerminalMarkdownProps {
  content: string;
}

/**
 * Renders model Markdown as semantic Ink elements instead of raw markers.
 *
 * Marked owns parsing, including GFM lists and fenced code. This component is
 * deliberately a terminal renderer: headings, lists, emphasis, links and code
 * receive readable Ink styles while unsupported tokens fall back to text.
 */
export const TerminalMarkdown: React.FC<TerminalMarkdownProps> = ({ content }) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();
  const tokens = useMemo(() => marked.lexer(content, { gfm: true, breaks: true }), [content]);

  const renderInline = (
    inlineTokens: Token[] | undefined,
    keyPrefix: string
  ): React.ReactNode[] => {
    if (!inlineTokens) {
      return [];
    }

    return inlineTokens.map((token, index) => {
      const key = `${keyPrefix}-${index}`;

      switch (token.type) {
        case 'strong': {
          const strong = token as Tokens.Strong;
          return (
            <Text key={key} bold>
              {renderInline(strong.tokens, key)}
            </Text>
          );
        }
        case 'em': {
          const emphasis = token as Tokens.Em;
          return (
            <Text key={key} italic>
              {renderInline(emphasis.tokens, key)}
            </Text>
          );
        }
        case 'del': {
          const deleted = token as Tokens.Del;
          return (
            <Text key={key} strikethrough>
              {renderInline(deleted.tokens, key)}
            </Text>
          );
        }
        case 'codespan':
          return (
            <Text key={key} color={colors.code}>
              {(token as Tokens.Codespan).text}
            </Text>
          );
        case 'link': {
          const link = token as Tokens.Link;
          return (
            <React.Fragment key={key}>
              <Text color={colors.link}>{renderInline(link.tokens, key)}</Text>
              <Text color={colors.text.secondary} dimColor>
                {` (${link.href})`}
              </Text>
            </React.Fragment>
          );
        }
        case 'image': {
          const image = token as Tokens.Image;
          return (
            <Text key={key} color={colors.link}>
              {`${image.text || 'image'} (${image.href})`}
            </Text>
          );
        }
        case 'br':
          return <Text key={key}>{'\n'}</Text>;
        case 'text': {
          const text = token as Tokens.Text;
          return (
            <Text key={key}>
              {text.tokens?.length ? renderInline(text.tokens, key) : text.text}
            </Text>
          );
        }
        default:
          return <Text key={key}>{'text' in token ? String(token.text) : token.raw}</Text>;
      }
    });
  };

  const renderBlocks = (blockTokens: Token[], keyPrefix = 'block'): React.ReactNode[] =>
    blockTokens.flatMap((token, index) => {
      const key = `${keyPrefix}-${index}`;

      switch (token.type) {
        case 'space':
        case 'def':
          return [];
        case 'heading': {
          const heading = token as Tokens.Heading;
          return [
            <Box key={key} marginTop={heading.depth > 2 ? 0 : 1} marginBottom={1}>
              <Text color={colors.primary} bold underline={heading.depth === 1}>
                {renderInline(heading.tokens, key)}
              </Text>
            </Box>,
          ];
        }
        case 'paragraph': {
          const paragraph = token as Tokens.Paragraph;
          return [
            <Box key={key} marginBottom={1}>
              <Text wrap="wrap">{renderInline(paragraph.tokens, key)}</Text>
            </Box>,
          ];
        }
        case 'text': {
          const text = token as Tokens.Text;
          return [
            <Box key={key}>
              <Text>{text.tokens?.length ? renderInline(text.tokens, key) : text.text}</Text>
            </Box>,
          ];
        }
        case 'list': {
          const list = token as Tokens.List;
          const start = typeof list.start === 'number' ? list.start : 1;
          return [
            <Box key={key} flexDirection="column" marginBottom={1}>
              {list.items.map((item, itemIndex) => (
                <Box key={`${key}-item-${item.raw}`} flexDirection="row" paddingLeft={1}>
                  <Text color={colors.accent}>
                    {list.ordered ? `${start + itemIndex}. ` : '• '}
                  </Text>
                  <Box flexDirection="column" flexGrow={1}>
                    {renderBlocks(item.tokens, `${key}-item-${itemIndex}`)}
                  </Box>
                </Box>
              ))}
            </Box>,
          ];
        }
        case 'code': {
          const code = token as Tokens.Code;
          return [
            <Box
              key={key}
              flexDirection="column"
              borderStyle="single"
              borderColor={colors.border}
              paddingX={1}
              marginBottom={1}
            >
              {code.lang && (
                <Text color={colors.text.secondary} dimColor>
                  {code.lang}
                </Text>
              )}
              <Text color={colors.code}>{code.text}</Text>
            </Box>,
          ];
        }
        case 'blockquote': {
          const quote = token as Tokens.Blockquote;
          return [
            <Box
              key={key}
              flexDirection="column"
              borderLeft={true}
              borderColor={colors.text.secondary}
              paddingLeft={1}
              marginBottom={1}
            >
              {renderBlocks(quote.tokens, key)}
            </Box>,
          ];
        }
        case 'hr':
          return [
            <Text key={key} color={colors.border} dimColor>
              {'─'.repeat(48)}
            </Text>,
          ];
        case 'table': {
          const table = token as Tokens.Table;
          const rows = [table.header, ...table.rows];
          return [
            <Box key={key} flexDirection="column" marginBottom={1}>
              {rows.map((row) => (
                <Text key={`${key}-row-${row.map((cell) => cell.text).join('|')}`}>
                  {row.map((cell) => cell.text).join(' | ')}
                </Text>
              ))}
            </Box>,
          ];
        }
        default:
          return [<Text key={key}>{'text' in token ? String(token.text) : token.raw}</Text>];
      }
    });

  return <Box flexDirection="column">{renderBlocks(tokens)}</Box>;
};
