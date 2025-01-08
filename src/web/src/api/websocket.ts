/**
 * WebSocket client implementation for real-time communication
 * Version: 1.0.0
 * Dependencies:
 * - events: latest
 */

import { EventEmitter } from 'events';
import { Message } from '../types/chat';

// WebSocket event type constants
export const WS_EVENTS = {
    CHAT_MESSAGE: 'chat.message',
    DOCUMENT_PROCESSING: 'document.processing',
    SYSTEM_STATUS: 'system.status',
    CLIENT_ACTIVITY: 'client.activity',
    CONNECTION_HEALTH: 'connection.health',
    ERROR: 'error'
} as const;

// WebSocket connection states
const WS_STATES = {
    CONNECTING: 0,
    CONNECTED: 1,
    DISCONNECTING: 2,
    DISCONNECTED: 3
} as const;

// WebSocket configuration constants
export const WS_CONFIG = {
    RECONNECT_MAX_ATTEMPTS: 5,
    RECONNECT_BASE_DELAY: 1000,
    HEARTBEAT_INTERVAL: 30000,
    CONNECTION_TIMEOUT: 5000,
    MESSAGE_BUFFER_SIZE: 100
} as const;

// Custom error types
class WebSocketError extends Error {
    constructor(message: string, public code?: number) {
        super(message);
        this.name = 'WebSocketError';
    }
}

// Interface for WebSocket configuration
interface WebSocketConfig {
    reconnectMaxAttempts?: number;
    heartbeatInterval?: number;
    connectionTimeout?: number;
    messageBufferSize?: number;
}

// Interface for message send options
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
    private reconnectAttempts: number = 0;
    private connectionState: number = WS_STATES.DISCONNECTED;
    private messageQueue: Array<{ event: string; data: any; options: SendOptions }> = [];
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private connectionTimeout: NodeJS.Timeout | null = null;
    private isReconnecting: boolean = false;

    constructor(
        private baseUrl: string,
        private token: string,
        private config: WebSocketConfig = {}
    ) {
        this.eventEmitter = new EventEmitter();
        this.config = {
            reconnectMaxAttempts: WS_CONFIG.RECONNECT_MAX_ATTEMPTS,
            heartbeatInterval: WS_CONFIG.HEARTBEAT_INTERVAL,
            connectionTimeout: WS_CONFIG.CONNECTION_TIMEOUT,
            messageBufferSize: WS_CONFIG.MESSAGE_BUFFER_SIZE,
            ...config
        };
    }

    /**
     * Establishes WebSocket connection with enhanced reliability
     */
    public async connect(): Promise<void> {
        if (this.connectionState !== WS_STATES.DISCONNECTED) {
            throw new WebSocketError('Connection already in progress');
        }

        this.connectionState = WS_STATES.CONNECTING;

        try {
            const wsUrl = new URL(this.baseUrl);
            wsUrl.protocol = wsUrl.protocol.replace('http', 'ws');
            wsUrl.searchParams.append('token', this.token);

            this.socket = new WebSocket(wsUrl.toString());
            
            // Set up connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (this.connectionState === WS_STATES.CONNECTING) {
                    this.socket?.close();
                    throw new WebSocketError('Connection timeout', 4008);
                }
            }, this.config.connectionTimeout);

            // Set up event listeners
            this.socket.onopen = this.handleOpen.bind(this);
            this.socket.onclose = this.handleClose.bind(this);
            this.socket.onerror = this.handleError.bind(this);
            this.socket.onmessage = this.handleMessage.bind(this);

            // Start heartbeat once connected
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
        this.connectionState = WS_STATES.DISCONNECTING;
        this.clearTimers();

        if (this.socket) {
            this.socket.close(1000, 'Client disconnecting');
            this.socket = null;
        }

        this.connectionState = WS_STATES.DISCONNECTED;
        this.messageQueue = [];
        this.eventEmitter.emit(WS_EVENTS.CONNECTION_HEALTH, { connected: false });
    }

    /**
     * Sends message with reliability guarantees
     */
    public async send(event: string, data: any, options: SendOptions = {}): Promise<void> {
        if (this.connectionState !== WS_STATES.CONNECTED) {
            if (options.retry && this.messageQueue.length < this.config.messageBufferSize!) {
                this.messageQueue.push({ event, data, options });
                return;
            }
            throw new WebSocketError('Not connected', 4007);
        }

        const message = {
            event,
            data,
            timestamp: new Date().toISOString()
        };

        try {
            if (options.encrypt) {
                // Implement encryption if needed
                // message.data = encrypt(message.data);
            }

            const messageString = JSON.stringify(message);
            if (options.compress) {
                // Implement compression if needed
                // messageString = compress(messageString);
            }

            this.socket!.send(messageString);
        } catch (error) {
            if (options.retry) {
                this.messageQueue.push({ event, data, options });
            }
            throw new WebSocketError('Failed to send message', 4009);
        }
    }

    /**
     * Manages connection recovery with exponential backoff
     */
    private async handleReconnection(): Promise<void> {
        if (this.isReconnecting || this.reconnectAttempts >= this.config.reconnectMaxAttempts!) {
            throw new WebSocketError('Max reconnection attempts reached', 4010);
        }

        this.isReconnecting = true;
        const backoffDelay = Math.min(
            1000 * Math.pow(2, this.reconnectAttempts),
            30000
        );

        await new Promise(resolve => setTimeout(resolve, backoffDelay));

        try {
            await this.connect();
            this.reconnectAttempts = 0;
            this.processMessageQueue();
        } catch (error) {
            this.reconnectAttempts++;
            throw error;
        } finally {
            this.isReconnecting = false;
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
                    .catch(this.handleError.bind(this));
            }
        }, this.config.heartbeatInterval);
    }

    private handleOpen(): void {
        this.clearTimers();
        this.connectionState = WS_STATES.CONNECTED;
        this.startHeartbeat();
        this.eventEmitter.emit('connected');
        this.eventEmitter.emit(WS_EVENTS.CONNECTION_HEALTH, { connected: true });
    }

    private handleClose(event: CloseEvent): void {
        this.clearTimers();
        this.connectionState = WS_STATES.DISCONNECTED;
        
        if (event.code !== 1000) {
            this.handleReconnection().catch(error => {
                this.eventEmitter.emit(WS_EVENTS.ERROR, error);
            });
        }
    }

    private handleError(error: any): void {
        this.eventEmitter.emit(WS_EVENTS.ERROR, new WebSocketError(error.message || 'WebSocket error', error.code));
    }

    private handleMessage(event: MessageEvent): void {
        try {
            const message = JSON.parse(event.data);
            this.eventEmitter.emit(message.event, message.data);
        } catch (error) {
            this.handleError(error);
        }
    }

    private async processMessageQueue(): Promise<void> {
        while (this.messageQueue.length > 0 && this.connectionState === WS_STATES.CONNECTED) {
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

    private clearTimers(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    public on(event: string, listener: (...args: any[]) => void): void {
        this.eventEmitter.on(event, listener);
    }

    public off(event: string, listener: (...args: any[]) => void): void {
        this.eventEmitter.off(event, listener);
    }
}