import type { RenderOptions } from 'ink';

/**
 * Shared Ink renderer options for the interactive CLI.
 *
 * CodeMate installs its own console silencer before Ink mounts. Ink's console
 * patch stays disabled so it cannot replace that silencer during the
 * synchronous initial render.
 * `exitOnCtrlC` is disabled because App owns Ctrl+C semantics for modals,
 * transcript mode and graceful shutdown.
 * `incrementalRendering` updates only changed terminal lines, so typing in the
 * composer does not erase and redraw the entire dynamic workbench.
 */
export function createInkRenderOptions(): RenderOptions {
  return {
    patchConsole: false,
    exitOnCtrlC: false,
    incrementalRendering: true,
    maxFps: 30,
  };
}
