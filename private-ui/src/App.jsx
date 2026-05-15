import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Send, Bot, User, Loader2, Paperclip, X, Plus, 
  MessageSquare, LogOut, Lock, Check, Globe, 
  Volume2, VolumeX, Sparkles, PanelLeftClose, PanelLeft, Settings
} from 'lucide-react';

const BACKEND_URL = "https://ai-agent-backend-cmda.onrender.com";

// ==========================================
// 🎨 PRO MESSAGE RENDERER
// ==========================================
const RenderMessage = ({ content }) => {
  const [copiedCode, setCopiedCode] = useState(null);

  const hasWebSearch = content.includes("*(🌐 Scanning the live web...)*");
  const hasVisualIntel = content.includes("[VISUAL DATA FROM IMAGE");
  
  const cleanContent = content
    .replace("*(🌐 Scanning the live web...)*\n\n", "")
    .replace(/\[VISUAL DATA FROM IMAGE .*?\]: /, "👁️ **Visual Intel Acquired:** ");

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="flex flex-col gap-3 w-full leading-relaxed text-zinc-200">
      {hasWebSearch && (
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium px-3 py-1.5 bg-emerald-400/10 rounded-lg w-fit border border-emerald-400/20 animate-pulse">
          <Globe className="w-4 h-4 animate-spin-slow" />
          Gathering live intel from the web...
        </div>
      )}

      {hasVisualIntel && (
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium px-3 py-1.5 bg-indigo-400/10 rounded-lg w-fit border border-indigo-400/20 mb-2">
          <Bot className="w-4 h-4" />
          Image Analysis Complete
        </div>
      )}
      
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({node, inline, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || '')
            const codeString = String(children).replace(/\n$/, '');
            return !inline && match ? (
              <div className="relative my-4 rounded-xl overflow-hidden border border-white/10 shadow-lg bg-[#0d0d0d]">
                <div className="flex justify-between items-center bg-zinc-900 px-4 py-2 text-xs text-zinc-400 border-b border-white/5">
                  <span className="font-mono uppercase tracking-wider">{match[1]}</span>
                  <button onClick={() => handleCopy(codeString)} className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors">
                    {copiedCode === codeString ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="text-[11px]">Copy</span>}
                  </button>
                </div>
                <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ margin: 0, padding: '1rem', backgroundColor: 'transparent' }} {...props}>
                  {codeString}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code className="bg-white/10 text-indigo-300 px-1.5 py-0.5 rounded-md font-mono text-sm" {...props}>
                {children}
            </code>
            )
          },
          table({children}) { return <div className="overflow-x-auto my-4"><table className="w-full text-sm text-left border-collapse border border-white/10">{children}</table></div> },
          th({children}) { return <th className="px-4 py-3 bg-white/5 border-b border-white/10 font-semibold">{children}</th> },
          td({children}) { return <td className="px-4 py-3 border-b border-white/5">{children}</td> },
          p({children}) { return <p className="mb-4 last:mb-0">{children}</p> },
          ul({children}) { return <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul> },
          ol({children}) { return <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol> },
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
};

// ==========================================
// 📂 FILE UPLOAD COMPONENT
// ==========================================
function FileUploadButton({ onUploadSuccess, currentSessionId, token }) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("session_id", currentSessionId); 
      setIsUploading(true);

      try {
          const response = await fetch(`${BACKEND_URL}/upload`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${token}` },
              body: formData,
          });
          const data = await response.json();
          if (data.status === "Success") {
              onUploadSuccess(); 
          } else {
              alert(`Upload Failed: ${data.message || 'Unknown backend error'}`);
          }
      } catch (error) { 
          alert("Server Error: Failed to connect to the backend upload route.");
      } finally {
          setIsUploading(false);
          event.target.value = null; 
      }
  };

  return (
      <div className="flex items-center">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt,.md,.pdf,.png,.jpg,.jpeg" className="hidden" />
          <button 
            type="button" 
            onClick={() => fileInputRef.current.click()} 
            disabled={isUploading} 
            className={`p-2 rounded-xl transition-all ${isUploading ? 'text-indigo-400 cursor-default' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/10'}`}
          >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
          </button>
      </div>
  );
}

// ==========================================
// 🚀 MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("agent_os_token") || null);
  const [username, setUsername] = useState(localStorage.getItem("agent_os_user") || "");
  const [authMode, setAuthMode] = useState("login"); 
  const [authError, setAuthError] = useState("");
  const [authInputUser, setAuthInputUser] = useState("");
  const [authInputPass, setAuthInputPass] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [input, setInput] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeFiles, setActiveFiles] = useState([]); 
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(Date.now().toString());
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // --- Auth Logic ---
  const handleAuth = async (e) => {
      e.preventDefault();
      setIsAuthenticating(true);
      setAuthError("");
      try {
          if (authMode === "register") {
              const res = await fetch(`${BACKEND_URL}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: authInputUser, password: authInputPass }) });
              if (!res.ok) throw new Error("Username already taken");
              setAuthMode("login");
              setAuthError("Registration successful! Please log in.");
          } else {
              const formData = new URLSearchParams();
              formData.append("username", authInputUser);
              formData.append("password", authInputPass);
              const res = await fetch(`${BACKEND_URL}/login`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formData });
              if (!res.ok) throw new Error("Invalid credentials");
              const data = await res.json();
              setToken(data.access_token);
              setUsername(authInputUser);
              localStorage.setItem("agent_os_token", data.access_token);
              localStorage.setItem("agent_os_user", authInputUser);
          }
      } catch (err) { setAuthError(err.message); } 
      finally { setIsAuthenticating(false); }
  };

  const handleLogout = () => {
      setToken(null);
      setUsername("");
      localStorage.removeItem("agent_os_token");
      localStorage.removeItem("agent_os_user");
      setChatLog([]);
      setSessions([]);
      window.speechSynthesis.cancel();
  };

  // --- Effects & Fetching ---
  useEffect(() => { if (token) { fetchSessions(); fetchFiles(); } }, [token, currentSessionId]);

  const authHeaders = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchFiles = async () => {
    if(!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/files/${currentSessionId}`, { headers: authHeaders });
      const data = await response.json();
      setActiveFiles(data.files || []);
    } catch (err) {}
  };

  const fetchSessions = async () => {
    if(!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/sessions`, { headers: authHeaders });
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) { if(err.message.includes("401")) handleLogout(); }
  };

  const handleClearFiles = async () => {
    try {
      await fetch(`${BACKEND_URL}/files/${currentSessionId}`, { method: 'DELETE', headers: authHeaders });
      setActiveFiles([]);
    } catch (err) {}
  };

  const startNewChat = () => {
      setCurrentSessionId(Date.now().toString());
      setChatLog([]);
      window.speechSynthesis.cancel();
  };

  const loadSession = async (sessionId) => {
      setChatLog([]); 
      setCurrentSessionId(sessionId);
      window.speechSynthesis.cancel();
      try {
          const response = await fetch(`${BACKEND_URL}/history/${sessionId}`, { headers: authHeaders });
          const data = await response.json();
          if (data.history && data.history.length > 0) setChatLog(data.history); 
          else setChatLog([{ role: 'assistant', content: '⚡ **Session Linked:** Memory restored.' }]);
      } catch (err) {}
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatLog]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // --- Voice & Chat Logic ---
  const playAudio = (text) => {
      if (!voiceMode) return;
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\*\(🌐 Scanning the live web...\)\*\n\n/g, "");
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.lang === "en-US");
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;
    window.speechSynthesis.cancel();
    const currentInput = input;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const newHistory = [...chatLog, { role: "user", content: currentInput }];
    setChatLog([...newHistory, { role: "assistant", content: "" }]);
    setIsTyping(true);
    let fullAiText = "";
    
    try {
      const response = await fetch(`${BACKEND_URL}/chat`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ message: currentInput, session_id: currentSessionId }) });
      if(response.status === 401) { handleLogout(); return; }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
                const data = JSON.parse(line.replace("data: ", ""));
                fullAiText += data.token;
                setChatLog(prev => {
                  const newLog = [...prev];
                  newLog[newLog.length - 1].content = fullAiText;
                  return newLog;
                });
            } catch (e) {}
          }
        }
      }
      fetchSessions(); 
      if (voiceMode && fullAiText.trim()) playAudio(fullAiText);
    } catch (err) {
      setChatLog(prev => [...prev, { role: "assistant", content: "⚠️ **System Error:** Neural link severed." }]);
    } finally { setIsTyping(false); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  // ==========================================
  // 🔐 AUTH UI (PREMIUM)
  // ==========================================
  if (!token) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-[#09090b] text-zinc-100 font-sans relative overflow-hidden">
              {/* Subtle background glow */}
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
              
              <div className="w-full max-w-md p-8 bg-zinc-900/50 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl relative z-10">
                  <div className="text-center mb-8">
                      <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-4">
                          <Lock className="w-6 h-6 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight">AGENT OS <span className="text-indigo-400 text-sm align-top">PRO</span></h2>
                      {authError && <p className="text-red-400 text-sm mt-2">{authError}</p>}
                  </div>
                  
                  <form onSubmit={handleAuth} className="flex flex-col gap-4">
                      <input 
                        type="text" placeholder="Workspace Username" value={authInputUser} onChange={e => setAuthInputUser(e.target.value)} required 
                        className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/50 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600" 
                      />
                      <input 
                        type="password" placeholder="Passcode" value={authInputPass} onChange={e => setAuthInputPass(e.target.value)} required 
                        className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/50 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600" 
                      />
                      <button type="submit" disabled={isAuthenticating} className="w-full py-3.5 mt-2 rounded-xl bg-white text-zinc-950 font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50">
                        {isAuthenticating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (authMode === "login" ? "Initialize Link" : "Create Workspace")}
                      </button>
                  </form>
                  
                  <div className="text-center mt-6 text-sm text-zinc-500">
                      <span onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} className="hover:text-indigo-400 cursor-pointer transition-colors">
                        {authMode === "login" ? "Need access? Register here." : "Have clearance? Log in."}
                      </span>
                  </div>
              </div>
          </div>
      );
  }

  // ==========================================
  // 💻 MAIN APP UI (PREMIUM ADVANCED)
  // ==========================================
  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
      
      {/* --- SIDEBAR --- */}
      <aside 
        className={`${isSidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 ease-in-out border-r border-white/5 bg-[#09090b]/80 flex flex-col shrink-0`}
      >
        <div className="p-4 border-b border-white/5 whitespace-nowrap">
          <button onClick={startNewChat} className="w-full flex items-center justify-between px-3 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" /> New Workspace
            </div>
            <Plus className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="text-xs font-semibold text-zinc-500 mb-2 px-2 mt-2 tracking-wider uppercase">History</div>
          {sessions.map((session, idx) => (
             <button 
                key={idx} 
                onClick={() => loadSession(session.session_id)} 
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm truncate transition-all ${currentSessionId === session.session_id ? 'bg-indigo-500/10 text-indigo-300 font-medium' : 'hover:bg-white/5 text-zinc-400'}`}
             >
               <MessageSquare className="w-4 h-4 shrink-0" />
               <span className="truncate text-left">{session.title || "Unknown Session"}</span>
             </button>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 flex items-center justify-between whitespace-nowrap">
          <div className="flex items-center gap-3 truncate">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium truncate text-zinc-300">{username}</span>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 transition-colors tooltip-trigger shrink-0">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* --- MAIN CHAT AREA --- */}
      <main className="flex-1 flex flex-col relative h-full min-w-0">
        
        {/* Top Navigation */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md absolute top-0 w-full z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 transition-colors">
              {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>
            <div className="font-semibold text-sm flex items-center gap-2">
              AGENT OS {isSpeaking && <span className="text-[10px] text-emerald-400 animate-pulse ml-1">SPEAKING</span>}
            </div>
          </div>
          
          <button 
            onClick={() => { setVoiceMode(!voiceMode); window.speechSynthesis.cancel(); }} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${voiceMode ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 text-zinc-400 border border-white/5'}`}
          >
            {voiceMode ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            Voice Mode
          </button>
        </header>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto pt-20 pb-40 px-4 md:px-8 lg:px-12 flex flex-col gap-6 custom-scrollbar">
          <div className="max-w-4xl w-full mx-auto flex flex-col gap-8">
            
            {chatLog.length === 0 && (
               <div className="flex flex-col items-center justify-center mt-32 text-center opacity-50">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
                    <Sparkles className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">How can I help you today?</h3>
                  <p className="text-sm text-zinc-400">Upload documents, write code, or start a conversation.</p>
               </div>
            )}

            {chatLog.map((msg, i) => (
              <div key={i} className="flex gap-4 w-full group">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-1 ${msg.role === 'user' ? 'bg-zinc-800 border-white/10 text-zinc-300' : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400'}`}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className="flex flex-col w-full min-w-0">
                  <div className="font-semibold text-xs text-zinc-500 mb-1 uppercase tracking-wide">
                    {msg.role === 'user' ? 'You' : 'Agent OS'}
                  </div>
                  <RenderMessage content={msg.content} />
                </div>
              </div>
            ))}
            {isTyping && chatLog[chatLog.length - 1]?.role === 'user' && (
               <div className="flex gap-4 w-full">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-1 bg-indigo-600/20 border-indigo-500/30 text-indigo-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="flex items-center mt-2 text-zinc-500">
                     <span className="flex gap-1">
                       <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                       <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                       <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                     </span>
                  </div>
               </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* --- FLOATING INPUT DOCK --- */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-[#09090b] via-[#09090b]/95 to-transparent pt-10 pb-6 px-4">
          <div className="max-w-4xl mx-auto relative">
            
            {/* Active Files Buffer */}
            {activeFiles.length > 0 && (
              <div className="absolute -top-12 left-0 flex flex-wrap gap-2 max-w-full">
                {activeFiles.map((filename, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-zinc-800/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg shadow-lg">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-medium text-zinc-300 truncate max-w-[150px]">{filename}</span>
                  </div>
                ))}
                <button onClick={handleClearFiles} className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium backdrop-blur-md shadow-lg">
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
            )}

            {/* Input Box */}
            <div className="relative flex items-end w-full bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all duration-300">
              
              <div className="flex flex-col w-full min-h-[60px] py-3 px-4">
                <textarea 
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message the agent..."
                  className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 resize-none outline-none max-h-48 custom-scrollbar leading-relaxed text-base"
                  rows={1}
                />
                
                <div className="flex items-center justify-between pt-2 mt-1">
                  <div className="flex items-center gap-1">
                    <FileUploadButton onUploadSuccess={fetchFiles} currentSessionId={currentSessionId} token={token} />
                  </div>
                  
                  <button 
                    onClick={handleSend}
                    disabled={isTyping || !input.trim()}
                    className={`p-2.5 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      input.trim() && !isTyping
                        ? 'bg-white text-zinc-950 shadow-md hover:bg-zinc-200' 
                        : 'bg-white/5 text-zinc-600 cursor-default'
                    }`}
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-3 text-[10px] text-zinc-500">
              Agent OS can make mistakes. Consider verifying critical systems.
            </div>
          </div>
        </div>

      </main>

      {/* Global Styles for Scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </div>
  );
}