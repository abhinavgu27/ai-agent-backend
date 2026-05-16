import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, useReactFlow, useUpdateNodeInternals, Panel, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Sparkles, Brain, Bot, User, Terminal, Check, Copy, Globe, ChevronUp, ChevronDown, X, Pencil, LayoutGrid, Layers, Folder, Code2, Bug, PenTool, Rocket, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

// Custom SVG Github Component
const GithubIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

// ==========================================
// 📐 SMART MASONRY GRID ALGORITHM
// ==========================================
const getLayoutedElements = (nodes) => {
  const visibleNodes = nodes.filter(n => !n.hidden);
  const hiddenNodes = nodes.filter(n => n.hidden);

  const pairs = {};
  const floatingNodes = [];

  visibleNodes.forEach(node => {
    if (node.type === 'github_file') {
        floatingNodes.push(node);
    } else if (node.type === 'folder_node' || node.type === 'persona_agent') {
      pairs[node.id] = { standalone: node };
    } else {
      const timeId = node.id.split('-')[1]; 
      if (!timeId) { floatingNodes.push(node); return; }
      if (!pairs[timeId]) pairs[timeId] = {};
      if (node.type === 'user_input') pairs[timeId].user = node;
      else pairs[timeId].ai = node; 
    }
  });

  const sortedKeys = Object.keys(pairs).sort((a, b) => parseInt(a.replace(/\D/g,'')) - parseInt(b.replace(/\D/g,'')));

  const COLUMNS = 3; 
  const X_SPACING = 750; 
  const columnHeights = new Array(COLUMNS).fill(100);
  const layoutedVisible = [];

  sortedKeys.forEach((key) => {
    let minCol = 0;
    let minHeight = columnHeights[0];
    for (let i = 1; i < COLUMNS; i++) {
      if (columnHeights[i] < minHeight) {
        minHeight = columnHeights[i];
        minCol = i;
      }
    }

    const baseX = minCol * X_SPACING;
    let baseY = columnHeights[minCol];
    const pair = pairs[key];

    if (pair.standalone) {
       layoutedVisible.push({ ...pair.standalone, position: { x: baseX + 50, y: baseY } });
       columnHeights[minCol] += 300; 
    } else {
       if (pair.user) {
         layoutedVisible.push({ ...pair.user, position: { x: baseX + 100, y: baseY } });
         baseY += 120; 
       }
       if (pair.ai) {
         layoutedVisible.push({ ...pair.ai, position: { x: baseX, y: baseY } });
         const textLength = pair.ai.data?.label?.length || 300;
         const estimatedHeight = Math.max(300, (textLength / 60) * 24); 
         baseY += estimatedHeight + 150; 
       } else {
         baseY += 100;
       }
       columnHeights[minCol] = baseY;
    }
  });

  return [...layoutedVisible, ...hiddenNodes, ...floatingNodes];
};

// ==========================================
// 🎨 PRO MESSAGE RENDERER
// ==========================================
const RenderMessage = ({ content = "" }) => {
  const [copiedCode, setCopiedCode] = useState(null);
  const safeContent = typeof content === 'string' ? content : String(content || "");
  
  const hasWebSearch = safeContent.includes("*(🌐 Scanning the live web...)*");
  const hasGithub = safeContent.includes("*(🐙 Cloning GitHub Repository...)*");
  const hasVisualIntel = safeContent.includes("[VISUAL DATA FROM IMAGE");

  const cleanContent = safeContent
    .replace("*(🌐 Scanning the live web...)*\n\n", "")
    .replace("*(🐙 Cloning GitHub Repository...)*\n\n", "")
    .replace(/\[VISUAL DATA FROM IMAGE .*?\]: /, "👁️ **Visual Intel Acquired:** ");
    
  const handleCopy = (text) => { navigator.clipboard.writeText(text); setCopiedCode(text); setTimeout(() => setCopiedCode(null), 2000); };

  return (
    <div className="flex flex-col gap-3 w-full leading-relaxed text-zinc-200">
      {hasWebSearch && <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium px-3 py-1.5 bg-emerald-400/10 rounded-lg w-fit border border-emerald-400/20 animate-pulse"><Globe className="w-4 h-4 animate-spin-slow" /> Gathering live intel from the web...</div>}
      {hasGithub && <div className="flex items-center gap-2 text-purple-400 text-xs font-medium px-3 py-1.5 bg-purple-400/10 rounded-lg w-fit border border-purple-400/20 animate-pulse"><GithubIcon className="w-4 h-4" /> Analyzing GitHub Repository...</div>}
      {hasVisualIntel && <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium px-3 py-1.5 bg-indigo-400/10 rounded-lg w-fit border border-indigo-400/20 mb-2"><Bot className="w-4 h-4" /> Image Analysis Complete</div>}
      
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
                <SyntaxHighlighter language={match[1]} PreTag="div" customStyle={{ margin: 0, padding: '1rem', backgroundColor: 'transparent' }} {...props}>{codeString}</SyntaxHighlighter>
              </div>
            ) : (<code className="bg-white/10 text-indigo-300 px-1.5 py-0.5 rounded-md font-mono text-sm" {...props}>{children}</code>)
          },
          table({children}) { return <div className="overflow-x-auto my-4"><table className="w-full text-sm text-left border-collapse border border-white/10">{children}</table></div> },
          th({children}) { return <th className="px-4 py-3 bg-white/5 border-b border-white/10 font-semibold">{children}</th> },
          td({children}) { return <td className="px-4 py-3 border-b border-white/5">{children}</td> },
          p({children}) { return <p className="mb-4 last:mb-0">{children}</p> },
          ul({children}) { return <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul> },
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
};

const WindowControls = ({ isCollapsed, setIsCollapsed, onDelete }) => (
  <div className="flex items-center gap-1 nodrag">
    <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-zinc-300 transition-colors">{isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}</button>
    <button onClick={onDelete} className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded text-zinc-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
  </div>
);

const handleStyle = "w-3 h-3 bg-indigo-500 border-2 border-zinc-950 opacity-30 hover:opacity-100 transition-opacity cursor-crosshair";

// ==========================================
// 🐙 GITHUB WIDGETS
// ==========================================
const GithubRepoNode = ({ id, data }) => {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => { updateNodeInternals(id); }, [isCollapsed, id, updateNodeInternals]);
  const deleteNode = () => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); };

  return (
    <div className="bg-zinc-950 rounded-2xl border border-emerald-500/30 shadow-2xl min-w-[300px] flex flex-col overflow-hidden transition-all duration-300">
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <div className="flex items-center justify-between p-3 bg-emerald-500/10 border-b border-emerald-500/20 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <GithubIcon className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">GitHub Architecture</span>
        </div>
        <WindowControls isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onDelete={deleteNode} />
      </div>
      {!isCollapsed && (
        <div className="p-5 flex flex-col items-center justify-center gap-2 nodrag">
           <div className="text-lg font-bold text-white">{data.repo?.owner} / <span className="text-emerald-400">{data.repo?.repo}</span></div>
           <div className="text-xs text-zinc-500">Repository Map Generated</div>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={handleStyle} />
    </div>
  );
};

const GithubFileNode = ({ id, data }) => {
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 shadow-lg flex items-center gap-3 min-w-[150px] cursor-grab hover:border-emerald-500/30 transition-colors">
      <Handle type="target" position={Position.Top} className={handleStyle} />
      {data.fileType === 'dir' ? <Folder className="w-5 h-5 text-indigo-400" /> : <Code2 className="w-5 h-5 text-zinc-400" />}
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-zinc-200 truncate max-w-[120px]" title={data.name}>{data.name}</span>
        <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{data.fileType}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className={handleStyle} />
    </div>
  );
};

// ==========================================
// 🤖 PERSONA NODE
// ==========================================
const PersonaNode = ({ id, data }) => {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => { updateNodeInternals(id); }, [isCollapsed, id, updateNodeInternals]);
  const deleteNode = () => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); };

  const getIcon = () => {
      switch(data.role) {
          case 'Lead Developer': return <Code2 className="w-4 h-4 text-emerald-400" />;
          case 'QA Tester': return <Bug className="w-4 h-4 text-red-400" />;
          case 'UI Designer': return <PenTool className="w-4 h-4 text-pink-400" />;
          default: return <Bot className="w-4 h-4 text-indigo-400" />;
      }
  };

  const getColor = () => {
    switch(data.role) {
        case 'Lead Developer': return 'from-emerald-500/20 to-emerald-900/40 border-emerald-500/30';
        case 'QA Tester': return 'from-red-500/20 to-red-900/40 border-red-500/30';
        case 'UI Designer': return 'from-pink-500/20 to-pink-900/40 border-pink-500/30';
        default: return 'from-indigo-500/20 to-indigo-900/40 border-indigo-500/30';
    }
  };

  return (
    <div className={`rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all duration-300 min-w-[300px] max-w-[650px] w-fit bg-gradient-to-b ${getColor()} backdrop-blur-xl`}>
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <div className="flex items-center justify-between p-3 bg-black/40 border-b border-white/5 cursor-grab active:cursor-grabbing">
         <div className="flex items-center gap-2 pr-4">
             {getIcon()}
             <span className="text-[11px] font-bold uppercase tracking-wider text-white">{data.role}</span>
             {data.status === 'running' && <span className="ml-2 flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span></span>}
         </div>
         <WindowControls isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onDelete={deleteNode} />
      </div>
      {!isCollapsed && (
          <div className="p-5 text-sm leading-relaxed nodrag select-text cursor-text bg-black/20">
              {data.label ? <RenderMessage content={data.label} /> : <span className="text-zinc-500 italic text-xs">Awaiting input from pipeline...</span>}
          </div>
      )}
      <Handle type="source" position={Position.Bottom} className={handleStyle} />
    </div>
  );
};

// ==========================================
// 📁 SPATIAL WIDGETS
// ==========================================
const FolderNode = ({ id, data }) => { 
  const { setNodes } = useReactFlow();
  const handleUnpack = () => {
    setNodes((nds) => {
      const filteredNodes = nds.filter((n) => n.id !== id);
      return filteredNodes.map((n) => {
        if (data.childIds?.includes(n.id)) return { ...n, hidden: false, selected: true }; 
        return n;
      });
    });
  };
  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-4 shadow-2xl flex flex-col items-center justify-center gap-2 min-w-[160px] cursor-grab active:cursor-grabbing hover:border-indigo-400 transition-colors">
      <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/30"><Folder className="w-6 h-6 text-indigo-400" /></div>
      <div className="text-xs font-bold text-zinc-300 tracking-wide mt-1">Archived Thread</div>
      <div className="text-[10px] text-zinc-500">{data.childIds?.length || 0} nodes packed</div>
      <button onClick={handleUnpack} className="mt-3 text-[11px] font-medium bg-white/5 hover:bg-white/15 px-4 py-1.5 rounded-lg text-zinc-300 transition-colors nodrag border border-white/5">Unpack Nodes</button>
    </div>
  ); 
};

const ImageWidgetNode = ({ id, data }) => {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => { updateNodeInternals(id); }, [isCollapsed, id, updateNodeInternals]);
  const deleteNode = () => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); };

  return (
    <div className="bg-zinc-900/80 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl min-w-[320px] overflow-hidden flex flex-col transition-all duration-300">
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <div className="flex items-center justify-between p-4 bg-black/20 border-b border-white/5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-400" /><span className="font-semibold text-xs text-zinc-400 uppercase tracking-wide">Image Synthesis</span></div>
        <WindowControls isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onDelete={deleteNode} />
      </div>
      {!isCollapsed && (
        <div className="p-4 nodrag">
            {data?.isLoading ? (
              <div className="w-full aspect-square bg-zinc-950 rounded-xl flex flex-col items-center justify-center border border-dashed border-white/5 gap-2"><Brain className="w-8 h-8 text-zinc-700 animate-pulse" /><span className="text-zinc-500 text-xs font-mono animate-pulse">Generating...</span></div>
            ) : (<img src={data?.image_url} alt="Generated" className="w-full aspect-square rounded-xl object-cover pointer-events-none" />)}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={handleStyle} />
    </div>
  );
};

const TerminalWidgetNode = ({ id, data }) => {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => { updateNodeInternals(id); }, [isCollapsed, id, updateNodeInternals]);
  const deleteNode = () => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); };

  return (
    <div className="bg-black/90 backdrop-blur-md rounded-xl border border-zinc-800 shadow-2xl min-w-[400px] max-w-[600px] flex flex-col overflow-hidden font-mono transition-all duration-300">
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <div className="flex items-center justify-between p-3 bg-zinc-900/50 border-b border-zinc-800 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div><div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div><div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div></div>
          <Terminal className="w-4 h-4 ml-2 text-zinc-600" /><span className="uppercase tracking-widest text-[10px] text-zinc-500">System.Terminal // Root</span>
        </div>
        <WindowControls isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onDelete={deleteNode} />
      </div>
      {!isCollapsed && (<div className="p-4 text-emerald-400 text-xs whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar nodrag select-text cursor-text">{data?.output}<span className="ml-1 text-emerald-400 animate-pulse">_</span></div>)}
      <Handle type="source" position={Position.Bottom} className={handleStyle} />
    </div>
  );
};

// ⚡ UPGRADED: WEB PREVIEW WITH VERCEL API PUBLISHER
const WebPreviewNode = ({ id, data }) => {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [view, setView] = useState('preview');
  const [liveCode, setLiveCode] = useState(data?.htmlCode || ""); 
  const [copied, setCopied] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState(null);
  
  useEffect(() => { updateNodeInternals(id); }, [isCollapsed, view, id, updateNodeInternals]);
  const deleteNode = () => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); };
  const handleCopy = () => { navigator.clipboard.writeText(liveCode); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ⚡ VERCEL DEPLOYMENT LOGIC
  const handleDeploy = async () => {
    const vToken = localStorage.getItem('vercel_api_token') || prompt('Enter a Vercel API Token (Create one free at vercel.com/account/tokens):');
    if (!vToken) return;
    localStorage.setItem('vercel_api_token', vToken);
    
    setIsDeploying(true);
    try {
      const res = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${vToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'agent-os-artifact',
          files: [{ file: 'index.html', data: liveCode }],
          target: 'production'
        })
      });
      const resData = await res.json();
      if (resData.url) {
         setDeployedUrl(`https://${resData.url}`);
      } else {
         alert('Deployment failed. Check your token or Vercel account limits.');
      }
    } catch (err) {
      alert('Network error during deployment.');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="bg-zinc-950 rounded-2xl border border-white/10 shadow-2xl min-w-[500px] flex flex-col overflow-hidden transition-all duration-300">
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <div className="flex items-center justify-between p-3 bg-black/40 border-b border-white/5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-4 text-zinc-500">
          <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/50"></div><div className="w-3 h-3 rounded-full bg-yellow-500/50"></div><div className="w-3 h-3 rounded-full bg-emerald-500/50"></div></div>
          <div className="flex bg-zinc-900 rounded-lg p-0.5 nodrag">
             <button onClick={() => setView('preview')} className={`text-[10px] font-bold px-3 py-1 rounded-md transition-colors ${view === 'preview' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Preview</button>
             <button onClick={() => setView('code')} className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-md transition-colors ${view === 'code' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Pencil className="w-3 h-3" /> Edit</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* ⚡ NEW: DEPLOY BUTTON */}
          {deployedUrl ? (
            <a href={deployedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-md transition-colors nodrag border border-emerald-500/30 hover:bg-emerald-500/30">
               <ExternalLink className="w-3 h-3" /> LIVE
            </a>
          ) : (
            <button onClick={handleDeploy} disabled={isDeploying} className="flex items-center gap-1.5 text-[10px] font-bold bg-white text-zinc-900 hover:bg-zinc-200 px-3 py-1 rounded-md transition-colors nodrag disabled:opacity-50">
               {isDeploying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
               {isDeploying ? "DEPLOYING" : "DEPLOY 🚀"}
            </button>
          )}

          <button onClick={handleCopy} className="flex items-center gap-1.5 text-[10px] font-mono bg-white/5 hover:bg-white/10 text-zinc-300 px-2 py-1 rounded-md transition-colors nodrag">{copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}</button>
          <WindowControls isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onDelete={deleteNode} />
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex-1 w-full min-h-[400px] bg-white relative nodrag">
          {view === 'preview' ? (<iframe srcDoc={liveCode} className="absolute top-0 left-0 w-full h-full border-none" title="Live Code Preview" sandbox="allow-scripts allow-modals" />) : (<textarea className="absolute top-0 left-0 w-full h-full bg-[#0d0d0d] text-emerald-400 font-mono text-[11px] p-4 outline-none resize-none custom-scrollbar" value={liveCode} onChange={(e) => setLiveCode(e.target.value)} />)}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={handleStyle} />
    </div>
  );
};

const TextNode = ({ id, data, isUser }) => {
  const { setNodes, setEdges } = useReactFlow();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const deleteNode = () => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); };
  return (
    <div className={`rounded-2xl border shadow-xl flex flex-col overflow-hidden transition-all duration-300 ${isUser ? 'bg-zinc-800 border-white/10 text-zinc-300' : 'bg-indigo-600/10 border-indigo-500/30 text-zinc-200'} min-w-[150px] max-w-[650px] w-fit`}>
      {isUser ? <Handle type="source" position={Position.Bottom} className={handleStyle} /> : <Handle type="target" position={Position.Top} className={handleStyle} />}
      <div className="flex items-center justify-between p-3 bg-black/20 border-b border-white/5 cursor-grab">
         <div className="flex items-center gap-2">{isUser ? <User className="w-4 h-4 opacity-50" /> : <Bot className="w-4 h-4 opacity-50" />}<span className="text-[10px] font-bold uppercase tracking-wider opacity-50">{isUser ? 'You' : 'Agent OS'}</span></div>
         <WindowControls isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onDelete={deleteNode} />
      </div>
      {!isCollapsed && (<div className="p-5 text-sm leading-relaxed nodrag select-text"><RenderMessage content={data?.label} /></div>)}
      {!isUser && <Handle type="source" position={Position.Bottom} className={handleStyle} />}
    </div>
  );
};

// ⚡ ALL NODES REGISTERED
const nodeTypes = {
  user_input: (props) => <TextNode {...props} isUser={true} />,
  assistant_response: (props) => <TextNode {...props} isUser={false} />,
  assistant_genui_image: ImageWidgetNode,
  assistant_genui_terminal: TerminalWidgetNode,
  assistant_genui_preview: WebPreviewNode,
  folder_node: FolderNode, 
  persona_agent: PersonaNode,
  github_repo: GithubRepoNode,
  github_file: GithubFileNode,
};

// ==========================================
// 🕹️ THE AUTO-LAYOUT & GROUPING DOCK 
// ==========================================
const LayoutControls = ({ nodes }) => {
  const { setNodes, fitView, getNodes } = useReactFlow();

  const onLayout = useCallback(() => {
    const layoutedNodes = getLayoutedElements(nodes);
    setNodes([...layoutedNodes]);
    setTimeout(() => fitView({ duration: 800, padding: 0.5, maxZoom: 1 }), 50);
  }, [nodes, setNodes, fitView]);

  const onGroup = useCallback(() => {
    const currentNodes = getNodes();
    const selectedNodes = currentNodes.filter(n => n.selected && n.type !== 'folder_node');
    if (selectedNodes.length === 0) return alert("Hold down the SHIFT key and drag your mouse to select nodes first!");
    const selectedIds = selectedNodes.map(n => n.id);
    const xs = selectedNodes.map(n => n.position.x);
    const ys = selectedNodes.map(n => n.position.y);
    const folderId = `folder-${Date.now()}`;
    setNodes(nds => {
        const updated = nds.map(n => selectedIds.includes(n.id) ? { ...n, hidden: true, selected: false } : n);
        updated.push({ id: folderId, type: 'folder_node', position: { x: Math.min(...xs), y: Math.min(...ys) }, data: { childIds: selectedIds } });
        return updated;
    });
  }, [getNodes, setNodes]);

  return (
    <Panel position="top-right" style={{ marginTop: '120px', marginRight: '20px', zIndex: 2147483647 }}>
       <div className="flex flex-col gap-3 bg-zinc-900/90 p-3 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl w-[110px]">
           <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center border-b border-white/5 pb-2">OS Tools</div>
           <button onClick={onLayout} className="flex flex-col items-center justify-center gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 p-3 rounded-2xl transition-all w-full aspect-square border border-indigo-500/30">
             <LayoutGrid className="w-6 h-6" /><span className="text-[10px] font-semibold text-center leading-tight">Smart Grid</span>
           </button>
           <button onClick={onGroup} className="flex flex-col items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 p-3 rounded-2xl transition-all w-full aspect-square border border-white/5">
             <Layers className="w-6 h-6" /><span className="text-[10px] font-semibold text-center leading-tight">Pack Selected</span>
           </button>
       </div>
    </Panel>
  );
};

// ==========================================
// 👥 DRAG-AND-DROP AGENT ROSTER
// ==========================================
const AgentRoster = () => {
    const onDragStart = (event, nodeType, role) => {
      event.dataTransfer.setData('application/reactflow/type', nodeType);
      event.dataTransfer.setData('application/reactflow/role', role);
      event.dataTransfer.effectAllowed = 'move';
    };
  
    return (
      <Panel position="top-left" className="mt-20 ml-4 z-[999]">
         <div className="bg-zinc-900/90 p-4 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl w-[220px] flex flex-col gap-3">
             <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-2">
                 <Bot className="w-3.5 h-3.5" /> Agent Roster
             </div>
             <div className="text-[10px] text-zinc-500 mb-1">Drag agents onto the canvas</div>
             <div onDragStart={(e) => onDragStart(e, 'persona_agent', 'Lead Developer')} draggable className="flex items-center gap-3 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl cursor-grab active:cursor-grabbing transition-colors group">
                 <Code2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                 <span className="text-xs font-semibold text-emerald-100">Lead Developer</span>
             </div>
             <div onDragStart={(e) => onDragStart(e, 'persona_agent', 'QA Tester')} draggable className="flex items-center gap-3 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl cursor-grab active:cursor-grabbing transition-colors group">
                 <Bug className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
                 <span className="text-xs font-semibold text-red-100">QA Tester</span>
             </div>
             <div onDragStart={(e) => onDragStart(e, 'persona_agent', 'UI Designer')} draggable className="flex items-center gap-3 p-3 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-xl cursor-grab active:cursor-grabbing transition-colors group">
                 <PenTool className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
                 <span className="text-xs font-semibold text-pink-100">UI Designer</span>
             </div>
         </div>
      </Panel>
    );
};

export default function SpatialWorkspace({ nodes, edges, onNodesChange, onEdgesChange, onConnect, setNodes }) {
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow/type');
    const role = event.dataTransfer.getData('application/reactflow/role');
    
    if (typeof type === 'undefined' || !type || !reactFlowInstance || !setNodes) return;

    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const newNode = {
      id: `agent-${Date.now()}`,
      type,
      position,
      data: { role: role, label: "", status: 'idle' },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [reactFlowInstance, setNodes]);

  return (
    <div className="w-full h-full bg-[#09090b]" ref={reactFlowWrapper}>
      <ReactFlow 
        nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} 
        fitView fitViewOptions={{ maxZoom: 1, padding: 0.5 }} snapToGrid={true} snapGrid={[24, 24]}
        panOnScroll={true} selectionOnDrag={true} panOnDrag={[1, 2]}
        onDrop={onDrop} onDragOver={onDragOver}
        onInit={setReactFlowInstance}
      >
        <Background color="#2a2a2a" gap={24} size={2} />
        <Controls className="bg-zinc-900 border border-white/10 rounded-lg fill-white shadow-xl" />
        <LayoutControls nodes={nodes} setNodes={setNodes} fitView={() => {}} getNodes={() => nodes} />
        <AgentRoster />
        <MiniMap position="bottom-right" zoomable={true} pannable={true} nodeColor="#4f46e5" maskColor="rgba(0, 0, 0, 0.7)" style={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', marginBottom: '80px' }} />
      </ReactFlow>
    </div>
  );
}