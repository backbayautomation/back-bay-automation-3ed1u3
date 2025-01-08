/**
 * Central icon system for the AI-powered Product Catalog Search System
 * Provides accessibility-compliant Material Design icons for both admin and client portals
 * @version 5.14.0 Material-UI Icons
 */

import { SvgIcon } from '@mui/material'; // v5.14.0
import {
  Dashboard,
  People,
  Description,
  Analytics,
  Settings,
  Help,
  Close,
  Add,
  Search,
  Chat,
  Upload,
  Warning
} from '@mui/icons-material'; // v5.14.0

// Navigation Icons
export const DashboardIcon = (props: typeof SvgIcon.defaultProps) => (
  <Dashboard
    {...props}
    aria-label="Dashboard"
    role="img"
    titleAccess="System Dashboard"
  />
);

export const ClientsIcon = (props: typeof SvgIcon.defaultProps) => (
  <People
    {...props}
    aria-label="Clients"
    role="img"
    titleAccess="Client Management"
  />
);

export const DocumentsIcon = (props: typeof SvgIcon.defaultProps) => (
  <Description
    {...props}
    aria-label="Documents"
    role="img"
    titleAccess="Document Management"
  />
);

export const AnalyticsIcon = (props: typeof SvgIcon.defaultProps) => (
  <Analytics
    {...props}
    aria-label="Analytics"
    role="img"
    titleAccess="System Analytics"
  />
);

// System Icons
export const SettingsIcon = (props: typeof SvgIcon.defaultProps) => (
  <Settings
    {...props}
    aria-label="Settings"
    role="img"
    titleAccess="System Settings"
  />
);

export const HelpIcon = (props: typeof SvgIcon.defaultProps) => (
  <Help
    {...props}
    aria-label="Help"
    role="img"
    titleAccess="Get Help"
  />
);

export const CloseIcon = (props: typeof SvgIcon.defaultProps) => (
  <Close
    {...props}
    aria-label="Close"
    role="img"
    titleAccess="Close or Remove"
  />
);

// Action Icons
export const AddIcon = (props: typeof SvgIcon.defaultProps) => (
  <Add
    {...props}
    aria-label="Add New"
    role="img"
    titleAccess="Add New Item"
  />
);

export const SearchIcon = (props: typeof SvgIcon.defaultProps) => (
  <Search
    {...props}
    aria-label="Search"
    role="img"
    titleAccess="Search Content"
  />
);

export const ChatIcon = (props: typeof SvgIcon.defaultProps) => (
  <Chat
    {...props}
    aria-label="Chat"
    role="img"
    titleAccess="Chat Interface"
  />
);

export const UploadIcon = (props: typeof SvgIcon.defaultProps) => (
  <Upload
    {...props}
    aria-label="Upload"
    role="img"
    titleAccess="Upload Document"
  />
);

// Status Icons
export const WarningIcon = (props: typeof SvgIcon.defaultProps) => (
  <Warning
    {...props}
    aria-label="Warning"
    role="img"
    titleAccess="Warning or Alert"
  />
);