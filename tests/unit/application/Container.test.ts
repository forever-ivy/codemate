import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from '@/application/Container';

/**
 * Container 的测试
 *
 * 测试所有功能是否正常工作
 */ describe('Container', () => {
  // 每个测试前都创建新的容器
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  /**
   * 测试：注册和获取服务
   */
  it('should register and get service', () => {
    // 1. 准备：创建一个测试服务
    const service = { name: 'test', value: 42 };

    // 2. 执行：注册服务
    container.register('test', service);

    // 3. 验证：能正确获取服务
    const retrieved = container.get<typeof service>('test');
    expect(retrieved).toBe(service); // 应该是同一个对象
    expect(retrieved.value).toBe(42); // 值应该是 42
  });

  /**
   * 测试：重复注册应该报错
   */
  it('should throw error when registering duplicate service', () => {
    // 1. 先注册一次
    container.register('test', { name: 'test' });

    // 2. 再注册一次，应该抛出错误
    expect(() => {
      container.register('test', { name: 'test2' });
    }).toThrow('Service test already registered');
  });

  /**
   * 测试：获取不存在的服务应该报错
   */
  it('should throw error when getting non-existent service', () => {
    expect(() => {
      container.get('nonexistent');
    }).toThrow('Service not found: nonexistent');
  });

  /**
   * 测试：检查服务是否存在
   */
  it('should check if service exists', () => {
    // 1. 一开始不存在
    expect(container.has('test')).toBe(false);

    // 2. 注册后存在
    container.register('test', { name: 'test' });
    expect(container.has('test')).toBe(true);
  });

  /**
   * 测试：列出所有服务
   */
  it('should list all services', () => {
    // 1. 注册两个服务
    container.register('service1', { name: 'service1' });
    container.register('service2', { name: 'service2' });

    // 2. 列出服务，应该包含这两个
    const services = container.list();
    expect(services).toEqual(['service1', 'service2']);
  });
});
