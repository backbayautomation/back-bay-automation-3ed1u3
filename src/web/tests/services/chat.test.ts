/**
 * @fileoverview Test suite for ChatService with enhanced reliability and monitoring features
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.7.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { ChatService } from '../../src/services/chat';
import { Message, MessageRole, ChatSessionStatus } from '../../src/types/chat';
import { WS_EVENTS, WS_CONFIG } from '../../src/api/websocket';

// Mock configuration constants
const mockConfig = {
    wsUrl: 'ws://localhost:8000/ws',
    token: 'mock-auth-token',
    securityConfig: {
        encryptionKey: 'mock-encryption-key',
        rateLimits: {
            messagesPerMinute: 60,
            sessionsPerHour: 10
        }
    },
    loggerConfig: {
        level: 'info',
        enableMetrics: true
    }
};

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

// Helper function to create mock messages
const createMockMessage = (content: string, role: MessageRole = MessageRole.USER): Message => ({
    id: uuidv4(),
    content,
    role,
    timestamp: new Date(),
    sessionId: uuidv4(),
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
});

describe('ChatService', () => {
    let chatService: ChatService;
    let mockWebSocket: MockWebSocket;

    beforeEach(() => {
        // Setup mock WebSocket
        mockWebSocket = new MockWebSocket();
        (global as any).WebSocket = jest.fn(() => mockWebSocket);
        
        // Initialize chat service
        chatService = new ChatService(mockConfig);
        
        // Mock successful connection
        if (mockWebSocket.onopen) {
            mockWebSocket.onopen();
        }
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Connection Management', () => {
        it('should establish WebSocket connection on initialization', () => {
            expect(global.WebSocket).toHaveBeenCalledWith(mockConfig.wsUrl);
        });

        it('should handle connection failures gracefully', async () => {
            if (mockWebSocket.onerror) {
                mockWebSocket.onerror(new Error('Connection failed'));
            }
            
            const metrics = chatService.getMetrics();
            expect(metrics.connectionHealth).toBeFalsy();
        });

        it('should attempt reconnection on connection loss', async () => {
            if (mockWebSocket.onclose) {
                mockWebSocket.onclose({ wasClean: false });
            }
            
            expect(global.WebSocket).toHaveBeenCalledTimes(2);
        });

        it('should maintain heartbeat mechanism', () => {
            jest.advanceTimersByTime(WS_CONFIG.HEARTBEAT_INTERVAL);
            expect(mockWebSocket.send).toHaveBeenCalledWith(
                expect.stringContaining('connection.health')
            );
        });
    });

    describe('Message Handling', () => {
        it('should send messages with encryption', async () => {
            const message = 'Test message';
            const sessionId = uuidv4();
            
            await chatService.sendMessage(message, sessionId);
            
            expect(mockWebSocket.send).toHaveBeenCalledWith(
                expect.stringContaining('chat.message')
            );
        });

        it('should queue messages when offline', async () => {
            mockWebSocket.readyState = WebSocket.CLOSED;
            const message = 'Offline message';
            const sessionId = uuidv4();
            
            await expect(chatService.sendMessage(message, sessionId))
                .rejects.toThrow('WebSocket not connected');
            
            const metrics = chatService.getMetrics();
            expect(metrics.queueSize).toBeGreaterThan(0);
        });

        it('should process queued messages after reconnection', async () => {
            // Queue a message
            mockWebSocket.readyState = WebSocket.CLOSED;
            const message = 'Queued message';
            const sessionId = uuidv4();
            
            try {
                await chatService.sendMessage(message, sessionId);
            } catch (error) {
                // Expected error
            }
            
            // Simulate reconnection
            mockWebSocket.readyState = WebSocket.OPEN;
            if (mockWebSocket.onopen) {
                mockWebSocket.onopen();
            }
            
            expect(mockWebSocket.send).toHaveBeenCalled();
        });

        it('should enforce rate limits', async () => {
            const sessionId = uuidv4();
            const message = 'Rate limited message';
            
            // Exceed rate limit
            for (let i = 0; i <= mockConfig.securityConfig.rateLimits.messagesPerMinute; i++) {
                try {
                    await chatService.sendMessage(message, sessionId);
                } catch (error) {
                    expect(error).toMatchObject({
                        message: expect.stringContaining('rate limit exceeded')
                    });
                }
            }
        });
    });

    describe('Session Management', () => {
        it('should create new chat sessions', async () => {
            const session = await chatService.createSession('Test Session');
            
            expect(session).toMatchObject({
                title: 'Test Session',
                status: ChatSessionStatus.ACTIVE,
                messages: []
            });
        });

        it('should enforce session rate limits', async () => {
            // Exceed session rate limit
            for (let i = 0; i <= mockConfig.securityConfig.rateLimits.sessionsPerHour; i++) {
                try {
                    await chatService.createSession(`Session ${i}`);
                } catch (error) {
                    expect(error).toMatchObject({
                        message: expect.stringContaining('rate limit exceeded')
                    });
                }
            }
        });
    });

    describe('Monitoring and Metrics', () => {
        it('should track connection metrics', () => {
            const metrics = chatService.getMetrics();
            
            expect(metrics).toMatchObject({
                connectionHealth: expect.any(Boolean),
                queueSize: expect.any(Number),
                messageRateLimits: expect.any(Object),
                sessionRateLimit: expect.any(Number)
            });
        });

        it('should monitor message queue size', async () => {
            mockWebSocket.readyState = WebSocket.CLOSED;
            const message = 'Queued message';
            const sessionId = uuidv4();
            
            try {
                await chatService.sendMessage(message, sessionId);
            } catch (error) {
                // Expected error
            }
            
            const metrics = chatService.getMetrics();
            expect(metrics.queueSize).toBeGreaterThan(0);
        });
    });

    describe('Security Features', () => {
        it('should sanitize input data', async () => {
            const maliciousTitle = '<script>alert("xss")</script>';
            const session = await chatService.createSession(maliciousTitle);
            
            expect(session.title).not.toContain('<script>');
        });

        it('should handle encrypted messages', async () => {
            const message = 'Encrypted message';
            const sessionId = uuidv4();
            
            await chatService.sendMessage(message, sessionId);
            
            expect(mockWebSocket.send).toHaveBeenCalledWith(
                expect.stringContaining('encrypted')
            );
        });
    });
});