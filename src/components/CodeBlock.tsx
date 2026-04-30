import React, { useState, useEffect } from 'react';
import { Copy, Check, Play, Code } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);
  const isHtml = language?.toLowerCase() === 'html' || language?.toLowerCase() === 'xml';
  const [showPreview, setShowPreview] = useState(isHtml);
  const [previewContent, setPreviewContent] = useState(value);

  // Debounce the iframe content update so streaming doesn't constantly reload and break running scripts
  useEffect(() => {
    if (!showPreview) return;
    const handler = setTimeout(() => {
      setPreviewContent(value);
    }, 1000);
    return () => clearTimeout(handler);
  }, [value, showPreview]);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden bg-[#1E1E1E] border border-white/10 shadow-lg font-mono text-xs w-full max-w-full pr-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#151515] border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">{language || 'Code'}</span>
          
          {isHtml && (
            <div className="flex bg-black/30 rounded p-0.5">
              <button
                onClick={() => setShowPreview(false)}
                className={`flex items-center gap-1 xl:px-2 px-1.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold transition-colors ${!showPreview ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <Code size={10} />
                Code
              </button>
              <button
                onClick={() => setShowPreview(true)}
                className={`flex items-center gap-1 xl:px-2 px-1.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold transition-colors ${showPreview ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <Play size={10} />
                Preview
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors border border-white/5 shrink-0 ml-2"
        >
          {copied ? <Check size={12} className="text-[#00ff88]" /> : <Copy size={12} />}
          {copied ? <span className="text-[#00ff88] font-medium text-[10px] hidden sm:inline">Tersalin!</span> : <span className="font-medium text-[10px] hidden sm:inline">Salin</span>}
        </button>
      </div>
      {/* Content */}
      {showPreview ? (
        <div className="bg-[#ffffff] w-full overflow-hidden relative">
          <iframe
            srcDoc={previewContent}
            className="w-full h-[400px] border-0 bg-[#ffffff]"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
            title="Preview"
          />
        </div>
      ) : (
        <div className="p-3 select-none w-full max-w-full overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <pre className="text-neutral-300 pointer-events-none text-[12px] leading-relaxed m-0 p-0 w-max min-w-full pr-4">
            <code>{value}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
