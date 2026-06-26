import { useEffect, useRef, useState } from 'react';

const RESIZE_DEBOUNCE_MS = 500;
const WIDTH_CHANGE_THRESHOLD = 1;

export function useTerminalRefresh() {
  const initialWidth = process.stdout.columns ?? 80;
  const [terminalWidth, setTerminalWidth] = useState(initialWidth);
  const lastWidthRef = useRef(initialWidth);

  useEffect(() => {
    if (!process.stdout.isTTY) {
      return;
    }

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    const handleResize = () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      resizeTimer = setTimeout(() => {
        const nextWidth = process.stdout.columns ?? 0;
        const widthDelta = Math.abs(nextWidth - lastWidthRef.current);
        if (widthDelta <= WIDTH_CHANGE_THRESHOLD) {
          return;
        }

        lastWidthRef.current = nextWidth;
        setTerminalWidth(nextWidth);
      }, RESIZE_DEBOUNCE_MS);
    };

    process.stdout.on('resize', handleResize);

    return () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      process.stdout.off('resize', handleResize);
    };
  }, []);

  return {
    terminalWidth,
  };
}
