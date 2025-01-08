/**
 * @fileoverview Enhanced WebSocket client implementation for real-time communication
 * @version 1.0.0
 */

import { EventEmitter } from 'events'; // latest
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
     * Initialize WebSocket client with configuration
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
     * Establish WebSocket connection with enhanced reliability
     */
    public async connect(): Promise<void> {
        if (this.connectionState !== WS_STATES.DISCONNECTED) {
            throw new Error('Connection already in progress or established');
        }

        this.connectionState = WS_STATES.CONNECTING;

        return new Promise((resolve, reject) => {
            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                this.handleConnectionTimeout();
                reject(new Error('Connection timeout'));
            }, WS_CONFIG.CONNECTION_TIMEOUT);

            try {
                this.socket = new WebSocket(this.baseUrl);
                this.socket.binaryType = 'arraybuffer';

                // Add authentication headers
                const headers = new Headers({
                    'Authorization': `Bearer ${this.token}`
                });

                this.setupEventListeners(resolve, reject);
                this.startHeartbeat();
            } catch (error) {
                this.handleConnectionError(error as Error);
                reject(error);
            }
        });
    }

    /**
     * Gracefully close WebSocket connection
     */
    public async disconnect(): Promise<void> {
        this.connectionState = WS_STATES.DISCONNECTING;

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.close(1000, 'Client disconnecting');
        }

        this.cleanup();
    }

    /**
     * Send message with reliability guarantees
     */
    public async send(event: string, data: any, options: SendOptions = {}): Promise<void> {
        const message = {
            event,
            data,
            timestamp: new Date().toISOString()
        };

        if (this.connectionState !== WS_STATES.CONNECTED) {
            if (options.retry) {
                this.messageQueue.push({ event, data, options });
                if (this.messageQueue.length > WS_CONFIG.MESSAGE_BUFFER_SIZE) {
                    this.messageQueue.shift();
                }
            }
            throw new Error('WebSocket not connected');
        }

        try {
            const messageString = JSON.stringify(message);
            if (options.compress) {
                // Implement compression if needed
            }

            if (this.socket) {
                this.socket.send(messageString);
            }
        } catch (error) {
            this.eventEmitter.emit(WS_EVENTS.ERROR, error);
            throw error;
        }
    }

    /**
     * Subscribe to WebSocket events
     */
    public on(event: string, callback: (data: any) => void): void {
        this.eventEmitter.on(event, callback);
    }

    /**
     * Unsubscribe from WebSocket events
     */
    public off(event: string, callback: (data: any) => void): void {
        this.eventEmitter.off(event, callback);
    }

    /**
     * Set up WebSocket event listeners
     */
    private setupEventListeners(resolve: () => void, reject: (error: Error) => void): void {
        if (!this.socket) return;

        this.socket.onopen = () => {
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
            }
            this.connectionState = WS_STATES.CONNECTED;
            this.reconnectAttempts = 0;
            this.processMessageQueue();
            this.eventEmitter.emit(WS_EVENTS.CONNECTION_HEALTH, { status: 'connected' });
            resolve();
        };

        this.socket.onclose = (event) => {
            this.handleClose(event);
        };

        this.socket.onerror = (error) => {
            this.handleConnectionError(error as Error);
            reject(error);
        };

        this.socket.onmessage = (event) => {
            this.handleMessage(event);
        };
    }

    /**
     * Handle incoming WebSocket messages
     */
    private handleMessage(event: MessageEvent): void {
        try {
            const message = JSON.parse(event.data);
            this.eventEmitter.emit(message.event, message.data);
        } catch (error) {
            this.eventEmitter.emit(WS_EVENTS.ERROR, error);
        }
    }

    /**
     * Handle WebSocket connection closure
     */
    private handleClose(event: CloseEvent): void {
        this.connectionState = WS_STATES.DISCONNECTED;
        this.eventEmitter.emit(WS_EVENTS.CONNECTION_HEALTH, { status: 'disconnected' });

        if (!event.wasClean && this.reconnectAttempts < WS_CONFIG.RECONNECT_MAX_ATTEMPTS) {
            this.handleReconnection();
        }
    }

    /**
     * Manage connection recovery with exponential backoff
     */
    private async handleReconnection(): Promise<void> {
        if (this.isReconnecting) return;

        this.isReconnecting = true;
        const backoffDelay = Math.min(
            WS_CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
            30000
        );

        await new Promise(resolve => setTimeout(resolve, backoffDelay));

        try {
            this.reconnectAttempts++;
            await this.connect();
            this.isReconnecting = false;
        } catch (error) {
            this.isReconnecting = false;
            this.eventEmitter.emit(WS_EVENTS.ERROR, error);
        }
    }

    /**
     * Maintain connection health check
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            if (this.connectionState === WS_STATES.CONNECTED && this.socket) {
                try {
                    this.send(WS_EVENTS.CONNECTION_HEALTH, { type: 'ping' }, { retry: false });
                } catch (error) {
                    this.eventEmitter.emit(WS_EVENTS.ERROR, error);
                }
            }
        }, WS_CONFIG.HEARTBEAT_INTERVAL);
    }

    /**
     * Handle connection timeout
     */
    private handleConnectionTimeout(): void {
        if (this.socket) {
            this.socket.close();
        }
        this.cleanup();
        this.eventEmitter.emit(WS_EVENTS.ERROR, new Error('Connection timeout'));
    }

    /**
     * Handle connection errors
     */
    private handleConnectionError(error: Error): void {
        this.cleanup();
        this.eventEmitter.emit(WS_EVENTS.ERROR, error);
    }

    /**
     * Clean up resources and reset state
     */
    private cleanup(): void {
        this.socket = null;
        this.connectionState = WS_STATES.DISCONNECTED;
        this.isReconnecting = false;
    }

    /**
     * Process queued messages after reconnection
     */
    private async processMessageQueue(): Promise<void> {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                try {
                    await this.send(message.event, message.data, message.options);
                } catch (error) {
                    this.eventEmitter.emit(WS_EVENTS.ERROR, error);
                }
            }
        }
    }
}