'use client'

/**
 * Markdown — shared, theme-agnostic renderer for memory/recollection text
 * (QA item 7). Memory content_raw is verbatim under the Raw Vault
 * invariant; when the user pastes research notes that text *is* markdown,
 * so rendering it as markdown is faithful, not a transformation.
 *
 * Colour is inherited (text-current / no hardcoded hues) so the same
 * component reads correctly on the light /memories cards and on the dark
 * glass globe surfaces. GitHub-flavoured markdown (tables, lists, etc.)
 * via remark-gfm. Raw HTML is NOT enabled, so pasted text can't inject
 * markup — react-markdown escapes it by default.
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Markdown({
  children,
  className = '',
}: {
  children: string
  className?: string
}) {
  return (
    <div className={`lc-markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed" {...props} />,
          h1: ({ node, ...props }) => <h1 className="mt-3 mb-1 text-base font-semibold" {...props} />,
          h2: ({ node, ...props }) => <h2 className="mt-3 mb-1 text-base font-semibold" {...props} />,
          h3: ({ node, ...props }) => <h3 className="mt-3 mb-1 text-sm font-semibold" {...props} />,
          ul: ({ node, ...props }) => <ul className="my-2 list-disc space-y-0.5 pl-5" {...props} />,
          ol: ({ node, ...props }) => <ol className="my-2 list-decimal space-y-0.5 pl-5" {...props} />,
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="my-2 border-l-2 border-current/30 pl-3 opacity-90" {...props} />
          ),
          code: ({ node, ...props }) => (
            <code className="rounded bg-current/10 px-1 py-0.5 font-mono text-[0.85em]" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="underline underline-offset-2 hover:opacity-80" target="_blank" rel="noreferrer" {...props} />
          ),
          hr: ({ node, ...props }) => <hr className="my-3 border-current/20" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
