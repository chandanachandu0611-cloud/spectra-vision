"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  text: string;
  image?: string;
  timestamp?: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
}

const resizeImage = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 1024;
        let { width, height } = img;

        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({
          base64: dataUrl.split(",")[1],
          mimeType: "image/jpeg",
        });
      };
    };
  });
};

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // History Drawer & Search
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Load saved sessions on mount
  useEffect(() => {
    const saved = localStorage.getItem("spectra_sessions");
    if (saved) {
      try {
        const parsed: ChatSession[] = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
          setMessages(parsed[0].messages);
        }
      } catch (e) {
        console.error("Failed to load sessions", e);
      }
    }
  }, []);

  // Sync state & LocalStorage
  const updateSessionMessages = (newMessages: Message[], detectedTitle?: string) => {
    setMessages(newMessages);

    let activeId = currentSessionId;
    let updatedSessions = [...sessions];

    if (!activeId) {
      activeId = Date.now().toString();
      setCurrentSessionId(activeId);
      const newSession: ChatSession = {
        id: activeId,
        title: detectedTitle || "Analyzing visual input...",
        createdAt: new Date().toLocaleDateString([], { month: "short", day: "numeric" }),
        messages: newMessages,
      };
      updatedSessions = [newSession, ...updatedSessions];
    } else {
      updatedSessions = updatedSessions.map((s) => {
        if (s.id === activeId) {
          return {
            ...s,
            title: detectedTitle || s.title,
            messages: newMessages,
          };
        }
        return s;
      });
    }

    setSessions(updatedSessions);
    localStorage.setItem("spectra_sessions", JSON.stringify(updatedSessions));
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: "New Query",
      createdAt: new Date().toLocaleDateString([], { month: "short", day: "numeric" }),
      messages: [],
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    setCurrentSessionId(newId);
    setMessages([]);
    setImageFile(null);
    setImagePreview(null);
    localStorage.setItem("spectra_sessions", JSON.stringify(updated));
    setIsSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    const selected = sessions.find((s) => s.id === id);
    if (selected) {
      setCurrentSessionId(selected.id);
      setMessages(selected.messages);
      setImageFile(null);
      setImagePreview(null);
      setIsSidebarOpen(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm("Clear all search and prompt history?")) {
      setSessions([]);
      setMessages([]);
      setCurrentSessionId("");
      localStorage.removeItem("spectra_sessions");
    }
  };

  const handleCopyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (overridePrompt?: string) => {
    const promptToSend = overridePrompt || input;
    if (!promptToSend.trim() && !imageFile) return;

    let base64Data = "";
    let mimeType = "";

    if (imageFile) {
      const compressed = await resizeImage(imageFile);
      base64Data = compressed.base64;
      mimeType = compressed.mimeType;
    }

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const newMsg: Message = {
      role: "user",
      text: promptToSend,
      image: imagePreview || undefined,
      timestamp: currentTime,
    };

    const isFirstTurn = messages.length === 0;
    const updatedWithUser = [...messages, newMsg];
    updateSessionMessages(updatedWithUser);

    setInput("");
    setImageFile(null);
    setImagePreview(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToSend,
          imageBase64: base64Data,
          mimeType: mimeType,
          isFirstTurn: isFirstTurn,
        }),
      });

      const data = await res.json();
      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (data.reply) {
        updateSessionMessages(
          [...updatedWithUser, { role: "assistant", text: data.reply, timestamp: replyTime }],
          data.title
        );
      } else {
        updateSessionMessages([
          ...updatedWithUser,
          {
            role: "assistant",
            text: `Error: ${data.error || "Unable to process the request."}`,
            timestamp: replyTime,
          },
        ]);
      }
    } catch (err: any) {
      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      updateSessionMessages([
        ...updatedWithUser,
        {
          role: "assistant",
          text: `Connection error: ${err.message}`,
          timestamp: replyTime,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: "Summarize", prompt: "Summarize this image with clear bullet points." },
    { label: "Extract Text", prompt: "Transcribe and extract all visible text exactly as written." },
    { label: "Identify Elements", prompt: "Identify the main subjects, labels, and context in this image." },
    { label: "Explain Simply", prompt: "Provide a simple, clear explanation of what is shown." },
  ];

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    const titleMatch = s.title.toLowerCase().includes(q);
    const contentMatch = s.messages.some((m) => m.text.toLowerCase().includes(q));
    return titleMatch || contentMatch;
  });

  return (
    <div className="relative flex h-screen w-screen bg-[#f8fafc] text-slate-800 antialiased font-sans overflow-hidden">

      {/* Dynamic Background Optical Canvas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-indigo-200/35 rounded-full blur-3xl animate-pulse [animation-delay:2s]"></div>
        <div className="absolute -bottom-24 left-1/4 w-96 h-96 bg-sky-200/35 rounded-full blur-3xl animate-pulse [animation-delay:4s]"></div>

        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #0f172a 1px, transparent 1px),
              linear-gradient(to bottom, #0f172a 1px, transparent 1px)
            `,
            backgroundSize: "36px 36px",
          }}
        />
      </div>

      {/* Click-Outside Overlay Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/25 backdrop-blur-[1px] z-30 transition-opacity"
        />
      )}

      {/* History Slide-Over Drawer Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 h-full bg-white/95 backdrop-blur-md border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out shadow-xl overflow-hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Query History</h2>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-sm transition"
            title="Close sidebar"
          >
            ✕
          </button>
        </div>

        <div className="p-3 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Search past queries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>
        </div>

        <div className="p-3 flex-shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 py-2 rounded-lg transition"
          >
            <span>+</span> Start New Query
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {filteredSessions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              {searchQuery ? "No matching queries found" : "No history recorded yet"}
            </div>
          ) : (
            filteredSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`w-full text-left p-2.5 rounded-lg text-xs transition flex flex-col gap-0.5 ${s.id === currentSessionId
                    ? "bg-slate-100 border border-slate-300 text-slate-900 font-semibold"
                    : "hover:bg-slate-50 text-slate-600 border border-transparent"
                  }`}
              >
                <span className="truncate w-full">{s.title}</span>
                <span className="text-[10px] text-slate-400">{s.createdAt}</span>
              </button>
            ))
          )}
        </div>

        {sessions.length > 0 && (
          <div className="p-3 border-t border-slate-200 flex-shrink-0 bg-white">
            <button
              onClick={handleClearHistory}
              className="w-full text-center text-[11px] text-rose-500 hover:text-rose-700 py-1 transition font-medium"
            >
              Clear All History
            </button>
          </div>
        )}
      </aside>

      {/* Main Workspace Frame */}
      <div className="relative z-10 flex flex-col flex-1 max-w-4xl w-full mx-auto h-full border-x border-slate-200/80 bg-white/80 backdrop-blur-md shadow-xs">

        {/* Navigation Bar */}
        <header className="h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
              title="Toggle Query History"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-slate-900">Spectra Vision</h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Intelligent Image & Document Parser</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleNewChat}
              className="text-xs font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 px-2.5 py-1 rounded-lg transition"
            >
              + New Chat
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Gemini Connected
            </div>
          </div>
        </header>

        {/* Message Feed */}
        <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-blue-600 rounded-tl"></div>
                <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-blue-600 rounded-tr"></div>
                <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-blue-600 rounded-bl"></div>
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-blue-600 rounded-br"></div>

                <div className="w-16 h-16 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center justify-center shadow-xs">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </div>

                <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"></div>
              </div>

              <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Optical Workspace Ready</h2>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                Attach a document, diagram, handwritten note, or photo to initialize automated parsing and synthesis.
              </p>
            </div>
          )}

          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 text-sm ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-md bg-white border border-slate-200 shadow-xs flex-shrink-0 flex items-center justify-center text-[11px] font-medium text-slate-600 mt-0.5">
                  AI
                </div>
              )}

              <div className="flex flex-col space-y-1.5 max-w-[85%] sm:max-w-[78%]">
                <div
                  className={`rounded-2xl px-4 py-3 shadow-xs ${m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-[#f8fafc]/95 border border-slate-200/90 text-slate-800 rounded-bl-xs"
                    }`}
                >
                  {m.image && (
                    <div className="mb-2.5 rounded-lg overflow-hidden border border-slate-200 bg-white">
                      <img
                        src={m.image}
                        alt="Upload preview"
                        className="max-h-72 w-full object-contain"
                      />
                    </div>
                  )}

                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{m.text}</p>
                  ) : (
                    <div className="prose prose-slate prose-sm max-w-none text-[13px] leading-relaxed prose-headings:font-semibold prose-headings:text-slate-900 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-hr:my-3 prose-hr:border-slate-200">
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  )}
                </div>

                <div className={`flex items-center gap-2 px-1 text-[10px] text-slate-400 ${m.role === "user" ? "justify-end" : "justify-start"
                  }`}>
                  {m.timestamp && <span>{m.timestamp}</span>}

                  {m.role === "assistant" && (
                    <button
                      onClick={() => handleCopyText(m.text, idx)}
                      className="hover:text-slate-700 transition flex items-center gap-1 ml-1"
                      title="Copy response"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                      {copiedIdx === idx ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
              </div>

              {m.role === "user" && (
                <div className="w-7 h-7 rounded-md bg-slate-200 flex-shrink-0 flex items-center justify-center text-[11px] font-semibold text-slate-700 mt-0.5">
                  U
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-[11px] font-medium text-slate-600">
                AI
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/95 border border-slate-200 shadow-xs flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                <span>Scanning and analyzing input...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </main>

        {/* Input Bar & Controls */}
        <footer className="border-t border-slate-200/80 bg-white/95 backdrop-blur-sm p-4 flex-shrink-0">
          <div className="space-y-2.5">
            {imagePreview && (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2">
                <div className="relative inline-block flex-shrink-0">
                  <img
                    src={imagePreview}
                    alt="Thumbnail"
                    className="h-12 w-12 object-cover rounded-lg border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-slate-700 hover:bg-slate-900 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] transition"
                    title="Remove image"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {quickActions.map((action, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSend(action.prompt)}
                      disabled={loading}
                      className="text-xs bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md transition shadow-2xs disabled:opacity-50"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 bg-slate-50/90 border border-slate-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 rounded-xl px-3 py-1.5 transition">
              <label className="cursor-pointer p-1.5 text-slate-400 hover:text-slate-700 transition" title="Attach an image">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                  <line x1="16" y1="5" x2="22" y2="5" />
                  <line x1="19" y1="2" x2="19" y2="8" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </label>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={loading}
                placeholder={
                  imagePreview
                    ? "Ask about the attached image, or click a suggestion..."
                    : "Type a prompt or attach an image..."
                }
                className="flex-1 bg-transparent text-[13px] text-slate-800 placeholder-slate-400 outline-none"
              />

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || (!input.trim() && !imageFile)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3.5 py-1.5 rounded-lg shadow-2xs transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}