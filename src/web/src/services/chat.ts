/**
 * @fileoverview Enhanced chat service implementation with reliability, security, and monitoring features
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { Logger } from '@azure/logger'; // v1.0.0
import { SecurityUtils } from '@security/utils'; // v2.0.0
import { WebSocketClient, WS_EVENTS, WS_CONFIG } from '../api/websocket';
import { 
    Message, 
    ChatSession, 
    MessageRole, 
    ChatSessionStatus,
    WebSocketStatus,
    MessageMetadata,
    NewMessage 
} from '../types/chat';

/**
 * Configuration interface for chat service security settings
 */
interface SecurityConfig {
    encryptionKey: string;
    rateLimitPerMinute: number;
    maxMessageSize: number;
}

/**
 * Configuration interface for chat service logging
 */
interface LoggerConfig {
    level: string;
    enableMetrics: boolean;
    metricsInterval: number;
}

/**
 * Interface for message queue entry
 */
interface QueuedMessage {
    content: string;
    sessionId: string;
    timestamp: Date;
    retryCount: number;
}

/**
 * Enhanced chat service with reliability, security, and monitoring features
 */
export class ChatService {
    private wsClient: WebSocketClient;
    private currentSession: ChatSession | null = null;
    private messageQueue: QueuedMessage[] = [];
    private securityUtils: SecurityUtils;
    private logger: Logger;
    private messagesSentThisMinute: number = 0;
    private lastRateLimitReset: Date = new Date();
    private readonly rateLimitPerMinute: number;
    private readonly maxMessageSize: number;

    /**
     * Initializes chat service with enhanced features
     */
    constructor(
        wsUrl: string,
        token: string,
        securityConfig: SecurityConfig,
        loggerConfig: LoggerConfig
    ) {
        // Initialize WebSocket client with reconnection settings
        this.wsClient = new WebSocketClient(wsUrl, token, {
            reconnectMaxAttempts: WS_CONFIG.RECONNECT_MAX_ATTEMPTS,
            heartbeatInterval: WS_CONFIG.HEARTBEAT_INTERVAL
        });

        // Initialize security utilities
        this.securityUtils = new SecurityUtils(securityConfig.encryptionKey);
        this.rateLimitPerMinute = securityConfig.rateLimitPerMinute;
        this.maxMessageSize = securityConfig.maxMessageSize;

        // Initialize logger
        this.logger = new Logger('ChatService');
        this.logger.setLogLevel(loggerConfig.level);

        // Set up WebSocket event handlers
        this.setupWebSocketHandlers();

        // Start metrics collection if enabled
        if (loggerConfig.enableMetrics) {
            this.startMetricsCollection(loggerConfig.metricsInterval);
        }
    }

    /**
     * Creates a new secure chat session with metadata
     */
    public async createSession(title: string, metadata?: MessageMetadata): Promise<ChatSession> {
        try {
            const sessionId = uuidv4();
            const session: ChatSession = {
                id: sessionId,
                title,
                createdAt: new Date(),
                updatedAt: new Date(),
                messages: [],
                status: ChatSessionStatus.ACTIVE
            };

            this.currentSession = session;
            this.logger.info(`Created new chat session: ${sessionId}`);

            return session;
        } catch (error) {
            this.logger.error(`Failed to create chat session: ${error}`);
            throw error;
        }
    }

    /**
     * Sends an encrypted message with reliability guarantees
     */
    public async sendMessage(content: string, sessionId: string, options: Partial<MessageMetadata> = {}): Promise<Message> {
        try {
            // Rate limiting check
            if (!this.checkRateLimit()) {
                throw new Error('Rate limit exceeded');
            }

            // Message size validation
            if (content.length > this.maxMessageSize) {
                throw new Error(`Message exceeds maximum size of ${this.maxMessageSize} characters`);
            }

            // Encrypt message content
            const encryptedContent = await this.securityUtils.encrypt(content);

            const message: Message = {
                id: uuidv4(),
                content: encryptedContent,
                role: MessageRole.USER,
                timestamp: new Date(),
                sessionId,
                metadata: {
                    hasMarkdown: options.hasMarkdown || false,
                    hasCodeBlock: options.hasCodeBlock || false,
                    codeLanguage: options.codeLanguage || null,
                    renderOptions: {
                        enableLatex: options.renderOptions?.enableLatex || false,
                        enableDiagrams: options.renderOptions?.enableDiagrams || false,
                        syntaxHighlighting: options.renderOptions?.syntaxHighlighting || false
                    }
                }
            };

            // Queue message if offline
            if (this.wsClient.getConnectionStatus() !== WebSocketStatus.CONNECTED) {
                this.queueMessage({
                    content: encryptedContent,
                    sessionId,
                    timestamp: new Date(),
                    retryCount: 0
                });
                return message;
            }

            // Send message with retry logic
            await this.wsClient.send(WS_EVENTS.CHAT_MESSAGE, message, { retry: true });
            
            // Update session state
            if (this.currentSession && this.currentSession.id === sessionId) {
                this.currentSession.messages.push(message);
                this.currentSession.updatedAt = new Date();
            }

            this.messagesSentThisMinute++;
            this.logger.info(`Message sent successfully: ${message.id}`);

            return message;
        } catch (error) {
            this.logger.error(`Failed to send message: ${error}`);
            throw error;
        }
    }

    /**
     * Retrieves current connection status
     */
    public getConnectionStatus(): WebSocketStatus {
        return this.wsClient.getConnectionStatus();
    }

    /**
     * Retrieves chat service metrics
     */
    public getMetrics() {
        return {
            messagesSentThisMinute: this.messagesSentThisMinute,
            queuedMessages: this.messageQueue.length,
            connectionStatus: this.getConnectionStatus()
        };
    }

    /**
     * Sets up WebSocket event handlers
     */
    private setupWebSocketHandlers(): void {
        this.wsClient.on(WS_EVENTS.CHAT_MESSAGE, this.handleIncomingMessage.bind(this));
        this.wsClient.on(WS_EVENTS.ERROR, this.handleWebSocketError.bind(this));
        this.wsClient.on(WS_EVENTS.SYSTEM_STATUS, this.handleSystemStatus.bind(this));
    }

    /**
     * Handles incoming messages with decryption
     */
    private async handleIncomingMessage(message: Message): Promise<void> {
        try {
            message.content = await this.securityUtils.decrypt(message.content);
            if (this.currentSession && message.sessionId === this.currentSession.id) {
                this.currentSession.messages.push(message);
                this.currentSession.updatedAt = new Date();
            }
        } catch (error) {
            this.logger.error(`Failed to handle incoming message: ${error}`);
        }
    }

    /**
     * Handles WebSocket errors
     */
    private handleWebSocketError(error: Error): void {
        this.logger.error(`WebSocket error: ${error}`);
    }

    /**
     * Handles system status updates
     */
    private handleSystemStatus(status: any): void {
        this.logger.info(`System status update: ${JSON.stringify(status)}`);
    }

    /**
     * Checks rate limiting
     */
    private checkRateLimit(): boolean {
        const now = new Date();
        if (now.getTime() - this.lastRateLimitReset.getTime() > 60000) {
            this.messagesSentThisMinute = 0;
            this.lastRateLimitReset = now;
        }
        return this.messagesSentThisMinute < this.rateLimitPerMinute;
    }

    /**
     * Queues message for later delivery
     */
    private queueMessage(message: QueuedMessage): void {
        this.messageQueue.push(message);
        this.logger.info(`Message queued for later delivery: ${message.sessionId}`);
    }

    /**
     * Starts metrics collection
     */
    private startMetricsCollection(interval: number): void {
        setInterval(() => {
            const metrics = this.getMetrics();
            this.logger.info(`Chat service metrics: ${JSON.stringify(metrics)}`);
        }, interval);
    }
}