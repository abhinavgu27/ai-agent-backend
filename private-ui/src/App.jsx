import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useRef, useEffect } from 'react';
import { Send, Terminal, Bot, User, Trash2, Cpu, Loader2, Paperclip, X, Plus, MessageSquare } from 'lucide-react';

const BACKEND_URL = "https://ai-agent-backend-cmda.onrender.com";

// ==========================================
// 📂 FILE UPLOAD COMPONENT
// ==========================================
function FileUploadButton({ onUploadSuccess }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      setIsUploading(true);
      setUploadStatus("..."); 

      try {
          const response = await fetch(`${BACKEND_URL}/upload`, {
              method: "POST",
              body: formData,
          });

          const data = await response.json();

          if (data.status === "Success") {
              setUploadStatus("✅");
              onUploadSuccess(); 
              setTimeout(() => setUploadStatus(""), 3000); 
          } else {
              setUploadStatus("❌");
              setTimeout(() => setUploadStatus(""), 3000); 
          }
      } catch (error) {
          setUploadStatus("❌");
          setTimeout(() => setUploadStatus(""), 3000); 
      } finally {
          setIsUploading(false);
          event.target.value = null; 
      }
  };

  return (
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', marginBottom: '4px', marginLeft: '4px' }}>
          <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".txt,.md,.pdf" 
              style={{ display: 'none' }} 
          />
          <button 
              type="button"
              onClick={() => fileInputRef.current.click()}
              disabled={isUploading}
              title="Upload Document (PDF, TXT, MD)"
              style={{ 
                  backgroundColor: 'transparent', 
                  color: isUploading ? '#10a37f' : '#888', 
                  border: 'none', 
                  width: '40px', 
                  height: '40px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: isUploading ? 'default' : 'pointer', 
                  transition: 'all 0.2s' 
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = isUploading ? '#10a37f' : '#888'}
          >
              {isUploading ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Paperclip size={20} />}
          </button>
          
          {uploadStatus && (
              <span style={{ position: 'absolute', top: '-25px', left: '10px', fontSize: '0.8rem', animation: 'fadeIn 0.3s' }}>
                  {uploadStatus}
              </span>
          )}
      </div>
  );
}

// ==========================================
// 🚀 MAIN APP COMPONENT
// ==========================================
function App() {
  const [input, setInput] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeFiles, setActiveFiles] = useState([]); 
  
  // 💬 SESSION STATE
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(Date.now().toString());

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    fetchFiles();
    fetchSessions();
  }, []);

  const fetchFiles = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/files`);
      const data = await response.json();
      setActiveFiles(data.files || []);
    } catch (err) { console.error("Could not fetch files:", err); }
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/sessions`);
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) { console.error("Could not fetch sessions:", err); }
  };

  const handleClearFiles = async () => {
    try {
      await fetch(`${BACKEND_URL}/files`, { method: 'DELETE' });
      setActiveFiles([]);
    } catch (err) { console.error("Could not clear files:", err); }
  };

  // Handle Starting a New Chat
  const startNewChat = () => {
      setCurrentSessionId(Date.now().toString());
      setChatLog([]);
  };

  // 💬 UPGRADED: Pull actual text history from the database
  const loadSession = async (sessionId) => {
      setCurrentSessionId(sessionId);
      
      try {
          const response = await fetch(`${BACKEND_URL}/history/${sessionId}`);
          const data = await response.json();
          
          if (data.history && data.history.length > 0) {
              setChatLog(data.history); // Paint the old messages on the screen
          } else {
              setChatLog([{ role: 'assistant', content: '⚡ **Session Linked:** Memory restored.' }]);
          }
      } catch (err) {
          console.error("Could not load visual history:", err);
      }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const currentInput = input;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const newHistory = [...chatLog, { role: "user", content: currentInput }];
    setChatLog([...newHistory, { role: "assistant", content: "" }]);
    setIsTyping(true);

    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, session_id: currentSessionId })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullAiText = "";

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
            } catch (e) { /* ignore parse error */ }
          }
        }
      }
      // Refresh the sidebar to show the new message title if it's a new chat
      fetchSessions();
    } catch (err) {
      setChatLog(prev => [...prev, { role: "assistant", content: "⚠️ **System Error:** Neural link severed." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0D0D0D', color: '#E5E5E5', fontFamily: 'Inter, sans-serif' }}>
      
      {/* --- DYNAMIC SIDEBAR --- */}
      <aside style={{ width: '260px', backgroundColor: '#000000', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', padding: '20px 15px' }}>
        
        {/* NEW CHAT BUTTON */}
        <button 
          onClick={startNewChat}
          style={{ 
            border: '1px solid #333', 
            borderRadius: '8px', 
            padding: '12px', 
            color: 'white', 
            backgroundColor: 'transparent', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '10px', 
            cursor: 'pointer', 
            marginBottom: '30px',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a1a1a'; e.currentTarget.style.borderColor = '#10a37f'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = '#333'; }}
        >
          <Plus size={16} /> New Chat
        </button>

        <div style={{ flex: 1, fontSize: '0.8rem', color: '#666', overflowY: 'auto' }}>
          <p style={{ marginBottom: '12px', fontWeight: 'bold', color: '#888', letterSpacing: '1px', fontSize: '0.7rem' }}>CHAT HISTORY</p>
          
          {/* MAPPING DYNAMIC SESSIONS */}
          {sessions.length === 0 ? (
              <p style={{ textAlign: 'center', opacity: 0.5, marginTop: '20px' }}>No previous sessions.</p>
          ) : (
              sessions.map((session, idx) => (
                  <div 
                      key={idx}
                      onClick={() => loadSession(session.session_id)}
                      style={{ 
                          padding: '10px', 
                          borderRadius: '6px', 
                          backgroundColor: currentSessionId === session.session_id ? '#1a1a1a' : 'transparent', 
                          borderLeft: currentSessionId === session.session_id ? '3px solid #10a37f' : '3px solid transparent', 
                          marginBottom: '8px', 
                          color: currentSessionId === session.session_id ? '#fff' : '#aaa', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                      }}
                      onMouseEnter={(e) => { if(currentSessionId !== session.session_id) e.currentTarget.style.backgroundColor = '#111'; }}
                      onMouseLeave={(e) => { if(currentSessionId !== session.session_id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                     <MessageSquare size={14} color={currentSessionId === session.session_id ? "#10a37f" : "#666"} style={{ flexShrink: 0 }} /> 
                     <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.title}</span>
                  </div>
              ))
          )}
        </div>
        
        <div style={{ fontSize: '0.7rem', color: '#444', textAlign: 'center', opacity: 0.7, marginTop: '10px' }}>
          OS BUILD 2.2.0 // PRO
        </div>
      </aside>

      {/* --- MAIN CHAT --- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Header */}
        <header style={{ padding: '15px 30px', backdropFilter: 'blur(12px)', backgroundColor: 'rgba(13, 13, 13, 0.75)', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#10a37f', borderRadius: '50%', boxShadow: '0 0 12px #10a37f' }}></div>
            <span style={{ fontWeight: '600', letterSpacing: '1.5px', fontSize: '0.9rem' }}>AGENT OS // PRO</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isTyping && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            Llama-3.3-70B-Speculative
          </div>
        </header>

        {/* Chat Area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '40px 0', scrollBehavior: 'smooth' }}>
          <div style={{ maxWidth: '850px', margin: '0 auto', padding: '0 20px' }}>
            {chatLog.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: '15vh', color: '#444', animation: 'fadeIn 1s ease-in' }}>
                    <Cpu size={56} style={{ marginBottom: '20px', opacity: 0.15 }} />
                    <h2 style={{ color: '#aaa', fontWeight: '400', letterSpacing: '1px' }}>New Session Initiated</h2>
                    <p style={{ fontSize: '0.9rem' }}>Context isolated. Ready for new input.</p>
                </div>
            )}
            
            {chatLog.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: '20px', padding: '24px', borderRadius: '12px', marginBottom: '16px', backgroundColor: msg.role === 'user' ? 'transparent' : '#141414', border: msg.role === 'user' ? 'none' : '1px solid #222' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: msg.role === 'user' ? '#10a37f' : '#6E2CF2', color: 'white', flexShrink: 0 }}>
                  {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div style={{ flex: 1, lineHeight: '1.7', fontSize: '1rem', color: '#d1d1d1', overflow: 'hidden' }}>
                  
                  <ReactMarkdown
                    components={{
                      code({node, inline, className, children, ...props}) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ borderRadius: '8px', padding: '16px', margin: '16px 0', border: '1px solid #333' }} {...props}>
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code style={{ backgroundColor: '#2a2a2a', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', color: '#eb8f90' }} {...props}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>

                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </main>

        {/* Input Bar */}
        <footer style={{ padding: '20px 20px 40px', background: 'linear-gradient(to top, #0D0D0D 80%, transparent)' }}>
          <div style={{ maxWidth: '850px', margin: '0 auto', position: 'relative' }}>
            
            {/* ACTIVE FILES DISPLAY */}
            {activeFiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', padding: '0 4px', animation: 'fadeIn 0.3s' }}>
                    {activeFiles.map((filename, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', color: '#aaa' }}>
                            <Paperclip size={12} style={{ marginRight: '6px', color: '#10a37f' }} />
                            {filename}
                        </div>
                    ))}
                    <button 
                        onClick={handleClearFiles}
                        title="Clear all attached files"
                        style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(235, 87, 87, 0.1)', border: '1px solid rgba(235, 87, 87, 0.3)', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', color: '#eb5757', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        <X size={12} style={{ marginRight: '4px' }} /> Clear Memory
                    </button>
                </div>
            )}

            <form style={{ display: 'flex', alignItems: 'flex-end', backgroundColor: '#1A1A1A', borderRadius: '16px', padding: '10px 14px', border: '1px solid #333', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              
              <FileUploadButton onUploadSuccess={fetchFiles} />
              
              <textarea 
                ref={textareaRef}
                value={input} 
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Agent OS... (Shift+Enter for new line)"
                rows={1}
                style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '1rem', resize: 'none', fontFamily: 'inherit', maxHeight: '200px', lineHeight: '1.5' }}
              />
              <button type="button" onClick={handleSend} disabled={isTyping || !input.trim()} style={{ backgroundColor: (isTyping || !input.trim()) ? '#333' : '#10a37f', color: 'white', border: 'none', borderRadius: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (isTyping || !input.trim()) ? 'default' : 'pointer', transition: 'all 0.2s', marginBottom: '4px', flexShrink: 0 }}>
                <Send size={18} style={{ transform: 'translateX(-1px)' }}/>
              </button>
            </form>
            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#555', marginTop: '12px' }}>
                Shift+Enter for new line. Enter to execute command.
            </p>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export default App;