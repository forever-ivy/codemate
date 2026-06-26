import { useCallback, useEffect } from 'react';
import type { EventBus } from '../../services/EventBus';
import type { SessionService } from '../../services/SessionService';
import { EventType, type Session } from '../../types/index';
import { useAppContext } from '../context/AppContext';

interface SessionEventPayload {
  session: Session;
}

/**
 * useSession Hook
 *
 * 管理会话的加载、创建和更新
 */
export function useSession() {
  const { app, currentSession, setCurrentSession, setSessions } = useAppContext();

  // 获取服务
  const sessionService = app.getContainer().get<SessionService>('session');
  const eventBus = app.getContainer().get<EventBus>('eventBus');

  const syncCurrentSession = useCallback(() => {
    const session = sessionService.getCurrent();
    if (!session) {
      return;
    }

    setCurrentSession({
      ...session,
      messages: session.messages.slice() as typeof session.messages,
      config: session.config ? { ...session.config } : undefined,
    });

    setSessions(sessionService.list());
  }, [sessionService, setCurrentSession, setSessions]);

  /**
   * 初始化会话
   *
   * 启动时执行:
   * 1. 读取历史会话列表，供 /resume 选择。
   * 2. 默认创建新会话，避免启动后直接铺开上次对话。
   * 3. 历史续接必须由用户通过 /resume 显式触发。
   */
  useEffect(() => {
    const initSession = async () => {
      try {
        // 1. 获取所有会话
        const allSessions = sessionService.list();
        setSessions(allSessions);

        // 2. 每次启动都创建空会话。用户需要历史时再用 /resume。
        const session = await sessionService.create('New conversation');
        setCurrentSession(session);

        // 3. 新会话也要进入列表，后续 /resume 才能看到它。
        const updatedSessions = sessionService.list();
        setSessions(updatedSessions);

        console.log(`✅ Created new session: ${session.id}`);
      } catch (error) {
        console.error('❌ Failed to initialize session:', error);

        // 持久化不可用时退化为内存会话，避免重试同一个失败写入。
        setCurrentSession({
          id: `transient-${Date.now()}`,
          messages: [],
          config: { summary: 'Transient conversation' },
        });
      }
    };

    initSession();
  }, [sessionService, setCurrentSession, setSessions]);

  /**
   * 监听会话事件
   *
   * 当会话发生变化时,自动更新 UI
   */
  useEffect(() => {
    // 监听会话创建
    const handleSessionCreated = (data: SessionEventPayload) => {
      setCurrentSession(data.session);
      const updatedSessions = sessionService.list();
      setSessions(updatedSessions);
    };

    // 监听会话加载
    const handleSessionLoaded = (data: SessionEventPayload) => {
      setCurrentSession(data.session);
    };

    const handleMessageSent = () => {
      syncCurrentSession();
    };

    const handleSessionSaved = () => {
      syncCurrentSession();
    };

    const handleSessionUpdated = () => {
      syncCurrentSession();
    };

    const handleSessionResumed = () => {
      syncCurrentSession();
    };

    // 注册监听器
    eventBus.on(EventType.SESSION_CREATED, handleSessionCreated);
    eventBus.on(EventType.SESSION_LOADED, handleSessionLoaded);
    eventBus.on(EventType.MESSAGE_SENT, handleMessageSent);
    eventBus.on(EventType.SESSION_SAVED, handleSessionSaved);
    eventBus.on('session_updated', handleSessionUpdated);
    eventBus.on('session:resumed', handleSessionResumed);

    // 清理监听器
    return () => {
      eventBus.off(EventType.SESSION_CREATED, handleSessionCreated);
      eventBus.off(EventType.SESSION_LOADED, handleSessionLoaded);
      eventBus.off(EventType.MESSAGE_SENT, handleMessageSent);
      eventBus.off(EventType.SESSION_SAVED, handleSessionSaved);
      eventBus.off('session_updated', handleSessionUpdated);
      eventBus.off('session:resumed', handleSessionResumed);
    };
  }, [sessionService, eventBus, setCurrentSession, setSessions, syncCurrentSession]);

  return {
    currentSession,
    sessionService,
  };
}
