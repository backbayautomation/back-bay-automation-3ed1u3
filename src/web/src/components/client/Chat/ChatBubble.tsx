import React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { Paper, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { Message, MessageRole } from '../../../types/chat';
import ContentLoader from '../../common/Loaders/ContentLoader';

// Version comments for external dependencies
// @mui/material: v5.14.0
// react-markdown: v8.0.0
// react-syntax-highlighter: v15.5.0

interface ChatBubbleProps {
  message: Message;
  isLoading?: boolean;
  className?: string;
}

const BubbleContainer = styled(Paper, {
  shouldForwardProp: prop => prop !== 'role'
})<{ role: MessageRole }>(({ theme, role }) => ({
  padding: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5),
  },
  maxWidth: '80%',
  [theme.breakpoints.down('sm')]: {
    maxWidth: '90%',
  },
  marginBottom: theme.spacing(1),
  marginLeft: role === MessageRole.USER ? 'auto' : theme.spacing(1),
  marginRight: role === MessageRole.USER ? theme.spacing(1) : 'auto',
  borderRadius: theme.shape.borderRadius,
  borderTopRightRadius: role === MessageRole.USER ? 4 : theme.shape.borderRadius,
  borderTopLeftRadius: role === MessageRole.USER ? theme.shape.borderRadius : 4,
  backgroundColor: role === MessageRole.USER 
    ? theme.palette.primary.main 
    : role === MessageRole.SYSTEM 
      ? theme.palette.grey[theme.palette.mode === 'light' ? 200 : 800]
      : theme.palette.background.paper,
  color: role === MessageRole.USER 
    ? theme.palette.primary.contrastText 
    : theme.palette.text.primary,
  transition: theme.transitions.create(['box-shadow', 'transform']),
  '&:hover': {
    boxShadow: theme.shadows[2],
  },
  '[dir="rtl"] &': {
    marginLeft: role === MessageRole.USER ? theme.spacing(1) : 'auto',
    marginRight: role === MessageRole.USER ? 'auto' : theme.spacing(1),
  }
}));

const MessageContent = styled(Typography)(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: '1rem',
  [theme.breakpoints.down('sm')]: {
    fontSize: '0.875rem',
  },
  lineHeight: 1.6,
  '& code': {
    backgroundColor: theme.palette.mode === 'light' 
      ? 'rgba(0, 0, 0, 0.04)' 
      : 'rgba(255, 255, 255, 0.04)',
    padding: '2px 4px',
    borderRadius: 4,
    fontFamily: 'Fira Mono, monospace',
  },
  '& pre': {
    margin: theme.spacing(2, 0),
    borderRadius: theme.shape.borderRadius,
    overflow: 'auto',
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'underline',
    '&:hover': {
      textDecoration: 'none',
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
    margin: theme.spacing(2, 0),
    '& th, & td': {
      border: `1px solid ${theme.palette.divider}`,
      padding: theme.spacing(1),
    },
  },
  '& blockquote': {
    borderLeft: `4px solid ${theme.palette.divider}`,
    margin: theme.spacing(2, 0),
    padding: theme.spacing(0, 2),
  }
}));

const formatTimestamp = (timestamp: Date): string => {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });

  if (diff < 24 * 60 * 60 * 1000) {
    return formatter.format(timestamp);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(timestamp);
};

const ChatBubble = React.memo<ChatBubbleProps>(({
  message,
  isLoading = false,
  className
}) => {
  const theme = useTheme();

  if (isLoading) {
    return (
      <BubbleContainer 
        role={message.role} 
        className={className}
        elevation={1}
        aria-busy="true"
      >
        <ContentLoader 
          height={40}
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
        role="textbox"
        aria-readonly="true"
        tabIndex={0}
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
                  style={theme.palette.mode === 'dark' ? 'vsDark' : 'vsLight'}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {message.content}
        </ReactMarkdown>
        <Typography
          variant="caption"
          component="time"
          sx={{
            display: 'block',
            marginTop: 1,
            opacity: 0.7,
            textAlign: message.role === MessageRole.USER ? 'right' : 'left',
          }}
          dateTime={message.timestamp.toISOString()}
        >
          {formatTimestamp(message.timestamp)}
        </Typography>
      </MessageContent>
    </BubbleContainer>
  );
});

ChatBubble.displayName = 'ChatBubble';

export default ChatBubble;