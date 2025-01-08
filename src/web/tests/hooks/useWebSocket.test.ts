/**
 * @fileoverview Test suite for useWebSocket custom React hook
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { useWebSocket, ConnectionState } from '../../src/hooks/useWebSocket';
import { WS_EVENTS } from '../../src/api/websocket';

// Mock WebSocket implementation
const mockWebSocket = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    getMetrics: jest.fn()
};

// Mock configuration for tests
const TEST_CONFIG = {
    baseUrl: 'wss://api.example.com/ws',
    token: 'test-token',
    autoConnect: false,
    reconnectAttempts: 3,
    reconnectInterval: 1000,
    messageQueueSize: 50,
    compressionEnabled: true,
    monitoringEnabled: true
};

describe('useWebSocket', () => {
    // Configure longer timeout for async operations
    jest.setTimeout(10000);

    beforeAll(() => {
        // Mock WebSocket client implementation
        jest.mock('../../src/api/websocket', () => ({
            WebSocketClient: jest.fn().mockImplementation(() => mockWebSocket),
            WS_EVENTS
        }));
    });

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        mockWebSocket.connect.mockResolvedValue(undefined);
        mockWebSocket.send.mockResolvedValue(undefined);
    });

    afterEach(() => {
        // Cleanup after each test
        jest.clearAllTimers();
    });

    it('should initialize with correct default state', () => {
        const { result } = renderHook(() => useWebSocket(TEST_CONFIG));

        expect(result.current.isConnected).toBe(false);
        expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED);
        expect(typeof result.current.connect).toBe('function');
        expect(typeof result.current.disconnect).toBe('function');
        expect(typeof result.current.sendMessage).toBe('function');
    });

    it('should handle connection lifecycle', async () => {
        const { result } = renderHook(() => useWebSocket(TEST_CONFIG));

        // Test connection
        await act(async () => {
            await result.current.connect();
        });

        expect(mockWebSocket.connect).toHaveBeenCalled();
        expect(result.current.connectionState).toBe(ConnectionState.CONNECTED);
        expect(result.current.isConnected).toBe(true);

        // Test disconnection
        act(() => {
            result.current.disconnect();
        });

        expect(mockWebSocket.disconnect).toHaveBeenCalled();
        expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED);
        expect(result.current.isConnected).toBe(false);
    });

    it('should handle automatic reconnection', async () => {
        const { result } = renderHook(() => useWebSocket({
            ...TEST_CONFIG,
            autoConnect: true
        }));

        // Simulate connection failure
        mockWebSocket.connect.mockRejectedValueOnce(new Error('Connection failed'));

        await act(async () => {
            try {
                await result.current.connect();
            } catch (error) {
                // Expected error
            }
        });

        expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED);
        expect(mockWebSocket.connect).toHaveBeenCalledTimes(1);
    });

    it('should manage message queue during disconnection', async () => {
        const { result } = renderHook(() => useWebSocket(TEST_CONFIG));

        // Send message while disconnected
        await act(async () => {
            try {
                await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { text: 'Test message' });
            } catch (error) {
                // Expected error
            }
        });

        // Verify message was queued
        expect(result.current.getPendingMessages()).toHaveLength(1);
        expect(result.current.getPendingMessages()[0]).toMatchObject({
            event: WS_EVENTS.CHAT_MESSAGE,
            data: { text: 'Test message' }
        });

        // Connect and verify queue processing
        await act(async () => {
            await result.current.connect();
        });

        expect(mockWebSocket.send).toHaveBeenCalled();
        expect(result.current.getPendingMessages()).toHaveLength(0);
    });

    it('should track performance metrics', async () => {
        const { result } = renderHook(() => useWebSocket(TEST_CONFIG));

        await act(async () => {
            await result.current.connect();
        });

        // Send test messages
        await act(async () => {
            await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { text: 'Message 1' });
            await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { text: 'Message 2' });
        });

        const metrics = result.current.getMetrics();
        expect(metrics).toMatchObject({
            messagesSent: expect.any(Number),
            messagesReceived: expect.any(Number),
            latency: expect.any(Number),
            uptime: expect.any(Number)
        });
    });

    it('should handle connection health checks', async () => {
        const { result } = renderHook(() => useWebSocket(TEST_CONFIG));

        await act(async () => {
            await result.current.connect();
        });

        // Simulate health check response
        act(() => {
            mockWebSocket.on.mock.calls
                .find(([event]) => event === WS_EVENTS.CONNECTION_HEALTH)[1]({
                    status: 'connected'
                });
        });

        expect(result.current.isConnected).toBe(true);
        expect(result.current.getMetrics().lastHeartbeat).toBeTruthy();
    });

    it('should handle event listeners correctly', async () => {
        const { result } = renderHook(() => useWebSocket(TEST_CONFIG));
        const mockCallback = jest.fn();

        // Add listener
        act(() => {
            result.current.addListener(WS_EVENTS.CHAT_MESSAGE, mockCallback);
        });

        expect(mockWebSocket.on).toHaveBeenCalledWith(WS_EVENTS.CHAT_MESSAGE, mockCallback);

        // Remove listener
        act(() => {
            result.current.removeListener(WS_EVENTS.CHAT_MESSAGE, mockCallback);
        });

        expect(mockWebSocket.off).toHaveBeenCalledWith(WS_EVENTS.CHAT_MESSAGE, mockCallback);
    });

    it('should handle message compression when enabled', async () => {
        const { result } = renderHook(() => useWebSocket({
            ...TEST_CONFIG,
            compressionEnabled: true
        }));

        await act(async () => {
            await result.current.connect();
            await result.current.sendMessage(WS_EVENTS.CHAT_MESSAGE, { text: 'Compressed message' });
        });

        expect(mockWebSocket.send).toHaveBeenCalledWith(
            WS_EVENTS.CHAT_MESSAGE,
            { text: 'Compressed message' },
            expect.objectContaining({ compress: true })
        );
    });

    it('should cleanup resources on unmount', () => {
        const { unmount } = renderHook(() => useWebSocket(TEST_CONFIG));

        unmount();

        expect(mockWebSocket.disconnect).toHaveBeenCalled();
    });
});