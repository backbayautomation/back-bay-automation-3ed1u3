import React, { useState, useCallback, useRef, useEffect } from 'react'; // v18.2.0
import { useDispatch } from 'react-redux'; // v8.1.0
import { TextField } from '@mui/material'; // v5.14.0
import SendIcon from '@mui/icons-material/Send'; // v5.14.0
import debounce from 'lodash/debounce'; // v4.17.21

import { NewMessage } from '../../../types/chat';
import { sendMessage } from '../../../redux/slices/chatSlice';
import { validateMarkdown, validateLatex } from '../../../utils/validation';

// Styles as constants for consistent theming
const INPUT_CONTAINER_STYLES = 'flex items-center gap-2 p-4 border-t border-gray-200 bg-white';
const TEXT_FIELD_STYLES = 'flex-1 min-h-[56px] aria-[invalid]:border-red-500';
const SEND_BUTTON_STYLES = 'p-2 rounded-full hover:bg-gray-100 disabled:opacity-50';
const MAX_MESSAGE_LENGTH = 4096;
const VALIDATION_DEBOUNCE_MS = 300;

interface ChatInputProps {
    chatSessionId: UUID;
    onMessageSent?: () => void;
    className?: string;
    maxLength?: number;
    enableMarkdown?: boolean;
    enableLatex?: boolean;
    offlineQueueEnabled?: boolean;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

const ChatInput: React.FC<ChatInputProps> = React.memo(({
    chatSessionId,
    onMessageSent,
    className = '',
    maxLength = MAX_MESSAGE_LENGTH,
    enableMarkdown = true,
    enableLatex = true,
    offlineQueueEnabled = true
}) => {
    const [message, setMessage] = useState('');
    const [validation, setValidation] = useState<ValidationResult>({
        isValid: true,
        errors: [],
        warnings: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const dispatch = useDispatch();

    // Debounced validation function
    const validateMessageContent = useCallback(
        debounce(async (content: string) => {
            const errors: string[] = [];
            const warnings: string[] = [];

            // Length validation
            if (content.length > maxLength) {
                errors.push(`Message exceeds maximum length of ${maxLength} characters`);
            }

            // Markdown validation
            if (enableMarkdown) {
                const markdownResult = await validateMarkdown(content);
                if (!markdownResult.isValid) {
                    errors.push(...markdownResult.errors);
                    warnings.push(...markdownResult.warnings);
                }
            }

            // LaTeX validation
            if (enableLatex) {
                const latexResult = await validateLatex(content);
                if (!latexResult.isValid) {
                    errors.push(...latexResult.errors);
                    warnings.push(...latexResult.warnings);
                }
            }

            setValidation({
                isValid: errors.length === 0,
                errors,
                warnings
            });
        }, VALIDATION_DEBOUNCE_MS),
        [maxLength, enableMarkdown, enableLatex]
    );

    // Handle input change
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newMessage = event.target.value;
        setMessage(newMessage);
        validateMessageContent(newMessage);
    };

    // Handle message submission
    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!message.trim() || !validation.isValid || isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        try {
            const newMessage: NewMessage = {
                content: message.trim(),
                sessionId: chatSessionId,
                metadata: {
                    hasMarkdown: enableMarkdown,
                    hasLatex: enableLatex
                }
            };

            // Handle offline scenario
            if (offlineQueueEnabled && !navigator.onLine) {
                const offlineQueue = JSON.parse(
                    localStorage.getItem('chatOfflineQueue') || '[]'
                );
                offlineQueue.push(newMessage);
                localStorage.setItem('chatOfflineQueue', JSON.stringify(offlineQueue));
                setMessage('');
                onMessageSent?.();
                return;
            }

            await dispatch(sendMessage(newMessage));
            setMessage('');
            onMessageSent?.();
        } catch (error) {
            console.error('Failed to send message:', error);
            setValidation(prev => ({
                ...prev,
                errors: [...prev.errors, 'Failed to send message. Please try again.']
            }));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle keyboard shortcuts
    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
        }
    };

    // Handle paste events
    const handlePaste = (event: React.ClipboardEvent) => {
        const pastedData = event.clipboardData.getData('text');
        if (pastedData.length + message.length > maxLength) {
            event.preventDefault();
            setValidation(prev => ({
                ...prev,
                errors: [`Pasted content would exceed maximum length of ${maxLength} characters`]
            }));
        }
    };

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <form 
            onSubmit={handleSubmit} 
            className={`${INPUT_CONTAINER_STYLES} ${className}`}
            aria-label="Chat message input form"
        >
            <TextField
                ref={inputRef}
                multiline
                maxRows={4}
                value={message}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                onPaste={handlePaste}
                placeholder="Type your message..."
                className={TEXT_FIELD_STYLES}
                error={validation.errors.length > 0}
                helperText={validation.errors[0] || validation.warnings[0]}
                disabled={isSubmitting}
                inputProps={{
                    'aria-label': 'Message input',
                    maxLength: maxLength,
                    'data-testid': 'chat-input'
                }}
            />
            <button
                type="submit"
                className={SEND_BUTTON_STYLES}
                disabled={!message.trim() || !validation.isValid || isSubmitting}
                aria-label="Send message"
                data-testid="send-button"
            >
                <SendIcon />
            </button>
        </form>
    );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;