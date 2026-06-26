/**
 * 流式文本组件
 *
 * 支持打字机效果的文本渲染
 */
import React, { useState, useEffect, useRef } from 'react';
import { Text } from 'ink';
import { useTheme } from '../theme/ThemeSystem.js';

interface StreamingTextProps {
  text: string;
  speed?: number; // 字符/秒
  onComplete?: () => void;
  showCursor?: boolean;
  highlightSyntax?: boolean;
  pauseOnPunctuation?: boolean;
}

export const StreamingText: React.FC<StreamingTextProps> = ({
  text,
  speed = 50,
  onComplete,
  showCursor = true,
  highlightSyntax = false,
  pauseOnPunctuation = true,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCursorState, setShowCursorState] = useState(true);
  const theme = useTheme();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cursorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentIndex < text.length) {
      const delay = calculateDelay(text[currentIndex], speed, pauseOnPunctuation);

      intervalRef.current = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, delay);
    } else if (onComplete) {
      onComplete();
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [currentIndex, text, speed, pauseOnPunctuation, onComplete]);

  // 光标闪烁效果
  useEffect(() => {
    if (showCursor && currentIndex < text.length) {
      cursorIntervalRef.current = setInterval(() => {
        setShowCursorState((prev) => !prev);
      }, 500);
    }

    return () => {
      if (cursorIntervalRef.current) {
        clearInterval(cursorIntervalRef.current);
      }
    };
  }, [showCursor, currentIndex, text.length]);

  const calculateDelay = (char: string, baseSpeed: number, pauseOnPunctuation: boolean): number => {
    const baseDelay = 1000 / baseSpeed;

    if (pauseOnPunctuation && /[.!?;:]/.test(char)) {
      return baseDelay * 3; // 标点符号处暂停更久
    }

    if (/[,]/.test(char)) {
      return baseDelay * 1.5; // 逗号处稍微暂停
    }

    return baseDelay;
  };

  const renderText = () => {
    if (highlightSyntax) {
      return renderWithSyntaxHighlight(displayedText);
    }
    return displayedText;
  };

  const renderWithSyntaxHighlight = (text: string): React.ReactNode => {
    // 简单的语法高亮实现
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    let result = text;

    // 处理代码块
    result = result.replace(codeBlockRegex, (_match, _lang, code) => {
      return `\n${code}\n`; // 简化处理，实际可以添加颜色
    });

    return result;
  };

  return (
    <Text>
      {renderText()}
      {showCursor && showCursorState && currentIndex < text.length && (
        <Text color={theme.getCurrentTheme().accent}>▋</Text>
      )}
    </Text>
  );
};
