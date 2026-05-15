import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Cpu, Loader2, Paperclip, X, Plus, MessageSquare, LogOut, Lock, Check, Globe, Volume2, VolumeX } from 'lucide-react';

const BACKEND_URL = "https://ai-agent-backend-cmda.onrender.com";

const RenderMessage = ({ content }) => {
  const [copiedCode, setCopiedCode] = useState(null);
  const hasWebSearch = content.includes("*(🌐 Scanning the live web...)*");
  const cleanContent = content.replace("*(🌐 Scanning the live web...)*\n\n", "");

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {hasWebSearch && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10a37f', fontSize: '0.85rem', fontWeight: '500', padding: '8px 12px', backgroundColor: 'rgba(16, 163, 127, 0.1)', borderRadius: '8px', width: 'fit-content', border: '1px solid rgba(16, 163, 127, 0.2)', animation: 'pulse 2s infinite' }}>
          <Globe size={14} style={{ animation: 'spin 4s linear infinite' }} />
          Gathering live intel from the web...
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({node, inline, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || '')
            const codeString = String(children).replace(/\n$/, '');
            return !inline && match ? (
              <div style={{ position: 'relative', margin: '16px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a1a', padding: '8px 16px', fontSize: '0.75rem', color: '#888', borderBottom: '1px solid #333' }}>
                  <span>{match[1]}</span>
                  <button onClick={() => handleCopy(codeString)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {copiedCode === codeString ? <Check size={14} color="#10a37f" /> : <span style={{fontSize: '12px'}}>Copy</span>}
                  </button>
                </div>
                <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ margin: 0, padding: '16px', backgroundColor: '#0d0d0d' }} {...props}>
                  {codeString}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code style={{ backgroundColor: '#2a2a2a', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', color: '#eb8f90' }} {...props}>
                {children}
              </code>
            )
          },
          table({children}) {
            return <div style={{ overflowX: 'auto', margin: '16px 0' }}><table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', fontSize: '0.9rem' }}>{children}</table></div>
          },
          th({children}) {
            return <th style={{ padding: '12px', borderBottom: '1px solid #333', backgroundColor: '#1a1a1a', textAlign: 'left', fontWeight: '600' }}>{children}</th>
          },
          td({children}) {
            return <td style={{ padding: '12px', borderBottom: '1px solid #222' }}>{children}</td>
          }
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
};

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
          if (data.status === "Success") onUploadSuccess(); 
      } catch (error) { console.error(error); } 
      finally {
          setIsUploading(false);
          event.target.value = null; 
      }
  };

  return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', marginLeft: '4px' }}>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt,.md,.pdf" style={{ display: 'none' }} />
          <button type="button" onClick={() => fileInputRef.current.click()} disabled={isUploading} style={{ backgroundColor: 'transparent', color: isUploading ? '#10a37f' : '#888', border: 'none', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isUploading ? 'default' : 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fff'} onMouseLeave={(e) => e.currentTarget.style.color = isUploading ? '#10a37f' : '#888'}>
              {isUploading ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Paperclip size={20} />}
          </button>
      </div>
  );
}

function App() {
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

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const audioRef = useRef(null);

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

  useEffect(() => {
    if (token) { fetchSessions(); fetchFiles(); }
  }, [token, currentSessionId]);

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

  const playAudio = (text) => {
      if (!voiceMode) return;
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\*\(🌐 Scanning the live web...\)\*\n\n/g, "");
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Natural"));
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
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
      if (voiceMode && fullAiText.trim()) {
          playAudio(fullAiText);
      }
    } catch (err) {
      setChatLog(prev => [...prev, { role: "assistant", content: "⚠️ **System Error:** Neural link severed." }]);
    } finally { setIsTyping(false); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  if (!token) {
      return (
          <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ width: '100%', maxWidth: '400px', padding: '40px', backgroundColor: 'rgba(20, 20, 20, 0.6)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
                  <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                      <div style={{ width: '48px', height: '48px', backgroundColor: '#10a37f', borderRadius: '14px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(16, 163, 127, 0.3)' }}>
                          <Lock size={24} color="#fff" />
                      </div>
                      <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '600', letterSpacing: '-0.5px' }}>AGENT OS // PRO</h2>
                      <p style={{ color: '#888', fontSize: '0.95rem', marginTop: '10px' }}>{authMode === "login" ? "Authenticate your neural link." : "Initialize a new workspace."}</p>
                  </div>
                  <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <input type="text" placeholder="Username" value={authInputUser} onChange={e => setAuthInputUser(e.target.value)} required style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff', outline: 'none', fontSize: '1rem', transition: 'border-color 0.2s' }} />
                      <input type="password" placeholder="Password" value={authInputPass} onChange={e => setAuthInputPass(e.target.value)} required style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff', outline: 'none', fontSize: '1rem', transition: 'border-color 0.2s' }} />
                      {authError && <p style={{ color: authError.includes("success") ? '#10a37f' : '#eb5757', fontSize: '0.85rem', margin: '0', textAlign: 'center' }}>{authError}</p>}
                      <button type="submit" disabled={isAuthenticating} style={{ padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: '#10a37f', color: '#fff', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(16, 163, 127, 0.4)', transition: 'transform 0.1s' }}>
                          {isAuthenticating ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : (authMode === "login" ? "INITIALIZE" : "CREATE LINK")}
                      </button>
                  </form>
                  <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: '#666' }}>
                      {authMode === "login" ? "Need an access code? " : "Already have access? "}
                      <span onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }} style={{ color: '#10a37f', cursor: 'pointer', fontWeight: '500' }}>
                          {authMode === "login" ? "Register here." : "Log in."}
                      </span>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0A0A0A', color: '#E5E5E5', fontFamily: 'Inter, sans-serif' }}>
      <aside style={{ width: '260px', backgroundColor: '#050505', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', padding: '20px 15px' }}>
        <button onClick={startNewChat} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px', color: 'white', backgroundColor: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', marginBottom: '30px', transition: 'all 0.2s ease', fontWeight: '500' }}>
          <Plus size={18} /> New Workspace
        </button>
        <div style={{ flex: 1, fontSize: '0.85rem', color: '#666', overflowY: 'auto' }}>
          <p style={{ marginBottom: '16px', fontWeight: '600', color: '#555', letterSpacing: '1px', fontSize: '0.75rem', paddingLeft: '10px' }}>SECURE ARCHIVES</p>
          {sessions.length === 0 ? (
              <p style={{ textAlign: 'center', opacity: 0.5, marginTop: '20px' }}>No previous sessions.</p>
          ) : (
              sessions.map((session, idx) => (
                  <div key={idx} onClick={() => loadSession(session.session_id)} style={{ padding: '12px', borderRadius: '8px', backgroundColor: currentSessionId === session.session_id ? 'rgba(255,255,255,0.05)' : 'transparent', borderLeft: currentSessionId === session.session_id ? '3px solid #10a37f' : '3px solid transparent', marginBottom: '4px', color: currentSessionId === session.session_id ? '#fff' : '#888', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                     <MessageSquare size={16} color={currentSessionId === session.session_id ? "#10a37f" : "#555"} style={{ flexShrink: 0 }} /> 
                     <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</span>
                  </div>
              ))
          )}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.03)', width: '100%' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(16, 163, 127, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10a37f' }}>
                    <User size={18} />
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#ddd', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{username}</div>
                <button onClick={handleLogout} title="Log Out" style={{ backgroundColor: 'transparent', border: 'none', color: '#666', cursor: 'pointer', padding: '4px' }}>
                    <LogOut size={18} />
                </button>
            </div>
        </div>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <header style={{ padding: '20px 30px', backdropFilter: 'blur(20px)', backgroundColor: 'rgba(10, 10, 10, 0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: isSpeaking ? '#6E2CF2' : '#10a37f', borderRadius: '50%', boxShadow: `0 0 12px ${isSpeaking ? '#6E2CF2' : '#10a37f'}`, animation: isSpeaking ? 'pulse 1s infinite' : 'pulse 2s infinite' }}></div>
            <span style={{ fontWeight: '600', letterSpacing: '1px', fontSize: '0.95rem' }}>AGENT OS {isSpeaking && <span style={{color: '#6E2CF2', fontSize: '0.75rem', marginLeft: '8px'}}>(SPEAKING...)</span>}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
                onClick={() => { setVoiceMode(!voiceMode); window.speechSynthesis.cancel(); setIsSpeaking(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: voiceMode ? '#10a37f' : '#666', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', transition: 'color 0.2s' }}
            >
                {voiceMode ? <Volume2 size={18} /> : <VolumeX size={18} />}
                {voiceMode ? "VOICE ON" : "VOICE OFF"}
            </button>
            <div style={{ fontSize: '0.8rem', color: '#555', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {isTyping && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
              Llama-3.3-70B-Speculative
            </div>
          </div>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: '40px 0', scrollBehavior: 'smooth' }}>
          <div style={{ maxWidth: '850px', margin: '0 auto', padding: '0 20px' }}>
            {chatLog.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: '20vh' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '20px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Cpu size={40} color="#333" />
                    </div>
                    <h2 style={{ color: '#eee', fontWeight: '500', letterSpacing: '-0.5px', fontSize: '1.8rem', marginBottom: '8px' }}>Welcome to your workspace.</h2>
                    <p style={{ fontSize: '1rem', color: '#666' }}>Secure end-to-end encryption active.</p>
                </div>
            )}
            {chatLog.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: '20px', padding: '24px', borderRadius: '16px', marginBottom: '24px', backgroundColor: msg.role === 'user' ? 'transparent' : 'rgba(255,255,255,0.02)', border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: msg.role === 'user' ? 'rgba(16, 163, 127, 0.1)' : 'rgba(110, 44, 242, 0.1)', color: msg.role === 'user' ? '#10a37f' : '#8a4bfa', flexShrink: 0, border: `1px solid ${msg.role === 'user' ? 'rgba(16, 163, 127, 0.2)' : 'rgba(110, 44, 242, 0.2)'}` }}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div style={{ flex: 1, lineHeight: '1.7', fontSize: '1.05rem', color: '#d1d1d1', overflow: 'hidden' }}>
                  <RenderMessage content={msg.content} />
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </main>
        <footer style={{ padding: '20px 20px 40px', background: 'linear-gradient(to top, #0A0A0A 70%, transparent)' }}>
          <div style={{ maxWidth: '850px', margin: '0 auto', position: 'relative' }}>
            {activeFiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {activeFiles.map((filename, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', color: '#ccc' }}>
                            <Paperclip size={14} style={{ marginRight: '6px', color: '#10a37f' }} />
                            {filename}
                        </div>
                    ))}
                    <button onClick={handleClearFiles} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(235, 87, 87, 0.1)', border: '1px solid rgba(235, 87, 87, 0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', color: '#eb5757', cursor: 'pointer' }}>
                        <X size={14} style={{ marginRight: '4px' }} /> Clear
                    </button>
                </div>
            )}
            <form style={{ display: 'flex', alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', borderRadius: '20px', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <FileUploadButton onUploadSuccess={fetchFiles} currentSessionId={currentSessionId} token={token} />
              <textarea 
                ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Message Agent OS..." rows={1}
                style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '1.05rem', resize: 'none', fontFamily: 'inherit', maxHeight: '200px', lineHeight: '1.5' }}
              />
              <button type="button" onClick={handleSend} disabled={isTyping || !input.trim()} style={{ backgroundColor: (isTyping || !input.trim()) ? 'rgba(255,255,255,0.1)' : '#10a37f', color: (isTyping || !input.trim()) ? '#555' : 'white', border: 'none', borderRadius: '14px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (isTyping || !input.trim()) ? 'default' : 'pointer', transition: 'all 0.2s', marginBottom: '4px', flexShrink: 0 }}>
                <Send size={20} />
              </button>
            </form>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#555', marginTop: '16px' }}>Shift+Enter for new line. Agent OS can make mistakes.</p>
          </div>
        </footer>
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

export default App;