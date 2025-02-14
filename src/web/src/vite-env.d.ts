/// <reference types="vite/client" /> // vite ^4.4.9

// Environment variable declarations
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_API_URL: string;
  readonly VITE_AUTH_DOMAIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Asset type definitions
export interface ImageAsset {
  src: string;
}

export interface SVGComponent {
  ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  src: string;
}

// Static asset module declarations
declare module '*.svg' {
  const content: SVGComponent;
  export default content;
}

declare module '*.png' {
  const content: ImageAsset;
  export default content;
}

declare module '*.jpg' {
  const content: ImageAsset;
  export default content;
}

declare module '*.jpeg' {
  const content: ImageAsset;
  export default content;
}

declare module '*.gif' {
  const content: ImageAsset;
  export default content;
}

declare module '*.webp' {
  const content: ImageAsset;
  export default content;
}

// Style module declarations
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}