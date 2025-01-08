/**
 * ChatService Test Suite
 * Version: 1.0.0
 * Dependencies:
 * - @jest/globals: 29.7.0
 * - uuid: 9.0.0
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../../src/services/chat';
import { Message, MessageRole, ChatSessionStatus, WebSocketStatus } from '../../src/types/chat';
import { WS_EVENTS, WS_CONFIG } from '../../src/api/websocket';

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

// Test configuration
const TEST_CONFIG = {
    wsUrl: 'ws://localhost:8080',
    token: 'test-token',
    securityConfig: {
        encryptionKey: 'test-key',
        enableMessageSigning: true
    },
    loggerConfig: {
        level: 'info',
        enableMetrics: true
    }
};

describe('ChatService', () => {
    let chatService: ChatService;
    let mockWebSocket: MockWebSocket;

    beforeEach(() => {
        // Setup mock WebSocket
        mockWebSocket = new MockWebSocket();
        (global as any).WebSocket = jest.fn(() => mockWebSocket);
        
        // Initialize ChatService
        chatService = new ChatService(TEST_CONFIG);
        
        // Mock successful connection
        if (mockWebSocket.onopen) {
            mockWebSocket.onopen();
        }
    });

    afterEach(() => {
        jest.clearAllMocks();
        if (chatService) {
            chatService.disconnect();
        }
    });

    describe('Connection Management', () => {
        it('should establish WebSocket connection with correct configuration', async () => {
            expect(global.WebSocket).toHaveBeenCalledWith(
                expect.stringContaining(TEST_CONFIG.wsUrl)
            );
            expect(global.WebSocket).toHaveBeenCalledWith(
                expect.stringContaining(TEST_CONFIG.token)
            );
        });

        it('should handle reconnection attempts with exponential backoff', async () => {
            const mockClose = { code: 1006, reason: 'Connection lost' };
            if (mockWebSocket.onclose) {
                mockWebSocket.onclose(mockClose);
            }

            // Wait for reconnection attempts
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(global.WebSocket).toHaveBeenCalledTimes(2);
        });

        it('should maintain heartbeat mechanism', async () => {
            jest.useFakeTimers();
            
            // Trigger heartbeat interval
            jest.advanceTimersByTime(WS_CONFIG.HEARTBEAT_INTERVAL);

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                expect.stringContaining(WS_EVENTS.CONNECTION_HEALTH)
            );

            jest.useRealTimers();
        });
    });

    describe('Message Handling', () => {
        it('should send messages with proper encryption', async () => {
            const testMessage = {
                content: 'Test message',
                sessionId: uuidv4()
            };

            await chatService.sendMessage(testMessage.content, testMessage.sessionId);

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                expect.stringContaining(testMessage.content)
            );
        });

        it('should queue messages when offline', async () => {
            // Simulate disconnection
            mockWebSocket.readyState = WebSocket.CLOSED;
            if (mockWebSocket.onclose) {
                mockWebSocket.onclose({ code: 1001, reason: 'Test disconnect' });
            }

            const testMessage = {
                content: 'Offline message',
                sessionId: uuidv4()
            };

            await expect(
                chatService.sendMessage(testMessage.content, testMessage.sessionId)
            ).rejects.toThrow();

            // Verify message is queued
            expect(chatService.getMetrics().queueLength).toBeGreaterThan(0);
        });

        it('should handle rate limiting', async () => {
            const sessionId = uuidv4();
            const messages = Array(61).fill('Test message');

            // Send messages rapidly
            const sendPromises = messages.map(msg => 
                chatService.sendMessage(msg, sessionId)
            );

            await expect(Promise.all(sendPromises)).rejects.toThrow('Rate limit exceeded');
        });
    });

    describe('Session Management', () => {
        it('should create new chat session with security context', async () => {
            const session = await chatService.createSession('Test Session');

            expect(session).toMatchObject({
                title: 'Test Session',
                status: ChatSessionStatus.ACTIVE,
                messages: []
            });
        });

        it('should load chat history correctly', async () => {
            const session = await chatService.createSession('Test Session');
            const message: Message = {
                id: uuidv4(),
                content: 'Test message',
                role: MessageRole.USER,
                timestamp: new Date(),
                sessionId: session.id,
                metadata: {
                    hasMarkdown: false,
                    hasCodeBlock: false,
                    codeLanguage: null,
                    renderOptions: {
                        enableLatex: true,
                        enableDiagrams: true,
                        syntaxHighlighting: true
                    }
                }
            };

            // Simulate incoming message
            if (mockWebSocket.onmessage) {
                mockWebSocket.onmessage({
                    data: JSON.stringify({
                        event: WS_EVENTS.CHAT_MESSAGE,
                        data: message
                    })
                });
            }

            expect(session.messages).toContainEqual(expect.objectContaining({
                content: message.content
            }));
        });
    });

    describe('Monitoring and Metrics', () => {
        it('should track connection metrics', () => {
            const metrics = chatService.getMetrics();

            expect(metrics).toMatchObject({
                messageCount: expect.any(Number),
                queueLength: expect.any(Number),
                connectionStatus: expect.any(String)
            });
        });

        it('should handle and log errors appropriately', async () => {
            const mockError = new Error('Test error');
            
            if (mockWebSocket.onerror) {
                mockWebSocket.onerror(mockError);
            }

            // Verify error handling
            expect(chatService.getConnectionStatus()).toBe(WebSocketStatus.DISCONNECTED);
        });
    });

    describe('Security Features', () => {
        it('should sanitize message content', async () => {
            const maliciousContent = '<script>alert("xss")</script>';
            const session = await chatService.createSession('Test Session');

            await chatService.sendMessage(maliciousContent, session.id);

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                expect.not.stringContaining('<script>')
            );
        });

        it('should handle message encryption', async () => {
            const session = await chatService.createSession('Test Session');
            const sensitiveContent = 'sensitive data';

            await chatService.sendMessage(sensitiveContent, session.id);

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                expect.stringContaining('encrypted')
            );
        });
    });
});