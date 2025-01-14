import React from 'react'; // react@18.2.0
import { styled } from '@mui/material/styles'; // @mui/material/styles@5.14.0
import { Paper, Typography } from '@mui/material'; // @mui/material@5.14.0
import ReactMarkdown from 'react-markdown'; // react-markdown@8.0.0
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'; // react-syntax-highlighter@15.5.0
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'; // react-syntax-highlighter@15.5.0

import { Message, MessageRole } from '../../../types/chat';
import ContentLoader from '../../common/Loaders/ContentLoader';

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
  borderRadius: theme.spacing(1.5),
  borderTopRightRadius: role === MessageRole.USER ? theme.spacing(0.5) : theme.spacing(1.5),
  borderTopLeftRadius: role === MessageRole.ASSISTANT ? theme.spacing(0.5) : theme.spacing(1.5),
  backgroundColor: role === MessageRole.USER 
    ? theme.palette.primary.main
    : role === MessageRole.SYSTEM 
      ? theme.palette.grey[700]
      : theme.palette.background.paper,
  color: role === MessageRole.USER 
    ? theme.palette.primary.contrastText
    : role === MessageRole.SYSTEM 
      ? theme.palette.common.white
      : theme.palette.text.primary,
  transition: theme.transitions.create(['box-shadow'], {
    duration: theme.transitions.duration.short
  }),
  '&:hover': {
    boxShadow: theme.shadows[2]
  },
  direction: 'ltr', // Ensure proper display in RTL layouts
}));

const MessageContent = styled(Typography)(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: '1rem',
  [theme.breakpoints.down('sm')]: {
    fontSize: '0.875rem',
  },
  lineHeight: 1.6,
  '& code': {
    fontFamily: '"Fira Mono", monospace',
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.mode === 'light' 
      ? 'rgba(0, 0, 0, 0.04)'
      : 'rgba(255, 255, 255, 0.04)',
  },
  '& pre': {
    margin: theme.spacing(1, 0),
    padding: 0,
    backgroundColor: 'transparent',
  },
  '& a': {
    color: 'inherit',
    textDecoration: 'underline',
    '&:hover': {
      textDecoration: 'none',
    },
    '&:focus': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  '& p': {
    margin: theme.spacing(0.5, 0),
    '&:first-of-type': {
      marginTop: 0,
    },
    '&:last-of-type': {
      marginBottom: 0,
    },
  },
  '& ul, & ol': {
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    paddingLeft: theme.spacing(2.5),
  },
}));

const formatTimestamp = (timestamp: Date): string => {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });

  if (diff < 24 * 60 * 60 * 1000) { // Less than 24 hours
    return formatter.format(timestamp);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(timestamp);
};

const ChatBubble = React.memo<ChatBubbleProps>(({
  message,
  isLoading = false,
  className
}) => {
  const renderCode = React.useCallback(({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    return !inline && language ? (
      <SyntaxHighlighter
        language={language}
        style={atomDark}
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
  }, []);

  if (isLoading) {
    return (
      <BubbleContainer 
        role={message.role}
        elevation={1}
        className={className}
        component="article"
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
      elevation={1}
      className={className}
      component="article"
      aria-label={`${message.role} message from ${formatTimestamp(message.timestamp)}`}
    >
      <MessageContent component="div">
        <ReactMarkdown
          components={{
            code: renderCode,
            a: ({ node, children, href, ...props }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            ),
          }}
          remarkPlugins={[]}
        >
          {message.content}
        </ReactMarkdown>
      </MessageContent>
    </BubbleContainer>
  );
});

ChatBubble.displayName = 'ChatBubble';

export default ChatBubble;