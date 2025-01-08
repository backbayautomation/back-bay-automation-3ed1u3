import React from 'react'; // ^18.2.0
import { styled } from '@mui/material/styles'; // ^5.14.0
import { Paper, Typography } from '@mui/material'; // ^5.14.0
import ReactMarkdown from 'react-markdown'; // ^8.0.0
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'; // ^15.5.0
import { Message, MessageRole } from '../../../types/chat';
import ContentLoader from '../../common/Loaders/ContentLoader';

// Props interface for the ChatBubble component
interface ChatBubbleProps {
  message: Message;
  isLoading?: boolean;
  className?: string;
}

// Styled container for the chat bubble with role-based styling
const BubbleContainer = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'role',
})<{ role: MessageRole }>(({ theme, role }) => ({
  padding: theme.spacing(2),
  maxWidth: {
    xs: '90%',
    sm: '80%',
  },
  margin: theme.spacing(1),
  marginLeft: role === MessageRole.USER ? 'auto' : theme.spacing(1),
  marginRight: role === MessageRole.USER ? theme.spacing(1) : 'auto',
  backgroundColor: role === MessageRole.USER 
    ? theme.palette.primary.main
    : role === MessageRole.SYSTEM 
      ? theme.palette.grey[100]
      : theme.palette.background.paper,
  color: role === MessageRole.USER 
    ? theme.palette.primary.contrastText
    : theme.palette.text.primary,
  borderRadius: theme.shape.borderRadius * 1.5,
  borderTopRightRadius: role === MessageRole.USER ? theme.shape.borderRadius / 2 : undefined,
  borderTopLeftRadius: role === MessageRole.USER ? undefined : theme.shape.borderRadius / 2,
  transition: theme.transitions.create(['box-shadow']),
  '&:hover': {
    boxShadow: theme.shadows[2],
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5),
  },
}));

// Styled content wrapper with typography controls
const MessageContent = styled(Typography)(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: {
    xs: 14,
    sm: 16,
  },
  lineHeight: 1.6,
  '& code': {
    backgroundColor: theme.palette.mode === 'light' 
      ? theme.palette.grey[100] 
      : theme.palette.grey[900],
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.shape.borderRadius / 2,
    fontFamily: 'Fira Mono, monospace',
  },
  '& pre': {
    margin: theme.spacing(1, 0),
    borderRadius: theme.shape.borderRadius,
    overflow: 'auto',
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'underline',
    '&:hover': {
      color: theme.palette.primary.dark,
    },
  },
  '& img': {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: theme.shape.borderRadius,
  },
  '& table': {
    borderCollapse: 'collapse',
    width: '100%',
    '& th, & td': {
      border: `1px solid ${theme.palette.divider}`,
      padding: theme.spacing(0.5, 1),
    },
  },
}));

// Timestamp formatter with localization support
const formatTimestamp = (timestamp: Date): string => {
  return new Intl.DateTimeFormat('default', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(timestamp);
};

// Memoized ChatBubble component for optimal performance
const ChatBubble = React.memo<ChatBubbleProps>(({
  message,
  isLoading = false,
  className,
}) => {
  // Early return for loading state
  if (isLoading) {
    return (
      <BubbleContainer 
        role={message.role}
        className={className}
        elevation={1}
        aria-busy="true"
      >
        <ContentLoader 
          height={60}
          width="100%"
          ariaLabel="Loading message content..."
        />
      </BubbleContainer>
    );
  }

  return (
    <BubbleContainer
      role={message.role}
      className={className}
      elevation={1}
      aria-label={`${message.role} message`}
      component="article"
    >
      <MessageContent
        component="div"
        variant="body1"
        color="inherit"
      >
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
          remarkPlugins={[]}
          skipHtml={true}
        >
          {message.content}
        </ReactMarkdown>
      </MessageContent>
      <Typography
        variant="caption"
        component="time"
        sx={(theme) => ({
          display: 'block',
          textAlign: message.role === MessageRole.USER ? 'right' : 'left',
          marginTop: theme.spacing(0.5),
          color: message.role === MessageRole.USER 
            ? 'rgba(255, 255, 255, 0.7)'
            : theme.palette.text.secondary,
          fontSize: theme.typography.caption.fontSize,
        })}
        dateTime={message.timestamp.toISOString()}
      >
        {formatTimestamp(message.timestamp)}
      </Typography>
    </BubbleContainer>
  );
});

// Display name for debugging
ChatBubble.displayName = 'ChatBubble';

export default ChatBubble;