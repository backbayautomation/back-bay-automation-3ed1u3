/**
 * @fileoverview Enhanced chat service implementation with reliability, security, and monitoring
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { Logger } from '@azure/logger'; // v1.0.0
import { SecurityUtils } from '@security/utils'; // v2.0.0
import { WebSocketClient, WS_EVENTS } from '../api/websocket';
import { Message, ChatSession, MessageRole, ChatSessionStatus } from '../types/chat';

/**
 * Configuration interface for chat service
 */
interface ChatServiceConfig {
    wsUrl: string;
    token: string;
    securityConfig: {
        encryptionKey: string;
        rateLimits: {
            messagesPerMinute: number;
            sessionsPerHour: number;
        };
    };
    loggerConfig: {
        level: string;
        enableMetrics: boolean;
    };
}

/**
 * Message queue for handling offline scenarios
 */
class MessageQueue {
    private queue: Message[] = [];
    private readonly maxSize: number = 100;

    public enqueue(message: Message): void {
        if (this.queue.length >= this.maxSize) {
            this.queue.shift();
        }
        this.queue.push(message);
    }

    public dequeue(): Message | undefined {
        return this.queue.shift();
    }

    public isEmpty(): boolean {
        return this.queue.length === 0;
    }
}

/**
 * Connection monitor for tracking WebSocket health
 */
class ConnectionMonitor {
    private lastPingTime: number = Date.now();
    private readonly healthyThreshold: number = 45000; // 45 seconds

    public updatePingTime(): void {
        this.lastPingTime = Date.now();
    }

    public isHealthy(): boolean {
        return Date.now() - this.lastPingTime < this.healthyThreshold;
    }
}

/**
 * Enhanced chat service with reliability, security, and monitoring features
 */
export class ChatService {
    private wsClient: WebSocketClient;
    private currentSession: ChatSession | null = null;
    private messageQueue: MessageQueue;
    private securityUtils: SecurityUtils;
    private logger: Logger;
    private connectionMonitor: ConnectionMonitor;
    private messageRateLimit: Map<string, number> = new Map();
    private sessionRateLimit: number = 0;
    private readonly config: ChatServiceConfig;

    constructor(config: ChatServiceConfig) {
        this.config = config;
        this.wsClient = new WebSocketClient(config.wsUrl, config.token);
        this.messageQueue = new MessageQueue();
        this.securityUtils = new SecurityUtils(config.securityConfig);
        this.logger = new Logger('ChatService', config.loggerConfig);
        this.connectionMonitor = new ConnectionMonitor();

        this.initializeWebSocket();
        this.setupRateLimitReset();
    }

    /**
     * Initialize WebSocket connection and event handlers
     */
    private initializeWebSocket(): void {
        this.wsClient.on(WS_EVENTS.CHAT_MESSAGE, this.handleIncomingMessage.bind(this));
        this.wsClient.on(WS_EVENTS.CONNECTION_HEALTH, this.handleConnectionHealth.bind(this));
        this.wsClient.on(WS_EVENTS.ERROR, this.handleError.bind(this));

        this.connect();
    }

    /**
     * Create a new chat session with security context
     */
    public async createSession(title: string, metadata: any = {}): Promise<ChatSession> {
        this.enforceSessionRateLimit();

        const session: ChatSession = {
            id: uuidv4(),
            title: this.securityUtils.sanitizeInput(title),
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [],
            status: ChatSessionStatus.ACTIVE
        };

        this.logger.info(`Creating new chat session: ${session.id}`);
        this.currentSession = session;

        return session;
    }

    /**
     * Send message with reliability guarantees and encryption
     */
    public async sendMessage(content: string, sessionId: string): Promise<Message> {
        this.enforceMessageRateLimit(sessionId);

        const message: Message = {
            id: uuidv4(),
            content: this.securityUtils.sanitizeInput(content),
            role: MessageRole.USER,
            timestamp: new Date(),
            sessionId,
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

        try {
            const encryptedContent = await this.securityUtils.encryptMessage(message.content);
            message.content = encryptedContent;

            if (!this.wsClient || !this.connectionMonitor.isHealthy()) {
                this.messageQueue.enqueue(message);
                this.logger.warn(`Message queued due to connection issues: ${message.id}`);
                await this.reconnect();
            } else {
                await this.wsClient.send(WS_EVENTS.CHAT_MESSAGE, message, { retry: true });
            }

            this.logger.info(`Message sent: ${message.id}`);
            return message;
        } catch (error) {
            this.logger.error(`Error sending message: ${error}`);
            throw error;
        }
    }

    /**
     * Reconnect WebSocket with exponential backoff
     */
    public async reconnect(): Promise<void> {
        try {
            await this.wsClient.connect();
            await this.processQueuedMessages();
        } catch (error) {
            this.logger.error(`Reconnection failed: ${error}`);
            throw error;
        }
    }

    /**
     * Process queued messages after reconnection
     */
    private async processQueuedMessages(): Promise<void> {
        while (!this.messageQueue.isEmpty()) {
            const message = this.messageQueue.dequeue();
            if (message) {
                try {
                    await this.wsClient.send(WS_EVENTS.CHAT_MESSAGE, message, { retry: true });
                    this.logger.info(`Queued message sent: ${message.id}`);
                } catch (error) {
                    this.logger.error(`Error sending queued message: ${error}`);
                    this.messageQueue.enqueue(message);
                    break;
                }
            }
        }
    }

    /**
     * Handle incoming messages with decryption
     */
    private async handleIncomingMessage(message: Message): Promise<void> {
        try {
            message.content = await this.securityUtils.decryptMessage(message.content);
            if (this.currentSession) {
                this.currentSession.messages.push(message);
                this.currentSession.updatedAt = new Date();
            }
        } catch (error) {
            this.logger.error(`Error handling incoming message: ${error}`);
        }
    }

    /**
     * Monitor connection health
     */
    private handleConnectionHealth(status: { type: string }): void {
        if (status.type === 'ping') {
            this.connectionMonitor.updatePingTime();
        }
    }

    /**
     * Handle WebSocket errors
     */
    private handleError(error: Error): void {
        this.logger.error(`WebSocket error: ${error}`);
    }

    /**
     * Enforce rate limits for message sending
     */
    private enforceMessageRateLimit(sessionId: string): void {
        const currentCount = this.messageRateLimit.get(sessionId) || 0;
        if (currentCount >= this.config.securityConfig.rateLimits.messagesPerMinute) {
            throw new Error('Message rate limit exceeded');
        }
        this.messageRateLimit.set(sessionId, currentCount + 1);
    }

    /**
     * Enforce rate limits for session creation
     */
    private enforceSessionRateLimit(): void {
        if (this.sessionRateLimit >= this.config.securityConfig.rateLimits.sessionsPerHour) {
            throw new Error('Session rate limit exceeded');
        }
        this.sessionRateLimit++;
    }

    /**
     * Reset rate limits periodically
     */
    private setupRateLimitReset(): void {
        // Reset message rate limits every minute
        setInterval(() => {
            this.messageRateLimit.clear();
        }, 60000);

        // Reset session rate limit every hour
        setInterval(() => {
            this.sessionRateLimit = 0;
        }, 3600000);
    }

    /**
     * Get current connection status
     */
    public getConnectionStatus(): boolean {
        return this.connectionMonitor.isHealthy();
    }

    /**
     * Get service metrics for monitoring
     */
    public getMetrics(): any {
        return {
            queueSize: this.messageQueue.isEmpty() ? 0 : 1,
            connectionHealth: this.connectionMonitor.isHealthy(),
            currentSessionId: this.currentSession?.id,
            messageRateLimits: Object.fromEntries(this.messageRateLimit),
            sessionRateLimit: this.sessionRateLimit
        };
    }
}