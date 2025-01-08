/**
 * Test suite for useWebSocket custom React hook
 * Version: 1.0.0
 * Dependencies:
 * - @testing-library/react: ^14.0.0
 * - @testing-library/react-hooks: ^8.0.1
 * - jest: ^29.6.3
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useWebSocket, ConnectionState, UseWebSocketOptions } from '../../src/hooks/useWebSocket';
import { WS_EVENTS } from '../../src/api/websocket';

// Mock WebSocket implementation
class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  readyState: number = WebSocket.CLOSED;
  send = jest.fn();
  close = jest.fn();
}

// Mock WebSocketClient
jest.mock('../../src/api/websocket', () => {
  return {
    WebSocketClient: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn(),
      getConnectionState: jest.fn(),
      getMetrics: jest.fn()
    })),
    WS_EVENTS: {
      CHAT_MESSAGE: 'chat.message',
      SYSTEM_STATUS: 'system.status',
      CONNECTION_HEALTH: 'connection.health',
      ERROR: 'error'
    }
  };
});

describe('useWebSocket', () => {
  // Default hook options
  const defaultOptions: UseWebSocketOptions = {
    baseUrl: 'wss://api.example.com/ws',
    token: 'test-token',
    autoConnect: true,
    reconnectAttempts: 5,
    reconnectInterval: 1000,
    messageQueueSize: 100,
    compressionEnabled: false,
    monitoringEnabled: true
  };

  // Test timeouts
  const TEST_TIMEOUTS = {
    CONNECTION: 5000,
    RECONNECTION: 3000,
    MESSAGE: 1000,
    HEALTH_CHECK: 2000
  };

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useWebSocket(defaultOptions));

    expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED);
    expect(result.current.isConnected).toBe(false);
    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.getMetrics).toBe('function');
  });

  it('should auto-connect when autoConnect is true', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useWebSocket(defaultOptions)
    );

    await waitForNextUpdate({ timeout: TEST_TIMEOUTS.CONNECTION });

    expect(result.current.connectionState).toBe(ConnectionState.CONNECTED);
    expect(result.current.isConnected).toBe(true);
  });

  it('should handle manual connection and disconnection', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useWebSocket({ ...defaultOptions, autoConnect: false })
    );

    // Test manual connection
    act(() => {
      result.current.connect();
    });

    await waitForNextUpdate({ timeout: TEST_TIMEOUTS.CONNECTION });
    expect(result.current.connectionState).toBe(ConnectionState.CONNECTED);

    // Test manual disconnection
    act(() => {
      result.current.disconnect();
    });

    await waitForNextUpdate();
    expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED);
  });

  it('should handle message sending when connected', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useWebSocket(defaultOptions)
    );

    await waitForNextUpdate({ timeout: TEST_TIMEOUTS.CONNECTION });

    await act(async () => {
      await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, {
        content: 'Test message'
      });
    });

    const metrics = result.current.getMetrics();
    expect(metrics.messagesSent).toBeGreaterThan(0);
  });

  it('should queue messages when disconnected', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useWebSocket(defaultOptions)
    );

    // Disconnect first
    act(() => {
      result.current.disconnect();
    });
    await waitForNextUpdate();

    // Send message while disconnected
    await act(async () => {
      await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, {
        content: 'Queued message'
      });
    });

    const pendingMessages = result.current.getPendingMessages();
    expect(pendingMessages.length).toBe(1);
    expect(pendingMessages[0].event).toBe(WS_EVENTS.CHAT_MESSAGE);
  });

  it('should handle automatic reconnection', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useWebSocket(defaultOptions)
    );

    await waitForNextUpdate({ timeout: TEST_TIMEOUTS.CONNECTION });

    // Simulate connection loss
    act(() => {
      const event = new CloseEvent('close', { code: 1006 });
      (result.current as any).wsClientRef.current.onclose(event);
    });

    await waitForNextUpdate({ timeout: TEST_TIMEOUTS.RECONNECTION });

    expect(result.current.connectionState).toBe(ConnectionState.CONNECTED);
  });

  it('should track performance metrics', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useWebSocket(defaultOptions)
    );

    await waitForNextUpdate({ timeout: TEST_TIMEOUTS.CONNECTION });

    // Send test messages
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, {
          content: `Message ${i}`
        });
      }
    });

    const metrics = result.current.getMetrics();
    expect(metrics.messagesSent).toBe(5);
    expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    expect(metrics.lastHeartbeat).toBeGreaterThan(0);
  });

  it('should handle connection health checks', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useWebSocket(defaultOptions)
    );

    await waitForNextUpdate({ timeout: TEST_TIMEOUTS.CONNECTION });

    // Simulate health check response
    act(() => {
      (result.current as any).wsClientRef.current.emit(
        WS_EVENTS.CONNECTION_HEALTH,
        { connected: true }
      );
    });

    await waitForNextUpdate({ timeout: TEST_TIMEOUTS.HEALTH_CHECK });

    const metrics = result.current.getMetrics();
    expect(metrics.lastHeartbeat).toBeGreaterThan(0);
  });

  it('should respect message queue size limit', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useWebSocket({ ...defaultOptions, messageQueueSize: 2 })
    );

    // Disconnect to enable queueing
    act(() => {
      result.current.disconnect();
    });
    await waitForNextUpdate();

    // Try to queue more messages than allowed
    await act(async () => {
      await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { content: 'Message 1' });
      await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { content: 'Message 2' });
      await expect(
        result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { content: 'Message 3' })
      ).rejects.toThrow('Message queue full');
    });

    const pendingMessages = result.current.getPendingMessages();
    expect(pendingMessages.length).toBe(2);
  });

  it('should clean up resources on unmount', async () => {
    const { result, waitForNextUpdate, unmount } = renderHook(() => 
      useWebSocket(defaultOptions)
    );

    await waitForNextUpdate({ timeout: TEST_TIMEOUTS.CONNECTION });

    unmount();

    expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED);
  });
});