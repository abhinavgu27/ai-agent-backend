import ReactMarkdown from 'react-markdown';
import { useState, useRef, useEffect } from 'react';
import { Send, Terminal, Bot, User, Trash2, Cpu } from 'lucide-react'; // If you have lucide-react installed

function App() {
  const [input, setInput] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const newHistory = [...chatLog, { role: "user", content: input }];
    setChatLog([...newHistory, { role: "assistant", content: "" }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('https://ai-agent-backend-cmda.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, history: chatLog })
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
            } catch (e) { console.log("JSON Parse Error"); }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setChatLog(prev => [...prev, { role: "assistant", content: "⚠️ **System Error:** Connection to the Neural Engine failed." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0D0D0D', color: '#E5E5E5', fontFamily: 'Inter, sans-serif' }}>
      
      {/* --- SIDEBAR --- */}
      <aside style={{ width: '260px', backgroundColor: '#000000', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', padding: '15px' }}>
        <button style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', color: 'white', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '20px' }} onClick={() => setChatLog([])}>
          <Trash2 size={16} /> Clear Conversation
        </button>
        <div style={{ flex: 1, fontSize: '0.8rem', color: '#666' }}>
          <p style={{ marginBottom: '10px', fontWeight: 'bold', color: '#999' }}>PROJECTS</p>
          <div style={{ padding: '8px', borderRadius: '5px', backgroundColor: '#1a1a1a', marginBottom: '5px', color: '#10a37f' }}>GRIIN AI</div>
          <div style={{ padding: '8px', borderRadius: '5px', marginBottom: '5px' }}>PortHound</div>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#444', textAlign: 'center' }}>
          v2.0.4 | Enterprise Cloud
        </div>
      </aside>

      {/* --- MAIN CHAT --- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Header */}
        <header style={{ 
            padding: '15px 30px', 
            backdropFilter: 'blur(10px)', 
            backgroundColor: 'rgba(13, 13, 13, 0.8)', 
            borderBottom: '1px solid #222', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#10a37f', borderRadius: '50%', boxShadow: '0 0 10px #10a37f' }}></div>
            <span style={{ fontWeight: '600', letterSpacing: '1px' }}>AGENT OS // ALPHA</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Llama-3.3-70B-Speculative</div>
        </header>

        {/* Chat Area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '40px 0' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
            {chatLog.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: '10vh', color: '#444' }}>
                    <Cpu size={48} style={{ marginBottom: '20px', opacity: 0.2 }} />
                    <h2 style={{ color: '#888' }}>Neural Engine Ready</h2>
                    <p>Ask about stock prices, road hazards, or code optimizations.</p>
                </div>
            )}
            {chatLog.map((msg, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                gap: '24px', 
                padding: '24px', 
                borderRadius: '16px', 
                marginBottom: '12px',
                backgroundColor: msg.role === 'user' ? 'transparent' : '#161616',
                border: msg.role === 'user' ? '1px solid transparent' : '1px solid #222'
              }}>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: msg.role === 'user' ? '#10a37f' : '#6E2CF2',
                  color: 'white'
                }}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div style={{ flex: 1, lineHeight: '1.7', fontSize: '1.05rem', color: msg.role === 'user' ? '#fff' : '#d1d1d1' }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </main>

        {/* Input Bar */}
        <footer style={{ padding: '40px 20px' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
            <form onSubmit={handleSend} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                backgroundColor: '#1E1E1E', 
                borderRadius: '14px', 
                padding: '8px 16px',
                border: '1px solid #333',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              <Terminal size={20} style={{ color: '#666', marginRight: '12px' }} />
              <input 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Type your command..."
                style={{ 
                  flex: 1, 
                  padding: '12px 0', 
                  backgroundColor: 'transparent', 
                  border: 'none', 
                  color: 'white', 
                  outline: 'none',
                  fontSize: '1rem' 
                }}
              />
              <button disabled={isTyping} style={{ 
                backgroundColor: isTyping ? '#333' : '#10a37f', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                width: '40px', 
                height: '40px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: isTyping ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}>
                <Send size={18} />
              </button>
            </form>
            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#444', marginTop: '12px' }}>
                AI may hallucinate financial data. Verify with local market regulations.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;