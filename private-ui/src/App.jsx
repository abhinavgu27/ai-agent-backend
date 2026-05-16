import React, { useState, useRef, useEffect, useCallback } from 'react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import SpatialWorkspace from './SpatialWorkspace';
import { 
  Send, Loader2, Paperclip, X, Plus, 
  MessageSquare, LogOut, Lock, Check,
  Volume2, VolumeX, Sparkles, PanelLeftClose, PanelLeft, Users
} from 'lucide-react';

const BACKEND_URL = "https://ai-agent-backend-cmda.onrender.com";

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
  
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]); 
  const ws = useRef(null);

  // ⚡ REFS FOR PIPELINE SYNC
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const lastYPosition = useRef(100);
  const [isTyping, setIsTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  const [activeFiles, setActiveFiles] = useState([]); 
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(Date.now().toString());
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const textareaRef = useRef(null);

  // --- 🔗 WEBSOCKET SYNC ENGINE ---
  useEffect(() => {
    if (!token) return;
    let reconnectTimeout;
    const connectWs = () => {
        const wsUrl = BACKEND_URL.replace(/^http/, 'ws') + `/ws/${currentSessionId}`;
        ws.current = new WebSocket(wsUrl);
        ws.current.onopen = () => console.log("🟢 [Agent OS] Multiplayer Link Connected!");
        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'nodes') setNodes((nds) => applyNodeChanges(data.changes, nds));
            else if (data.type === 'edges') setEdges((eds) => applyEdgeChanges(data.changes, eds));
            else if (data.type === 'full_sync') { setNodes(data.nodes); setEdges(data.edges); }
        };
        ws.current.onclose = () => { reconnectTimeout = setTimeout(connectWs, 3000); };
    };
    connectWs();
    return () => { clearTimeout(reconnectTimeout); if (ws.current) { ws.current.onclose = null; ws.current.close(); } };
  }, [currentSessionId, token]);

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: 'nodes', changes }));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: 'edges', changes }));
  }, []);

  // --- 🤖 THE MULTI-AGENT PIPELINE ENGINE ---
  const runAgentPipeline = async (targetId, inputContext, role) => {
    setNodes(nds => nds.map(n => n.id === targetId ? { ...n, data: { ...n.data, status: 'running', label: "" } } : n));

    let fullAiText = "";
    try {
        const agentPrompt = `You are a specialized ${role}. Analyze the following input and provide your expert output. Do not break character.\n\nINPUT:\n${inputContext}`;

        const response = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ message: agentPrompt, session_id: currentSessionId })
        });

        if(response.status === 401) { handleLogout(); return; }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const jsonString = line.substring(6);
                        const data = JSON.parse(jsonString);

                        if (data.token) {
                            fullAiText += data.token;
                            setNodes(nds => nds.map(node => node.id === targetId ? { ...node, data: { ...node.data, label: fullAiText } } : node));
                        }
                    } catch (e) {}
                }
            }
        }
    } catch (err) {
        setNodes(nds => nds.map(n => n.id === targetId ? { ...n, data: { ...n.data, status: 'idle', label: "⚠️ Pipeline execution failed." } } : n));
    } finally {
        setNodes(nds => nds.map(n => n.id === targetId ? { ...n, data: { ...n.data, status: 'idle' } } : n));

        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'full_sync', nodes: nodesRef.current, edges: edgesRef.current }));
        }

        setTimeout(() => {
            const downstreamEdges = edgesRef.current.filter(e => e.source === targetId);
            downstreamEdges.forEach(edge => {
                const nextNode = nodesRef.current.find(n => n.id === edge.target);
                if (nextNode && nextNode.type === 'persona_agent') {
                    runAgentPipeline(nextNode.id, fullAiText, nextNode.data.role);
                }
            });
        }, 500);
    }
  };

  const onConnect = useCallback((connection) => {
    const newEdge = { ...connection, animated: true, style: { stroke: '#818cf8', strokeWidth: 2 } };
    setEdges((eds) => {
      const updated = addEdge(newEdge, eds);
      if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: 'full_sync', nodes: nodesRef.current, edges: updated }));
      return updated;
    });

    const sourceNode = nodesRef.current.find(n => n.id === connection.source);
    const targetNode = nodesRef.current.find(n => n.id === connection.target);

    if (sourceNode && targetNode && targetNode.type === 'persona_agent') {
        if (sourceNode.data?.label) {
            runAgentPipeline(targetNode.id, sourceNode.data.label, targetNode.data.role);
        }
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('workspace');
    if (workspaceId && token) {
        loadSession(workspaceId);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [token]);

  const handleShare = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', currentSessionId);
    navigator.clipboard.writeText(url.toString());
    alert("🔗 Co-Op Link Copied! Send this to your teammate to join your canvas.");
  };

  useEffect(() => {
    if (!token || nodes.length === 0) return;
    setIsSaving(true);
    const timer = setTimeout(async () => {
      try {
        await fetch(`${BACKEND_URL}/canvas/${currentSessionId}`, { method: 'POST', headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ nodes, edges }) });
        setIsSaving(false);
      } catch(e) { setIsSaving(false); }
    }, 1500);
    return () => clearTimeout(timer);
  }, [nodes, edges, currentSessionId, token]);

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
      setNodes([]);
      setEdges([]); 
      setSessions([]);
      window.speechSynthesis.cancel();
  };

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
      setNodes([]);
      setEdges([]);
      lastYPosition.current = 100;
      window.speechSynthesis.cancel();
  };

  const loadSession = async (sessionId) => {
      setNodes([]); 
      setEdges([]);
      setCurrentSessionId(sessionId);
      window.speechSynthesis.cancel();

      try {
          const res = await fetch(`${BACKEND_URL}/canvas/${sessionId}`, { headers: authHeaders });
          if (res.ok) {
              const data = await res.json();
              if (data.nodes && data.nodes.length > 0) {
                  setNodes(data.nodes);
                  setEdges(data.edges);
                  let maxY = 100;
                  data.nodes.forEach(n => { if(n.position.y > maxY) maxY = n.position.y; });
                  lastYPosition.current = maxY + 200;
                  return;
              }
          }
      } catch (err) {}

      setNodes([{ id: 'init', type: 'assistant_response', position: { x: 400, y: 100 }, data: { label: '⚡ **Session Linked:** Spatial Memory ready.' } }]);
      lastYPosition.current = 100;
  };

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
    setIsTyping(true);

    const newNodeId = Date.now().toString();
    const userY = lastYPosition.current;
    const aiY = userY + 150;
    lastYPosition.current = aiY + 200;

    const userNodeId = `user-${newNodeId}`;
    const aiNodeId = `ai-${newNodeId}`;

    setNodes((nds) => [ ...nds, { id: userNodeId, type: 'user_input', position: { x: 400, y: userY }, data: { label: currentInput } } ]);
    setNodes((nds) => [ ...nds, { id: aiNodeId, type: 'assistant_response', position: { x: 400, y: aiY }, data: { label: "" } } ]);
    setEdges((eds) => [ ...eds, { id: `edge-${newNodeId}`, source: userNodeId, target: aiNodeId, animated: true, style: { stroke: '#818cf8', strokeWidth: 2 } } ]);

    let fullAiText = "";
    
    try {
      const response = await fetch(`${BACKEND_URL}/chat`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ message: currentInput, session_id: currentSessionId }) });
      if(response.status === 401) { handleLogout(); return; }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n"); 
        buffer = lines.pop(); 
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
                const jsonString = line.substring(6);
                const data = JSON.parse(jsonString);
                
                if (data.type === 'genui_event') {
                   if (data.widget_type === 'image_generated') setNodes((nds) => nds.map((node) => node.id === aiNodeId ? { ...node, type: 'assistant_genui_image', data: { image_url: data.image_url, isLoading: false } } : node));
                   else if (data.widget_type === 'terminal_output') setNodes((nds) => nds.map((node) => node.id === aiNodeId ? { ...node, type: 'assistant_genui_terminal', data: { output: data.output } } : node));
                   else if (data.widget_type === 'web_preview') setNodes((nds) => nds.map((node) => node.id === aiNodeId ? { ...node, type: 'assistant_genui_preview', data: { htmlCode: data.htmlCode } } : node));
                } else if (data.token) {
                   fullAiText += data.token;
                   setNodes((nds) => nds.map((node) => {
                       if (node.id === aiNodeId && !['assistant_genui_image', 'assistant_genui_terminal', 'assistant_genui_preview'].includes(node.type)) {
                           return { ...node, data: { ...node.data, label: fullAiText } };
                       }
                       return node;
                   }));
                }
            } catch (e) {}
          }
        }
      }
      fetchSessions(); 
      if (voiceMode && fullAiText.trim()) playAudio(fullAiText);
    } catch (err) {
      setNodes((nds) => nds.map((node) => node.id === aiNodeId ? { ...node, data: { ...node.data, label: "⚠️ **System Error:** Neural link severed." } } : node));
    } finally { 
      setIsTyping(false); 
      setNodes(currentNodes => {
        setEdges(currentEdges => {
           if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: 'full_sync', nodes: currentNodes, edges: currentEdges }));
           return currentEdges;
        });
        return currentNodes;
      });
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  if (!token) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-[#09090b] text-zinc-100 font-sans relative overflow-hidden">
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
                      <input type="text" placeholder="Workspace Username" value={authInputUser} onChange={e => setAuthInputUser(e.target.value)} required className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/50 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600" />
                      <input type="password" placeholder="Passcode" value={authInputPass} onChange={e => setAuthInputPass(e.target.value)} required className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/50 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600" />
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

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 ease-in-out border-r border-white/5 bg-[#09090b]/80 flex flex-col shrink-0 z-20`}>
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
             <button key={idx} onClick={() => loadSession(session.session_id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm truncate transition-all ${currentSessionId === session.session_id ? 'bg-indigo-500/10 text-indigo-300 font-medium' : 'hover:bg-white/5 text-zinc-400'}`}>
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

      <main className="flex-1 flex flex-col relative h-full min-w-0">
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md absolute top-0 w-full z-10 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 transition-colors">
              {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>
            <div className="font-semibold text-sm flex items-center gap-2">
              AGENT OS {isSpeaking && <span className="text-[10px] text-emerald-400 animate-pulse ml-1">SPEAKING</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 pointer-events-auto">
             <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
               <Users className="w-3.5 h-3.5" /> Invite to Canvas
             </button>
             <button onClick={() => { setVoiceMode(!voiceMode); window.speechSynthesis.cancel(); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${voiceMode ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 text-zinc-400 border border-white/5'}`}>
               {voiceMode ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
               Voice Mode
             </button>
          </div>
        </header>

        <div className="flex-1 w-full h-full relative z-0">
           <SpatialWorkspace 
              nodes={nodes} 
              edges={edges} 
              onNodesChange={onNodesChange} 
              onEdgesChange={onEdgesChange} 
              onConnect={onConnect} 
              setNodes={setNodes} 
           />
        </div>

        <div className="absolute bottom-0 w-full bg-gradient-to-t from-[#09090b] via-[#09090b]/95 to-transparent pt-10 pb-6 px-4 z-10 pointer-events-none">
          <div className="max-w-4xl mx-auto relative pointer-events-auto">
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

            <div className="relative flex items-end w-full bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all duration-300">
              <div className="flex flex-col w-full min-h-[60px] py-3 px-4">
                <textarea 
                  ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Ask Agent OS, generate an image, or run a command..."
                  className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 resize-none outline-none max-h-48 custom-scrollbar leading-relaxed text-base" rows={1}
                />
                <div className="flex items-center justify-between pt-2 mt-1">
                  <div className="flex items-center gap-1">
                    <FileUploadButton onUploadSuccess={fetchFiles} currentSessionId={currentSessionId} token={token} />
                    <div className={`text-[10px] font-medium px-2 flex items-center gap-1.5 transition-colors ${isSaving ? 'text-zinc-500' : 'text-emerald-500/70'}`}>
                       {isSaving ? <Loader2 className="w-3 h-3 animate-spin"/> : <Check className="w-3 h-3" />}
                       {isSaving ? "Saving Map..." : "Saved"}
                    </div>
                  </div>
                  <button onClick={handleSend} disabled={isTyping || !input.trim()} className={`p-2.5 rounded-xl flex items-center justify-center transition-all duration-200 ${input.trim() && !isTyping ? 'bg-white text-zinc-950 shadow-md hover:bg-zinc-200' : 'bg-white/5 text-zinc-600 cursor-default'}`}>
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="text-center mt-3 text-[10px] text-zinc-500">
              Pan the canvas to navigate unlimited space. Drag nodes by their header.
            </div>
          </div>
        </div>

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </div>
  );
}