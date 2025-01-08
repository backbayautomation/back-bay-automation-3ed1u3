/**
 * Enhanced Chat Service Implementation
 * Version: 1.0.0
 * Dependencies:
 * - uuid: 9.0.0
 * - @azure/logger: 1.0.0
 * - @security/utils: 2.0.0
 */

import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { Logger } from '@azure/logger'; // v1.0.0
import { SecurityUtils } from '@security/utils'; // v2.0.0
import { WebSocketClient, WS_EVENTS } from '../api/websocket';
import { 
    Message, 
    ChatSession, 
    MessageRole, 
    ChatSessionStatus,
    WebSocketStatus,
    MessageMetadata
} from '../types/chat';

// Constants for rate limiting and monitoring
const RATE_LIMITS = {
    MESSAGES_PER_MINUTE: 60,
    MAX_MESSAGE_LENGTH: 4000,
    MAX_RETRIES: 3
} as const;

// Interface for chat service configuration
interface ChatServiceConfig {
    wsUrl: string;
    token: string;
    securityConfig: {
        encryptionKey: string;
        enableMessageSigning: boolean;
    };
    loggerConfig: {
        level: string;
        enableMetrics: boolean;
    };
}

// Interface for message queue item
interface QueuedMessage {
    content: string;
    sessionId: string;
    timestamp: Date;
    retryCount: number;
}

/**
 * Enhanced ChatService with reliability, security, and monitoring features
 */
export class ChatService {
    private wsClient: WebSocketClient;
    private currentSession: ChatSession | null = null;
    private messageQueue: QueuedMessage[] = [];
    private securityUtils: SecurityUtils;
    private logger: Logger;
    private messageRateTracker: Map<string, number> = new Map();
    private lastCleanupTime: number = Date.now();

    constructor(private config: ChatServiceConfig) {
        // Initialize WebSocket client with enhanced reliability
        this.wsClient = new WebSocketClient(
            config.wsUrl,
            config.token,
            {
                reconnectMaxAttempts: 5,
                heartbeatInterval: 30000,
                connectionTimeout: 5000
            }
        );

        // Initialize security utilities
        this.securityUtils = new SecurityUtils(config.securityConfig);

        // Initialize logger with monitoring
        this.logger = new Logger('ChatService', config.loggerConfig);

        // Set up WebSocket event handlers
        this.setupWebSocketHandlers();

        // Initialize rate limiting cleanup
        this.setupRateLimitingCleanup();
    }

    /**
     * Creates a new chat session with security context
     */
    public async createSession(title: string, metadata?: MessageMetadata): Promise<ChatSession> {
        try {
            const sessionId = uuidv4();
            const session: ChatSession = {
                id: sessionId,
                title: this.securityUtils.sanitizeInput(title),
                createdAt: new Date(),
                updatedAt: new Date(),
                messages: [],
                status: ChatSessionStatus.ACTIVE
            };

            this.logger.info(`Creating new chat session: ${sessionId}`);
            this.currentSession = session;

            await this.wsClient.send(WS_EVENTS.CHAT_MESSAGE, {
                type: 'session_created',
                sessionId,
                metadata
            });

            return session;
        } catch (error) {
            this.logger.error('Failed to create chat session', error);
            throw error;
        }
    }

    /**
     * Sends a message with encryption and reliability guarantees
     */
    public async sendMessage(content: string, sessionId: string, options: { retry?: boolean } = {}): Promise<Message> {
        try {
            // Rate limiting check
            if (!this.checkRateLimit(sessionId)) {
                throw new Error('Rate limit exceeded');
            }

            // Input validation and sanitization
            const sanitizedContent = this.securityUtils.sanitizeInput(content);
            if (sanitizedContent.length > RATE_LIMITS.MAX_MESSAGE_LENGTH) {
                throw new Error('Message exceeds maximum length');
            }

            // Create message object
            const message: Message = {
                id: uuidv4(),
                content: sanitizedContent,
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

            // Encrypt message content if configured
            if (this.config.securityConfig.enableMessageSigning) {
                message.content = await this.securityUtils.encryptMessage(message.content);
            }

            // Send message with retry logic
            await this.sendMessageWithRetry(message, options);

            // Update session state
            if (this.currentSession && this.currentSession.id === sessionId) {
                this.currentSession.messages.push(message);
                this.currentSession.updatedAt = new Date();
            }

            this.logger.info(`Message sent: ${message.id}`);
            return message;
        } catch (error) {
            this.logger.error('Failed to send message', error);
            throw error;
        }
    }

    /**
     * Reconnects WebSocket with enhanced reliability
     */
    public async reconnect(): Promise<void> {
        try {
            await this.wsClient.connect();
            this.processMessageQueue();
        } catch (error) {
            this.logger.error('Failed to reconnect', error);
            throw error;
        }
    }

    /**
     * Returns current connection status
     */
    public getConnectionStatus(): WebSocketStatus {
        return this.wsClient ? WebSocketStatus.CONNECTED : WebSocketStatus.DISCONNECTED;
    }

    /**
     * Returns service metrics for monitoring
     */
    public getMetrics() {
        return {
            messageCount: this.messageRateTracker.size,
            queueLength: this.messageQueue.length,
            connectionStatus: this.getConnectionStatus()
        };
    }

    private async sendMessageWithRetry(message: Message, options: { retry?: boolean }): Promise<void> {
        let retryCount = 0;
        while (retryCount < RATE_LIMITS.MAX_RETRIES) {
            try {
                await this.wsClient.send(WS_EVENTS.CHAT_MESSAGE, message, {
                    retry: options.retry,
                    encrypt: this.config.securityConfig.enableMessageSigning
                });
                return;
            } catch (error) {
                retryCount++;
                if (retryCount === RATE_LIMITS.MAX_RETRIES) {
                    this.queueMessage(message);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }
    }

    private queueMessage(message: Message): void {
        this.messageQueue.push({
            content: message.content,
            sessionId: message.sessionId,
            timestamp: message.timestamp,
            retryCount: 0
        });
    }

    private async processMessageQueue(): Promise<void> {
        while (this.messageQueue.length > 0) {
            const queuedMessage = this.messageQueue[0];
            try {
                await this.sendMessage(queuedMessage.content, queuedMessage.sessionId, { retry: true });
                this.messageQueue.shift();
            } catch (error) {
                this.logger.error('Failed to process queued message', error);
                break;
            }
        }
    }

    private setupWebSocketHandlers(): void {
        this.wsClient.on(WS_EVENTS.CHAT_MESSAGE, this.handleIncomingMessage.bind(this));
        this.wsClient.on(WS_EVENTS.ERROR, this.handleWebSocketError.bind(this));
        this.wsClient.on(WS_EVENTS.CONNECTION_HEALTH, this.handleConnectionHealth.bind(this));
    }

    private handleIncomingMessage(message: Message): void {
        if (this.currentSession && message.sessionId === this.currentSession.id) {
            this.currentSession.messages.push(message);
            this.currentSession.updatedAt = new Date();
        }
    }

    private handleWebSocketError(error: Error): void {
        this.logger.error('WebSocket error', error);
    }

    private handleConnectionHealth(status: { connected: boolean }): void {
        this.logger.info(`Connection status: ${status.connected ? 'connected' : 'disconnected'}`);
    }

    private checkRateLimit(sessionId: string): boolean {
        const now = Date.now();
        const messageCount = this.messageRateTracker.get(sessionId) || 0;
        
        if (messageCount >= RATE_LIMITS.MESSAGES_PER_MINUTE) {
            return false;
        }

        this.messageRateTracker.set(sessionId, messageCount + 1);
        return true;
    }

    private setupRateLimitingCleanup(): void {
        setInterval(() => {
            const now = Date.now();
            if (now - this.lastCleanupTime >= 60000) {
                this.messageRateTracker.clear();
                this.lastCleanupTime = now;
            }
        }, 60000);
    }
}