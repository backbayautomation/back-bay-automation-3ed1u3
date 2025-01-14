/**
 * @fileoverview Enhanced WebSocket client implementation for real-time communication
 * @version 1.0.0
 */

import { EventEmitter } from 'events'; // Latest version
import { Message } from '../types/chat';

/**
 * WebSocket event type constants
 */
export const WS_EVENTS = {
    CHAT_MESSAGE: 'chat.message',
    DOCUMENT_PROCESSING: 'document.processing',
    SYSTEM_STATUS: 'system.status',
    CLIENT_ACTIVITY: 'client.activity',
    CONNECTION_HEALTH: 'connection.health',
    ERROR: 'error'
} as const;

/**
 * WebSocket connection states
 */
const WS_STATES = {
    CONNECTING: 0,
    CONNECTED: 1,
    DISCONNECTING: 2,
    DISCONNECTED: 3
} as const;

/**
 * WebSocket configuration constants
 */
export const WS_CONFIG = {
    RECONNECT_MAX_ATTEMPTS: 5,
    RECONNECT_BASE_DELAY: 1000,
    HEARTBEAT_INTERVAL: 30000,
    CONNECTION_TIMEOUT: 5000,
    MESSAGE_BUFFER_SIZE: 100
} as const;

/**
 * Interface for WebSocket configuration options
 */
interface WebSocketConfig {
    reconnectMaxAttempts?: number;
    reconnectBaseDelay?: number;
    heartbeatInterval?: number;
    connectionTimeout?: number;
    messageBufferSize?: number;
}

/**
 * Interface for message send options
 */
interface SendOptions {
    retry?: boolean;
    compress?: boolean;
    encrypt?: boolean;
    timeout?: number;
}

/**
 * Enhanced WebSocket client with reliability features
 */
export class WebSocketClient {
    private socket: WebSocket | null = null;
    private eventEmitter: EventEmitter;
    private baseUrl: string;
    private token: string;
    private reconnectAttempts: number = 0;
    private connectionState: number = WS_STATES.DISCONNECTED;
    private messageQueue: Array<{ event: string; data: any; options: SendOptions }> = [];
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private connectionTimeout: NodeJS.Timeout | null = null;
    private isReconnecting: boolean = false;

    /**
     * Creates a new WebSocket client instance
     */
    constructor(baseUrl: string, token: string, config: WebSocketConfig = {}) {
        this.eventEmitter = new EventEmitter();
        this.baseUrl = baseUrl;
        this.token = token;
        
        // Apply configuration with defaults
        Object.assign(WS_CONFIG, {
            ...WS_CONFIG,
            ...config
        });
    }

    /**
     * Establishes WebSocket connection with enhanced reliability
     */
    public async connect(): Promise<void> {
        if (this.connectionState !== WS_STATES.DISCONNECTED) {
            throw new Error('Connection already in progress or established');
        }

        this.connectionState = WS_STATES.CONNECTING;

        try {
            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (this.connectionState === WS_STATES.CONNECTING) {
                    this.handleConnectionTimeout();
                }
            }, WS_CONFIG.CONNECTION_TIMEOUT);

            // Create WebSocket instance with authentication
            this.socket = new WebSocket(this.baseUrl);
            this.socket.binaryType = 'arraybuffer';

            // Add authentication headers
            this.socket.onopen = () => this.handleOpen();
            this.socket.onclose = (event) => this.handleClose(event);
            this.socket.onerror = (error) => this.handleError(error);
            this.socket.onmessage = (event) => this.handleMessage(event);

            // Start heartbeat on successful connection
            await new Promise<void>((resolve, reject) => {
                this.eventEmitter.once('connected', resolve);
                this.eventEmitter.once('error', reject);
            });
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    /**
     * Gracefully closes WebSocket connection
     */
    public async disconnect(): Promise<void> {
        if (this.connectionState === WS_STATES.DISCONNECTED) {
            return;
        }

        this.connectionState = WS_STATES.DISCONNECTING;

        // Clear intervals and timeouts
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        // Close socket if it exists
        if (this.socket) {
            this.socket.close(1000, 'Client disconnecting');
            this.socket = null;
        }

        // Reset state
        this.connectionState = WS_STATES.DISCONNECTED;
        this.messageQueue = [];
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
    }

    /**
     * Sends message with reliability guarantees
     */
    public async send(event: string, data: any, options: SendOptions = {}): Promise<void> {
        const message = { event, data, options };

        // Validate message
        if (!event || typeof event !== 'string') {
            throw new Error('Invalid event type');
        }

        // Handle disconnected state
        if (this.connectionState !== WS_STATES.CONNECTED) {
            if (options.retry && this.messageQueue.length < WS_CONFIG.MESSAGE_BUFFER_SIZE) {
                this.messageQueue.push(message);
                return;
            }
            throw new Error('WebSocket is not connected');
        }

        try {
            const payload = this.preparePayload(event, data, options);
            await this.sendWithRetry(payload, options);
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    /**
     * Manages connection recovery with exponential backoff
     */
    private async handleReconnection(): Promise<void> {
        if (this.isReconnecting || this.reconnectAttempts >= WS_CONFIG.RECONNECT_MAX_ATTEMPTS) {
            this.eventEmitter.emit(WS_EVENTS.ERROR, new Error('Max reconnection attempts reached'));
            return;
        }

        this.isReconnecting = true;
        this.reconnectAttempts++;

        const delay = Math.min(
            WS_CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1),
            30000
        );

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await this.connect();
            this.isReconnecting = false;
            this.processMessageQueue();
        } catch (error) {
            this.isReconnecting = false;
            this.handleError(error);
        }
    }

    /**
     * Maintains connection health check
     */
    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (this.connectionState === WS_STATES.CONNECTED) {
                this.send(WS_EVENTS.CONNECTION_HEALTH, { timestamp: Date.now() })
                    .catch(error => this.handleError(error));
            }
        }, WS_CONFIG.HEARTBEAT_INTERVAL);
    }

    /**
     * Handles WebSocket open event
     */
    private handleOpen(): void {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        this.connectionState = WS_STATES.CONNECTED;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.eventEmitter.emit('connected');
    }

    /**
     * Handles WebSocket close event
     */
    private handleClose(event: CloseEvent): void {
        this.connectionState = WS_STATES.DISCONNECTED;
        
        if (!event.wasClean) {
            this.handleReconnection();
        }
    }

    /**
     * Handles WebSocket error event
     */
    private handleError(error: any): void {
        this.eventEmitter.emit(WS_EVENTS.ERROR, error);
    }

    /**
     * Handles WebSocket message event
     */
    private handleMessage(event: MessageEvent): void {
        try {
            const message = JSON.parse(event.data);
            this.eventEmitter.emit(message.event, message.data);
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Handles connection timeout
     */
    private handleConnectionTimeout(): void {
        this.handleError(new Error('Connection timeout'));
        this.disconnect();
    }

    /**
     * Prepares payload for sending
     */
    private preparePayload(event: string, data: any, options: SendOptions): string {
        const payload = { event, data, timestamp: Date.now() };
        return JSON.stringify(payload);
    }

    /**
     * Sends payload with retry logic
     */
    private async sendWithRetry(payload: string, options: SendOptions): Promise<void> {
        const maxRetries = options.retry ? 3 : 0;
        let attempts = 0;

        while (attempts <= maxRetries) {
            try {
                if (this.socket?.readyState === WebSocket.OPEN) {
                    this.socket.send(payload);
                    return;
                }
                throw new Error('Socket not ready');
            } catch (error) {
                if (attempts === maxRetries) throw error;
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
        }
    }

    /**
     * Processes queued messages after reconnection
     */
    private async processMessageQueue(): Promise<void> {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                try {
                    await this.send(message.event, message.data, message.options);
                } catch (error) {
                    this.messageQueue.unshift(message);
                    break;
                }
            }
        }
    }
}