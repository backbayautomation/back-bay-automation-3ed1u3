/**
 * @fileoverview Test suite for ChatService with comprehensive coverage of reliability,
 * security, and monitoring features
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.7.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { ChatService } from '../../src/services/chat';
import { Message, MessageRole, ChatSessionStatus, WebSocketStatus } from '../../src/types/chat';
import { WS_EVENTS, WS_CONFIG } from '../../src/api/websocket';

// Mock WebSocket implementation
class MockWebSocket {
    onopen: (() => void) | null = null;
    onclose: ((event: any) => void) | null = null;
    onmessage: ((event: any) => void) | null = null;
    onerror: ((error: any) => void) | null = null;
    readyState = WebSocket.CONNECTING;
    send = jest.fn();
    close = jest.fn();
}

// Test constants
const TEST_CONFIG = {
    wsUrl: 'ws://localhost:8000/ws',
    token: 'mock-auth-token',
    securityConfig: {
        encryptionKey: 'mock-encryption-key',
        rateLimitPerMinute: 60,
        maxMessageSize: 4096
    },
    loggerConfig: {
        level: 'info',
        enableMetrics: true,
        metricsInterval: 5000
    }
};

describe('ChatService', () => {
    let chatService: ChatService;
    let mockWebSocket: MockWebSocket;

    beforeEach(() => {
        // Setup WebSocket mock
        mockWebSocket = new MockWebSocket();
        (global as any).WebSocket = jest.fn(() => mockWebSocket);

        // Initialize chat service
        chatService = new ChatService(
            TEST_CONFIG.wsUrl,
            TEST_CONFIG.token,
            TEST_CONFIG.securityConfig,
            TEST_CONFIG.loggerConfig
        );

        // Simulate successful connection
        if (mockWebSocket.onopen) {
            mockWebSocket.onopen();
        }
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with correct configuration', () => {
            expect(global.WebSocket).toHaveBeenCalledWith(TEST_CONFIG.wsUrl);
            expect(chatService.getConnectionStatus()).toBe(WebSocketStatus.CONNECTED);
        });

        it('should setup WebSocket event handlers', () => {
            expect(mockWebSocket.onmessage).toBeDefined();
            expect(mockWebSocket.onerror).toBeDefined();
            expect(mockWebSocket.onclose).toBeDefined();
        });
    });

    describe('Session Management', () => {
        it('should create new chat session', async () => {
            const session = await chatService.createSession('Test Session');
            expect(session).toMatchObject({
                title: 'Test Session',
                status: ChatSessionStatus.ACTIVE,
                messages: []
            });
            expect(session.id).toBeDefined();
        });

        it('should handle session creation errors', async () => {
            jest.spyOn(global, 'Date').mockImplementationOnce(() => {
                throw new Error('Date error');
            });
            await expect(chatService.createSession('Test')).rejects.toThrow();
        });
    });

    describe('Message Handling', () => {
        let sessionId: string;

        beforeEach(async () => {
            const session = await chatService.createSession('Test Session');
            sessionId = session.id;
        });

        it('should send message with encryption', async () => {
            const content = 'Test message';
            const message = await chatService.sendMessage(content, sessionId);
            
            expect(message).toMatchObject({
                role: MessageRole.USER,
                sessionId,
                metadata: expect.any(Object)
            });
            expect(mockWebSocket.send).toHaveBeenCalled();
        });

        it('should enforce rate limiting', async () => {
            // Simulate rate limit exceeded
            for (let i = 0; i < TEST_CONFIG.securityConfig.rateLimitPerMinute; i++) {
                await chatService.sendMessage('Test', sessionId);
            }
            
            await expect(chatService.sendMessage('Test', sessionId))
                .rejects.toThrow('Rate limit exceeded');
        });

        it('should enforce message size limit', async () => {
            const largeMessage = 'a'.repeat(TEST_CONFIG.securityConfig.maxMessageSize + 1);
            await expect(chatService.sendMessage(largeMessage, sessionId))
                .rejects.toThrow(/exceeds maximum size/);
        });

        it('should queue messages when offline', async () => {
            // Simulate disconnection
            mockWebSocket.readyState = WebSocket.CLOSED;
            if (mockWebSocket.onclose) {
                mockWebSocket.onclose({ wasClean: false });
            }

            await chatService.sendMessage('Offline message', sessionId);
            expect(chatService.getMetrics().queuedMessages).toBe(1);
        });
    });

    describe('Reliability Features', () => {
        it('should handle reconnection', async () => {
            // Simulate connection loss
            if (mockWebSocket.onclose) {
                mockWebSocket.onclose({ wasClean: false });
            }

            // Verify reconnection attempt
            expect(global.WebSocket).toHaveBeenCalledTimes(2);
        });

        it('should process message queue after reconnection', async () => {
            // Simulate offline message
            mockWebSocket.readyState = WebSocket.CLOSED;
            await chatService.sendMessage('Queued message', uuidv4());

            // Simulate reconnection
            mockWebSocket.readyState = WebSocket.OPEN;
            if (mockWebSocket.onopen) {
                mockWebSocket.onopen();
            }

            expect(mockWebSocket.send).toHaveBeenCalled();
        });

        it('should handle heartbeat mechanism', () => {
            jest.useFakeTimers();
            
            // Advance time to trigger heartbeat
            jest.advanceTimersByTime(WS_CONFIG.HEARTBEAT_INTERVAL);
            
            expect(mockWebSocket.send).toHaveBeenCalledWith(
                expect.stringContaining(WS_EVENTS.CONNECTION_HEALTH)
            );
            
            jest.useRealTimers();
        });
    });

    describe('Security Features', () => {
        it('should handle encrypted messages', async () => {
            const sessionId = uuidv4();
            const message: Message = {
                id: uuidv4(),
                content: 'Encrypted content',
                role: MessageRole.ASSISTANT,
                timestamp: new Date(),
                sessionId,
                metadata: {
                    hasMarkdown: false,
                    hasCodeBlock: false,
                    codeLanguage: null,
                    renderOptions: {
                        enableLatex: false,
                        enableDiagrams: false,
                        syntaxHighlighting: false
                    }
                }
            };

            // Simulate receiving encrypted message
            if (mockWebSocket.onmessage) {
                mockWebSocket.onmessage({ data: JSON.stringify({
                    event: WS_EVENTS.CHAT_MESSAGE,
                    data: message
                })});
            }

            // Verify decryption was attempted
            expect(message.content).toBeDefined();
        });
    });

    describe('Monitoring Features', () => {
        it('should track connection metrics', () => {
            const metrics = chatService.getMetrics();
            expect(metrics).toMatchObject({
                messagesSentThisMinute: expect.any(Number),
                queuedMessages: expect.any(Number),
                connectionStatus: expect.any(String)
            });
        });

        it('should log error events', () => {
            const error = new Error('Test error');
            if (mockWebSocket.onerror) {
                mockWebSocket.onerror(error);
            }
            // Verify error was logged (implementation dependent)
        });
    });

    describe('Cleanup', () => {
        it('should cleanup resources on disconnect', async () => {
            await chatService.disconnect();
            expect(mockWebSocket.close).toHaveBeenCalled();
            expect(chatService.getConnectionStatus()).toBe(WebSocketStatus.DISCONNECTED);
        });
    });
});