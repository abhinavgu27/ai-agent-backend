import ReactMarkdown from 'react-markdown';
import { useState, useRef, useEffect } from 'react';

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
      // Using 127.0.0.1 to avoid DNS resolution issues on Windows
      const response = await fetch('https://ai-agent-backend-cmda.onrender.com', {
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
            const data = JSON.parse(line.replace("data: ", ""));
            fullAiText += data.token;
            setChatLog(prev => {
              const newLog = [...prev];
              newLog[newLog.length - 1].content = fullAiText;
              return newLog;
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
      setChatLog(prev => [...prev, { role: "assistant", content: "Error: Engine connection lost." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#212121', color: '#ececf1' }}>
      <header style={{ padding: '15px', borderBottom: '1px solid #444', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#202123' }}>
        ADVANCED LOCAL ENGINE (RTX 3050)
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {chatLog.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: '20px', padding: '15px', borderRadius: '12px', backgroundColor: msg.role === 'user' ? 'transparent' : '#2f2f2f' }}>
              <div style={{ color: msg.role === 'user' ? '#10a37f' : '#ab7fe6', fontWeight: 'bold', minWidth: '40px' }}>
                {msg.role === 'user' ? 'YOU' : 'AI'}
              </div>
              <div style={{ flex: 1, overflowX: 'auto', lineHeight: '1.6' }}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer style={{ padding: '30px', backgroundColor: '#212121' }}>
        <form onSubmit={handleSend} style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', gap: '10px' }}>
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Talk to your agent..."
            style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2f2f2f', color: 'white', outline: 'none' }}
          />
          <button style={{ padding: '10px 25px', backgroundColor: '#10a37f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            SEND
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;