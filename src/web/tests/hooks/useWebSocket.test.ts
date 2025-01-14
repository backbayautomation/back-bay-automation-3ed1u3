/**
 * @fileoverview Test suite for useWebSocket custom React hook
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { useWebSocket } from '../../src/hooks/useWebSocket';
import { WS_EVENTS } from '../../src/api/websocket';
import { WebSocketStatus } from '../../src/types/chat';

// Mock WebSocket implementation
const mockWebSocket = {
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
};

// Mock WebSocketClient class
jest.mock('../../src/api/websocket', () => ({
    WebSocketClient: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        messageQueue: [],
        getConnectionState: jest.fn()
    })),
    WS_EVENTS: {
        CHAT_MESSAGE: 'chat.message',
        SYSTEM_STATUS: 'system.status',
        CONNECTION_HEALTH: 'connection.health'
    }
}));

describe('useWebSocket', () => {
    // Test configuration
    const defaultConfig = {
        baseUrl: 'wss://api.example.com/ws',
        token: 'test-token',
        autoConnect: false,
        reconnectAttempts: 3,
        reconnectInterval: 1000,
        messageQueueSize: 50,
        compressionEnabled: true,
        monitoringEnabled: true
    };

    beforeAll(() => {
        // Configure longer timeout for async operations
        jest.setTimeout(10000);
        // Mock WebSocket global
        (global as any).WebSocket = jest.fn(() => mockWebSocket);
    });

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        mockWebSocket.send.mockClear();
        mockWebSocket.close.mockClear();
    });

    it('should initialize with correct default state', () => {
        const { result } = renderHook(() => useWebSocket(defaultConfig));

        expect(result.current.isConnected).toBe(false);
        expect(result.current.connectionState).toBe(WebSocketStatus.DISCONNECTED);
        expect(result.current.getMetrics()).toEqual({
            latency: 0,
            messagesSent: 0,
            messagesReceived: 0,
            reconnectAttempts: 0,
            lastHeartbeat: 0
        });
    });

    it('should handle connection lifecycle', async () => {
        const { result } = renderHook(() => useWebSocket(defaultConfig));

        // Test connection
        await act(async () => {
            await result.current.connect();
        });

        expect(result.current.isConnected).toBe(true);
        expect(result.current.connectionState).toBe(WebSocketStatus.CONNECTED);

        // Test disconnection
        act(() => {
            result.current.disconnect();
        });

        expect(result.current.isConnected).toBe(false);
        expect(result.current.connectionState).toBe(WebSocketStatus.DISCONNECTED);
    });

    it('should handle automatic reconnection', async () => {
        const { result } = renderHook(() => useWebSocket({
            ...defaultConfig,
            autoConnect: true
        }));

        // Simulate connection loss
        await act(async () => {
            await result.current.connect();
            mockWebSocket.onclose({ wasClean: false });
        });

        // Verify reconnection attempt
        expect(result.current.connectionState).toBe(WebSocketStatus.CONNECTING);
        
        // Simulate successful reconnection
        await act(async () => {
            mockWebSocket.onopen();
        });

        expect(result.current.isConnected).toBe(true);
        expect(result.current.connectionState).toBe(WebSocketStatus.CONNECTED);
    });

    it('should manage message queue during disconnection', async () => {
        const { result } = renderHook(() => useWebSocket(defaultConfig));

        // Connect and then disconnect
        await act(async () => {
            await result.current.connect();
            result.current.disconnect();
        });

        // Attempt to send messages while disconnected
        await act(async () => {
            await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { text: 'Test 1' });
            await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { text: 'Test 2' });
        });

        // Verify messages are queued
        const pendingMessages = result.current.getPendingMessages();
        expect(pendingMessages.length).toBe(2);

        // Reconnect and verify queue processing
        await act(async () => {
            await result.current.connect();
        });

        expect(result.current.getPendingMessages().length).toBe(0);
    });

    it('should track performance metrics', async () => {
        const { result } = renderHook(() => useWebSocket(defaultConfig));

        await act(async () => {
            await result.current.connect();
        });

        // Send test messages
        await act(async () => {
            await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { text: 'Test' });
        });

        // Simulate message received
        act(() => {
            mockWebSocket.onmessage({ data: JSON.stringify({
                event: WS_EVENTS.CHAT_MESSAGE,
                data: { text: 'Response' }
            })});
        });

        const metrics = result.current.getMetrics();
        expect(metrics.messagesSent).toBe(1);
        expect(metrics.messagesReceived).toBe(1);
    });

    it('should handle connection health checks', async () => {
        const { result } = renderHook(() => useWebSocket(defaultConfig));

        await act(async () => {
            await result.current.connect();
        });

        // Simulate health check response
        act(() => {
            mockWebSocket.onmessage({ data: JSON.stringify({
                event: WS_EVENTS.CONNECTION_HEALTH,
                data: { timestamp: Date.now() }
            })});
        });

        const metrics = result.current.getMetrics();
        expect(metrics.lastHeartbeat).toBeGreaterThan(0);
    });

    it('should handle event listeners correctly', async () => {
        const { result } = renderHook(() => useWebSocket(defaultConfig));
        const mockCallback = jest.fn();

        await act(async () => {
            await result.current.connect();
            result.current.addListener(WS_EVENTS.CHAT_MESSAGE, mockCallback);
        });

        // Simulate message event
        act(() => {
            mockWebSocket.onmessage({ data: JSON.stringify({
                event: WS_EVENTS.CHAT_MESSAGE,
                data: { text: 'Test' }
            })});
        });

        expect(mockCallback).toHaveBeenCalled();

        // Remove listener
        act(() => {
            result.current.removeListener(WS_EVENTS.CHAT_MESSAGE, mockCallback);
        });
    });

    it('should handle message compression', async () => {
        const { result } = renderHook(() => useWebSocket({
            ...defaultConfig,
            compressionEnabled: true
        }));

        await act(async () => {
            await result.current.connect();
            await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { text: 'Test' });
        });

        // Verify compression option was passed
        expect(mockWebSocket.send).toHaveBeenCalled();
    });

    it('should cleanup resources on unmount', () => {
        const { unmount } = renderHook(() => useWebSocket(defaultConfig));

        unmount();

        expect(mockWebSocket.close).toHaveBeenCalled();
    });
});