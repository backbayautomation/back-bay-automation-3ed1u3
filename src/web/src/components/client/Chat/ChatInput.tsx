/**
 * ChatInput component providing rich text input interface for chat messages
 * Supports markdown, code blocks, and LaTeX equations with validation
 * @version 1.0.0
 */

// External imports - versions specified as per requirements
import React, { useState, useCallback, useRef, useEffect } from 'react'; // v18.2.0
import { useDispatch } from 'react-redux'; // v8.1.0
import { TextField, IconButton, Tooltip } from '@mui/material'; // v5.14.0
import SendIcon from '@mui/icons-material/Send'; // v5.14.0
import debounce from 'lodash/debounce'; // v4.17.21

// Internal imports
import { NewMessage } from '../../../types/chat';
import { sendMessage } from '../../../redux/slices/chatSlice';
import { validateMarkdown, validateLatex } from '../../../utils/validation';

// Constants
const INPUT_CONTAINER_STYLES = 'flex items-center gap-2 p-4 border-t border-gray-200 bg-white';
const TEXT_FIELD_STYLES = 'flex-1 min-h-[56px] aria-[invalid]:border-red-500';
const SEND_BUTTON_STYLES = 'p-2 rounded-full hover:bg-gray-100 disabled:opacity-50';
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
 * Chat input component with rich text support and validation
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
  // State management
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
    if (enableLatex) {
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

  // Input change handler
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    setMessage(newValue);
    debouncedValidate(newValue);
  }, [debouncedValidate]);

  // Keyboard shortcuts
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }, [message, validation.isValid]);

  // Message submission handler
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
        // Queue message for later sending
        const queuedMessages = JSON.parse(localStorage.getItem('queuedMessages') || '[]');
        localStorage.setItem('queuedMessages', JSON.stringify([...queuedMessages, newMessage]));
        
        // Optimistic UI update
        setMessage('');
        onMessageSent?.();
      } else {
        await dispatch(sendMessage(newMessage));
        setMessage('');
        onMessageSent?.();
      }
    } catch (error) {
      setValidation(prev => ({
        ...prev,
        errors: [...prev.errors, 'Failed to send message. Please try again.']
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedValidate.cancel();
    };
  }, [debouncedValidate]);

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
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        placeholder="Type your message..."
        className={TEXT_FIELD_STYLES}
        error={!validation.isValid}
        helperText={validation.errors[0] || validation.warnings[0]}
        disabled={isSubmitting}
        inputProps={{
          'aria-label': 'Message input',
          maxLength,
          'data-testid': 'chat-input'
        }}
        FormHelperTextProps={{
          'data-testid': 'chat-input-helper-text'
        }}
      />
      <Tooltip title={validation.isValid ? 'Send message' : 'Please fix validation errors'}>
        <span>
          <IconButton
            type="submit"
            className={SEND_BUTTON_STYLES}
            disabled={!message.trim() || !validation.isValid || isSubmitting}
            aria-label="Send message"
            data-testid="send-message-button"
          >
            <SendIcon />
          </IconButton>
        </span>
      </Tooltip>
    </form>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;