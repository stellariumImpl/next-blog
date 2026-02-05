'use client';

import ReactMarkdown from 'react-markdown';
import { createSlugger } from '@/lib/markdown';
import { createMarkdownComponents, markdownPlugins } from '@/components/markdown/markdown-config';

export default function MarkdownPreview({ content }: { content: string }) {
  const slugger = createSlugger();
  const components = createMarkdownComponents(slugger);
  return (
    <ReactMarkdown {...markdownPlugins} components={components}>
      {content}
    </ReactMarkdown>
  );
}
