/**
 * ChatInput component providing rich text input functionality with markdown,
 * code block, and LaTeX equation support for the chat interface.
 * @version 1.0.0
 */

// External imports
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { TextField, IconButton, Box, Tooltip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { debounce } from 'lodash';

// Internal imports
import { NewMessage } from '../../../types/chat';
import { sendMessage } from '../../../redux/slices/chatSlice';
import { validateMarkdown, validateLatex } from '../../../utils/validation';
import { VALIDATION_CONSTANTS } from '../../../config/constants';

// Styles
const INPUT_CONTAINER_STYLES = 'flex items-center gap-2 p-4 border-t border-gray-200 bg-white';
const TEXT_FIELD_STYLES = 'flex-1 min-h-[56px] aria-[invalid]:border-red-500';
const SEND_BUTTON_STYLES = 'p-2 rounded-full hover:bg-gray-100 disabled:opacity-50';

// Constants
const MAX_MESSAGE_LENGTH = 4096;
const VALIDATION_DEBOUNCE_MS = 300;

// Interfaces
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

/**
 * ChatInput component for composing and sending messages
 */
const ChatInput: React.FC<ChatInputProps> = React.memo(({
    chatSessionId,
    onMessageSent,
    className = '',
    maxLength = MAX_MESSAGE_LENGTH,
    enableMarkdown = true,
    enableLatex = true,
    offlineQueueEnabled = true
}) => {
    // State
    const [message, setMessage] = useState('');
    const [validation, setValidation] = useState<ValidationResult>({
        isValid: true,
        errors: [],
        warnings: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const dispatch = useDispatch();

    // Validation function
    const validateMessage = useCallback(async (content: string): Promise<ValidationResult> => {
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
        if (enableLatex && content.includes('$')) {
            const latexResult = await validateLatex(content);
            if (!latexResult.isValid) {
                errors.push(...latexResult.errors);
                warnings.push(...latexResult.warnings);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }, [maxLength, enableMarkdown, enableLatex]);

    // Debounced validation
    const debouncedValidate = useCallback(
        debounce(async (content: string) => {
            const result = await validateMessage(content);
            setValidation(result);
        }, VALIDATION_DEBOUNCE_MS),
        [validateMessage]
    );

    // Handle input change
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newMessage = event.target.value;
        setMessage(newMessage);
        debouncedValidate(newMessage);
    };

    // Handle message submission
    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        
        if (!message.trim() || isSubmitting || !validation.isValid) {
            return;
        }

        setIsSubmitting(true);

        try {
            const newMessage: NewMessage = {
                content: message.trim(),
                sessionId: chatSessionId,
                metadata: {
                    hasMarkdown: enableMarkdown && /[*_`#]/.test(message),
                    hasLatex: enableLatex && message.includes('$')
                }
            };

            await dispatch(sendMessage(newMessage));
            setMessage('');
            onMessageSent?.();
            
        } catch (error) {
            console.error('Failed to send message:', error);
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

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            className={`${INPUT_CONTAINER_STYLES} ${className}`}
            role="region"
            aria-label="Message composition"
        >
            <TextField
                ref={inputRef}
                multiline
                maxRows={4}
                value={message}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className={TEXT_FIELD_STYLES}
                error={!validation.isValid}
                helperText={validation.errors[0] || validation.warnings[0]}
                disabled={isSubmitting}
                inputProps={{
                    maxLength,
                    'aria-label': 'Message input',
                    'data-testid': 'chat-input'
                }}
                FormHelperTextProps={{
                    'data-testid': 'chat-input-helper'
                }}
            />
            <Tooltip title={validation.isValid ? 'Send message' : 'Please fix validation errors'}>
                <span>
                    <IconButton
                        type="submit"
                        className={SEND_BUTTON_STYLES}
                        disabled={!validation.isValid || !message.trim() || isSubmitting}
                        aria-label="Send message"
                        data-testid="send-button"
                    >
                        <SendIcon />
                    </IconButton>
                </span>
            </Tooltip>
        </Box>
    );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;