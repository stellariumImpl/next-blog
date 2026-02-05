import type { Components } from 'react-markdown';
import { createSlugger, stripMarkdown, type Slugger } from '@/lib/markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import CodeBlock from '@/components/markdown/code-block';

const iframeAttributes = [
  'src',
  'width',
  'height',
  'allow',
  'allowfullscreen',
  'allowFullScreen',
  'frameborder',
  'loading',
  'referrerpolicy',
];

const markdownSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'iframe',
    'span',
    'img',
    'math',
    'annotation',
    'annotation-xml',
    'semantics',
    'mrow',
    'mo',
    'mi',
    'mn',
    'msup',
    'msub',
    'mfrac',
    'msqrt',
    'mroot',
    'mtable',
    'mtr',
    'mtd',
  ],
  attributes: {
    ...defaultSchema.attributes,
    iframe: iframeAttributes,
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    span: ['className', 'style'],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading', 'decoding'],
    math: ['display'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), 'data'],
  },
};

export const markdownPlugins = {
  remarkPlugins: [remarkGfm, remarkMath],
  rehypePlugins: [
    rehypeRaw,
    rehypeKatex,
    [rehypeSanitize, markdownSchema],
    [rehypeHighlight, { ignoreMissing: true }],
  ],
};

function textFromChildren(children: any): string {
  const value = Array.isArray(children) ? children : [children];
  return value
    .map((child) => {
      if (typeof child === 'string') return child;
      if (typeof child === 'number') return String(child);
      if (Array.isArray(child)) return child.join('');
      if (child && typeof child === 'object' && 'props' in child) {
        return textFromChildren((child as any).props?.children);
      }
      return '';
    })
    .join('');
}

export function createMarkdownComponents(slugger?: Slugger): Components {
  const localSlugger = slugger ?? createSlugger();
  const heading =
    (level: 1 | 2 | 3 | 4 | 5 | 6) =>
    ({ node, children, ...props }: any) => {
      const rawText = textFromChildren(children);
      const text = stripMarkdown(rawText);
      const id = text ? localSlugger.slug(text) : undefined;
      const Tag = `h${level}` as const;
      return (
        <Tag {...props} id={id}>
          {children}
        </Tag>
      );
    };

  return {
    a: ({ node, ...props }) => (
      <a
        {...props}
        className="underline text-[color:var(--accent)] hover:text-[color:var(--app-text)]"
        rel="noopener noreferrer"
        target="_blank"
      />
    ),
    img: ({ node, ...props }) => (
      <img
        {...props}
        className="my-4 max-w-full rounded border border-[color:var(--border)]"
        alt={props.alt ?? ''}
      />
    ),
    iframe: ({ node, ...props }) => (
      <div className="my-4 overflow-hidden rounded border border-[color:var(--border)]">
        <iframe {...props} className="h-64 w-full" />
      </div>
    ),
    pre: ({ node, className, children, ...props }) => {
      // Extract meta from node's properties or data-attributes
      const properties = node?.properties || {};
      
      // Helper to get string value
      const getString = (value: any): string | undefined => {
        if (value == null) return undefined;
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return undefined;
      };
      
      // Try to get meta from data-meta attribute or meta property
      let metaString = getString(properties['data-meta'] || properties['meta']);
      
      // If no meta string, check if there's a meta field in node.data
      if (!metaString && node?.data?.meta) {
        metaString = String(node.data.meta);
      }
      
      // Parse meta string (e.g., "filename=\"app.js\" description=\"main file\"")
      let parsedFilename: string | undefined;
      let parsedDescription: string | undefined;
      let parsedLanguage: string | undefined;
      
      if (metaString) {
        // Simple key-value parsing: key="value" key2="value2"
        const regex = /(\w+)=["']([^"']*)["']/g;
        let match;
        while ((match = regex.exec(metaString)) !== null) {
          const [, key, value] = match;
          if (key === 'filename') parsedFilename = value;
          if (key === 'description') parsedDescription = value;
          if (key === 'language') parsedLanguage = value;
        }
      }
      
      // Fallback to direct attributes
      const dataFilename = parsedFilename || getString(properties['data-filename'] || properties['filename']);
      const dataDescription = parsedDescription || getString(properties['data-description'] || properties['description']);
      const dataLanguage = parsedLanguage || getString(properties['data-language'] || properties['language']);
      
      // Debug log in development
      if (process.env.NODE_ENV === 'development') {
        console.log('CodeBlock node:', node);
        console.log('CodeBlock className:', className);
        console.log('CodeBlock properties:', properties);
        console.log('Parsed meta:', { dataFilename, dataDescription, dataLanguage });
      }
      
      return (
        <CodeBlock
          className={className}
          data-filename={dataFilename}
          data-description={dataDescription}
          data-language={dataLanguage}
          node={node}
          {...props}
        >
          {children}
        </CodeBlock>
      );
    },
    code: ({ node, className, children, ...props }) => {
      // Determine if this is an inline code or block code
      // Block code typically has a language class (e.g., "language-js")
      const isBlock = className?.includes('language-');
      if (isBlock) {
        // For block code, just render children (pre handles the wrapper)
        return children;
      }
      // Inline code: force-clean text to avoid literal backticks showing
      const processedChildren = textFromChildren(children).replace(/`/g, '');
      return (
        <code className={className} {...props}>
          {processedChildren}
        </code>
      );
    },
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    h5: heading(5),
    h6: heading(6),
  };
}

export const markdownComponents: Components = createMarkdownComponents();
