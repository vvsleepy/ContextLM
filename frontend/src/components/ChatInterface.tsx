import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  Send,
  User,
  Bot,
  Loader2,
  Trash2,
  Copy,
  Check,
} from "lucide-react";

interface RetrievedChunk {
  id: string;
  score: number;
  pageContent: string;
  chunkIndex: number | null;
  source: string;
  metadata: unknown;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  matches?: RetrievedChunk[];
}

// ---------------------------------------------------------------------------
// Source tooltip — Portal-based with viewport clamping
// ---------------------------------------------------------------------------
const TOOLTIP_WIDTH = 288;

function SourceTooltip({
  match,
  index,
  containerRef,
}: {
  match: RetrievedChunk;
  index: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const metadata = match.metadata as { loc?: { pageNumber?: number } } | null;
  const pageNumber = metadata?.loc?.pageNumber;
  const badgeText = pageNumber ? `p. ${pageNumber}` : index;

  const handleMouseEnter = () => {
    if (buttonRef.current && containerRef.current) {
      const btnRect = buttonRef.current.getBoundingClientRect();
      const contRect = containerRef.current.getBoundingClientRect();

      let left = btnRect.left + btnRect.width / 2 - TOOLTIP_WIDTH / 2;

      const minLeft = contRect.left + 16;
      const maxLeft = contRect.right - TOOLTIP_WIDTH - 16;
      left = Math.max(minLeft, Math.min(left, maxLeft));

      const top = btnRect.top - 8;

      setCoords({ top, left });
      setShow(true);
    }
  };

  return (
    <span className="inline-block mx-0.5">
      <button
        ref={buttonRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
        className="h-4 px-1.5 text-[9px] font-bold bg-pink-100 text-pink-600 rounded-full inline-flex items-center justify-center hover:bg-pink-200 hover:text-pink-700 transition-all shadow-sm align-super whitespace-nowrap"
      >
        {badgeText}
      </button>

      {show &&
        createPortal(
          <div
            className="fixed z-[100] w-72 p-3 bg-white border border-pink-100 rounded-lg shadow-2xl pointer-events-none animate-in fade-in slide-in-from-bottom-1"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: "translateY(-100%)",
            }}
          >
            <div className="text-[11px] font-medium text-neutral-700 mb-2 pb-2 border-b border-pink-100 flex items-center justify-between">
              <span className="truncate pr-2">{match.source}</span>

              <span className="text-neutral-500 whitespace-nowrap">
                {pageNumber
                  ? `Page ${pageNumber}`
                  : `Chunk #${match.chunkIndex}`}
              </span>
            </div>

            <div className="text-[12px] leading-relaxed text-neutral-600">
              "
              {match.pageContent.length > 200
                ? match.pageContent.substring(0, 200) + "..."
                : match.pageContent}
              "
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Code block component with copy button
// ---------------------------------------------------------------------------
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-pink-100 bg-[#fff0f6]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-pink-50 border-b border-pink-100">
        <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
          {lang || "code"}
        </span>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-pink-500 transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-neutral-700 font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline markdown renderer
// ---------------------------------------------------------------------------
function renderInline(
  text: string,
  matches: RetrievedChunk[],
  keyPrefix: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
): React.ReactNode[] {
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);

  return boldParts.flatMap((bPart, bIdx) => {
    if (bPart.startsWith("**") && bPart.endsWith("**")) {
      return (
        <strong
          key={`${keyPrefix}-bold-${bIdx}`}
          className="font-bold text-neutral-800"
        >
          {renderInline(
            bPart.slice(2, -2),
            matches,
            `${keyPrefix}-bold-${bIdx}`,
            containerRef,
          )}
        </strong>
      );
    }

    const inlineParts = bPart.split(/(`[^`]+`)/g);

    return inlineParts.flatMap((part, i) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        const code = part.slice(1, -1);

        return (
          <code
            key={`${keyPrefix}-ic-${i}`}
            className="px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 font-mono text-[12px] border border-pink-200"
          >
            {code}
          </code>
        );
      }

      const citParts = part.split(/(\[\d+\])/g);

      return citParts.map((cit, j) => {
        const citMatch = cit.match(/^\[(\d+)\]$/);

        if (citMatch) {
          const sourceIndex = parseInt(citMatch[1]) - 1;
          const sourceMatch = matches[sourceIndex];

          if (sourceMatch) {
            return (
              <SourceTooltip
                key={`${keyPrefix}-ic-${i}-cit-${j}`}
                match={sourceMatch}
                index={sourceIndex + 1}
                containerRef={containerRef}
              />
            );
          }
        }

        return <span key={`${keyPrefix}-ic-${i}-txt-${j}`}>{cit}</span>;
      });
    });
  });
}

function renderMessageContent(
  content: string,
  matches: RetrievedChunk[] = [],
  containerRef: React.RefObject<HTMLDivElement | null>,
): React.ReactNode {
  const fencedRegex = /```([^\n]*)\n([\s\S]*?)```/g;

  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let blockCount = 0;
  let match: RegExpExecArray | null;

  const renderTextSegment = (text: string, segmentIndex: number) => {
    const paragraphs = text.split(/\n\s*\n/);

    return paragraphs.map((para, pIdx) => {
      const trimmedPara = para.trim();

      if (!trimmedPara) return null;

      const listMatch = trimmedPara.match(/^(\d+\.|[*•-])\s+(.*)/s);

      if (listMatch) {
        const marker = listMatch[1];
        const content = listMatch[2];

        return (
          <div
            key={`seg-${segmentIndex}-l-${pIdx}`}
            className="flex gap-3 mb-3 pl-2 last:mb-0"
          >
            <span className="text-neutral-500 font-mono text-sm shrink-0 mt-0.5">
              {marker}
            </span>

            <div className="flex-1">
              {renderInline(
                content,
                matches,
                `seg-${segmentIndex}-l-${pIdx}`,
                containerRef,
              )}
            </div>
          </div>
        );
      }

      return (
        <p
          key={`seg-${segmentIndex}-p-${pIdx}`}
          className="mb-4 last:mb-0 leading-relaxed tracking-wide"
        >
          {renderInline(
            trimmedPara,
            matches,
            `seg-${segmentIndex}-p-${pIdx}`,
            containerRef,
          )}
        </p>
      );
    });
  };

  while ((match = fencedRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);

    if (before) {
      segments.push(
        <div key={`text-${blockCount}`}>
          {renderTextSegment(before, blockCount)}
        </div>,
      );
    }

    const lang = match[1].trim();
    const code = match[2];

    segments.push(
      <CodeBlock key={`code-${blockCount}`} code={code} lang={lang} />,
    );

    lastIndex = match.index + match[0].length;
    blockCount++;
  }

  const remaining = content.slice(lastIndex);

  if (remaining) {
    segments.push(
      <div key={`text-${blockCount}`}>
        {renderTextSegment(remaining, blockCount)}
      </div>,
    );
  }

  return <>{segments}</>;
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------
const STORAGE_KEY = "ContextLM_chat";
const API_URL = import.meta.env.VITE_API_URL || "";

const DEFAULT_MESSAGE: Message = {
  id: "1",
  role: "assistant",
  content:
    "Hello! I'm ContextLM. Upload a document and ask me anything about it.",
  timestamp: new Date(),
};

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [DEFAULT_MESSAGE];

    const parsed = JSON.parse(raw) as (Omit<Message, "timestamp"> & {
      timestamp: string;
    })[];

    return parsed.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [DEFAULT_MESSAGE];
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface ChatInterfaceProps {
  hasDocuments: boolean;
  isInitialLoading: boolean;
}

export function ChatInterface({
  hasDocuments,
  isInitialLoading,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Persist messages
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-focus
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (
        e.key.length !== 1 ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.activeElement === inputRef.current
      )
        return;

      inputRef.current?.focus();
    };

    window.addEventListener("keydown", handleGlobalKey);

    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  const clearChat = () => {
    const fresh = [
      {
        ...DEFAULT_MESSAGE,
        id: Date.now().toString(),
        timestamp: new Date(),
      },
    ];

    setMessages(fresh);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    setInput("");
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/ask`, {
        question: input,
      });

      const data = response.data;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date(),
        matches: data.matches,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      let errorMessageText =
        "Sorry, I encountered an error while processing your request.";

      if (axios.isAxiosError(err)) {
        errorMessageText = err.response?.data?.error || err.message;
      } else if (err instanceof Error) {
        errorMessageText = err.message;
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorMessageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={chatContainerRef}
      className="relative flex flex-col h-full w-full bg-[#fff7fb] overflow-hidden text-neutral-700"
    >
      {/* Header */}
      <div className="px-8 py-5 border-b border-pink-100 bg-[#fff7fb] flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-neutral-600">
          Chat
        </h2>

        <button
          onClick={clearChat}
          title="Clear chat history"
          className="text-xs text-pink-400 hover:text-pink-500 transition-colors flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear Chat
        </button>
      </div>

      {/* Loading state */}
      {isInitialLoading && (
        <div className="absolute inset-0 top-[60px] flex flex-col items-center justify-center gap-3 pointer-events-none z-10">
          <Loader2 className="h-6 w-6 text-pink-300 animate-spin" />

          <p className="text-[13px] text-neutral-500">
            Syncing knowledge base...
          </p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#fff7fb]">
        {messages.map((message) => (
          <div key={message.id} className="flex gap-6 w-full">
            <div className="flex-none w-7 h-7 flex items-center justify-center mt-0.5">
              {message.role === "user" ? (
                <div className="w-full h-full rounded-sm bg-pink-200 text-pink-700 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-full h-full rounded-sm bg-purple-200 text-purple-700 flex items-center justify-center border border-purple-100">
                  <Bot className="w-4 h-4" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="font-medium text-[14px] text-neutral-500">
                {message.role === "user" ? "You" : "ContextLM"}
              </div>

              <div className="text-[15px] leading-relaxed text-neutral-700">
                {renderMessageContent(
                  message.content,
                  message.matches,
                  chatContainerRef,
                )}
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />

        {isLoading && (
          <div className="flex gap-6 w-full">
            <div className="flex-none w-7 h-7 flex items-center justify-center mt-0.5">
              <div className="w-full h-full rounded-sm bg-purple-200 text-purple-700 flex items-center justify-center border border-purple-100">
                <Bot className="w-4 h-4" />
              </div>
            </div>

            <div className="flex-1 flex items-center gap-2 pt-1">
              <Loader2 className="w-4 h-4 animate-spin text-pink-400" />

              <span className="text-[14px] text-neutral-500">
                Thinking...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-[#fff7fb]">
        <div className="relative flex items-center w-full">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              hasDocuments
                ? "Ask a question..."
                : "Upload a document first to start asking questions"
            }
            disabled={isLoading || !hasDocuments}
            className="w-full pl-5 pr-14 py-4 bg-white border border-pink-100 rounded-xl text-base text-neutral-700 placeholder:text-neutral-400 focus:ring-2 focus:ring-pink-200 focus:border-pink-200 transition-all outline-none shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !hasDocuments}
            className="absolute right-3 p-2 text-pink-400 hover:text-pink-500 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}