import { EventEmitter } from 'events';

export interface NavigationState {
  selectedIndex: number;
  totalItems: number;
  canNavigateUp: boolean;
  canNavigateDown: boolean;
  canNavigateLeft: boolean;
  canNavigateRight: boolean;
}

export interface NavigationAction {
  type: 'move' | 'select' | 'search' | 'filter' | 'exit' | 'help' | 'custom';
  direction?: 'up' | 'down' | 'left' | 'right';
  data?: any;
}

export class KeyboardNavigationSystem extends EventEmitter {
  private state: NavigationState = {
    selectedIndex: 0,
    totalItems: 0,
    canNavigateUp: false,
    canNavigateDown: false,
    canNavigateLeft: false,
    canNavigateRight: false,
  };

  private keyMappings = new Map<string, NavigationAction>();
  private customHandlers = new Map<string, (data?: any) => void>();

  constructor() {
    super();
    this.initializeDefaultMappings();
  }

  private initializeDefaultMappings(): void {
    // 基础导航
    this.keyMappings.set('up', { type: 'move', direction: 'up' });
    this.keyMappings.set('down', { type: 'move', direction: 'down' });
    this.keyMappings.set('left', { type: 'move', direction: 'left' });
    this.keyMappings.set('right', { type: 'move', direction: 'right' });

    // 选择和操作
    this.keyMappings.set('return', { type: 'select' });
    this.keyMappings.set('space', { type: 'select', data: { preview: true } });

    // 搜索和过滤
    this.keyMappings.set('/', { type: 'search' });
    this.keyMappings.set('f', { type: 'filter' });
    this.keyMappings.set('F', { type: 'filter' });

    // 帮助和退出
    this.keyMappings.set('?', { type: 'help' });
    this.keyMappings.set('escape', { type: 'exit' });

    // 视图模式
    this.keyMappings.set('1', {
      type: 'custom',
      data: { action: 'viewMode', mode: 'list' },
    });
    this.keyMappings.set('2', {
      type: 'custom',
      data: { action: 'viewMode', mode: 'grid' },
    });
    this.keyMappings.set('3', {
      type: 'custom',
      data: { action: 'viewMode', mode: 'detail' },
    });
  }

  updateState(newState: Partial<NavigationState>): void {
    this.state = { ...this.state, ...newState };
    this.updateNavigationCapabilities();
    this.emit('stateChanged', this.state);
  }

  private updateNavigationCapabilities(): void {
    this.state.canNavigateUp = this.state.selectedIndex > 0;
    this.state.canNavigateDown = this.state.selectedIndex < this.state.totalItems - 1;
  }

  handleKeyPress(input: string, key: any): boolean {
    let keyName = '';

    // 确定按键名称
    if (key.upArrow) keyName = 'up';
    else if (key.downArrow) keyName = 'down';
    else if (key.leftArrow) keyName = 'left';
    else if (key.rightArrow) keyName = 'right';
    else if (key.return) keyName = 'return';
    else if (key.escape) keyName = 'escape';
    else if (input === ' ') keyName = 'space';
    else keyName = input.toLowerCase();

    const action = this.keyMappings.get(keyName);
    if (!action) {
      // 检查自定义处理器
      const customHandler = this.customHandlers.get(keyName);
      if (customHandler) {
        customHandler();
        return true;
      }
      return false;
    }

    return this.executeAction(action);
  }

  private executeAction(action: NavigationAction): boolean {
    switch (action.type) {
      case 'move':
        return this.handleMove(action.direction!);

      case 'select':
        this.emit('select', { index: this.state.selectedIndex, data: action.data });
        return true;

      case 'search':
        this.emit('search');
        return true;

      case 'filter':
        this.emit('filter');
        return true;

      case 'help':
        this.emit('help');
        return true;

      case 'exit':
        this.emit('exit');
        return true;

      case 'custom':
        this.emit('custom', action.data);
        return true;

      default:
        return false;
    }
  }

  private handleMove(direction: string): boolean {
    let newIndex = this.state.selectedIndex;

    switch (direction) {
      case 'up':
        if (this.state.canNavigateUp) {
          newIndex = Math.max(0, this.state.selectedIndex - 1);
        }
        break;

      case 'down':
        if (this.state.canNavigateDown) {
          newIndex = Math.min(this.state.totalItems - 1, this.state.selectedIndex + 1);
        }
        break;

      case 'left':
        if (this.state.canNavigateLeft) {
          this.emit('navigateLeft');
          return true;
        }
        break;

      case 'right':
        if (this.state.canNavigateRight) {
          this.emit('navigateRight');
          return true;
        }
        break;
    }

    if (newIndex !== this.state.selectedIndex) {
      this.updateState({ selectedIndex: newIndex });
      this.emit('move', {
        oldIndex: this.state.selectedIndex,
        newIndex,
        direction,
      });
      return true;
    }

    return false;
  }

  // 注册自定义按键处理器
  registerCustomHandler(key: string, handler: (data?: any) => void): void {
    this.customHandlers.set(key.toLowerCase(), handler);
  }

  // 注册自定义按键映射
  registerKeyMapping(key: string, action: NavigationAction): void {
    this.keyMappings.set(key.toLowerCase(), action);
  }

  // 获取当前状态
  getState(): NavigationState {
    return { ...this.state };
  }

  // 重置状态
  reset(): void {
    this.updateState({
      selectedIndex: 0,
      totalItems: 0,
      canNavigateUp: false,
      canNavigateDown: false,
      canNavigateLeft: false,
      canNavigateRight: false,
    });
  }
}
