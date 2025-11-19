// CodeViewer.jsx
// Displays code with syntax highlighting

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './CodeViewer.css';

export default function CodeViewer({ code, language = 'text' }) {
  if (!code) {
    return <div className="no-code">No code provided</div>;
  }

  // Map common language identifiers
  const languageMap = {
    'python': 'python',
    'javascript': 'javascript',
    'js': 'javascript',
    'typescript': 'typescript',
    'ts': 'typescript',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'sql': 'sql'
  };

  const mappedLanguage = languageMap[language.toLowerCase()] || language.toLowerCase() || 'text';

  return (
    <div className="code-viewer">
      <div className="code-viewer-header">
        <span className="language-label">{mappedLanguage}</span>
        <button 
          className="copy-btn"
          onClick={() => {
            navigator.clipboard.writeText(code);
          }}
        >
          Copy
        </button>
      </div>
      <SyntaxHighlighter
        language={mappedLanguage}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 4px 4px'
        }}
        showLineNumbers
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
