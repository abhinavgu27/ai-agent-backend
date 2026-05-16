import React, { useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Sparkles, Brain, Bot, User, Terminal, Code2, Check, Copy, Globe, ChevronUp, ChevronDown, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
// 🧩 WINDOW CONTROLS COMPONENT
// ==========================================
const WindowControls = ({ isCollapsed, setIsCollapsed, onDelete }) => (
  <div className="flex items-center gap-1 nodrag">
    <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-zinc-300 transition-colors" title={isCollapsed ? "Expand" : "Minimize"}>
      {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
    </button>
    <button onClick={onDelete} className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded text-zinc-500 transition-colors" title="Delete Node">
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);

// ==========================================
// 🧩 SPATIAL WIDGETS
// ==========================================

// 1. The Image Generation Widget
const ImageWidgetNode = ({ id, data }) => {
  const { setNodes, setEdges } = useReactFlow();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const deleteNode = () => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); };

  return (
    <div className="bg-zinc-900/80 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl min-w-[320px] overflow-hidden flex flex-col transition-all duration-300">
      <Handle type="target" position={Position.Top} className="opacity-0" />

      {/* Draggable Header */}
      <div className="flex items-center justify-between p-4 bg-black/20 border-b border-white/5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-xs text-zinc-400 uppercase tracking-wide">Image Synthesis</span>
        </div>
        <WindowControls isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onDelete={deleteNode} />
      </div>

      {!isCollapsed && (
        <div className="p-4 nodrag">
            {data.isLoading ? (
              <div className="w-full aspect-square bg-zinc-950 rounded-xl flex flex-col items-center justify-center border border-dashed border-white/5 gap-2">
                  <Brain className="w-8 h-8 text-zinc-700 animate-pulse" />
                  <span className="text-zinc-500 text-xs font-mono animate-pulse">Generating...</span>
              </div>
            ) : (
              <img src={data.image_url} alt="Generated" className="w-full aspect-square rounded-xl object-cover pointer-events-none" />
            )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

// 2. The Hacker Terminal Widget
const TerminalWidgetNode = ({ id, data }) => {
  const { setNodes, setEdges } = useReactFlow();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const deleteNode = () => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); };

  return (
    <div className="bg-black/90 backdrop-blur-md rounded-xl border border-zinc-800 shadow-2xl min-w-[400px] max-w-[600px] flex flex-col overflow-hidden font-mono transition-all duration-300">
      <Handle type="target" position={Position.Top} className="opacity-0" />

      {/* Draggable Header */}
      <div className="flex items-center justify-between p-3 bg-zinc-900/50 border-b border-zinc-800 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
          </div>
          <Terminal className="w-4 h-4 ml-2 text-zinc-600" />
          <span className="uppercase tracking-widest text-[10px] text-zinc-500">System.Terminal // Root</span>
        </div>
        <WindowControls isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onDelete={deleteNode} />
      </div>

      {/* Selectable Body */}
      {!isCollapsed && (
        <div className="p-4 text-emerald-400 text-xs whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar nodrag select-text cursor-text">
            {data.output}
            <span className="ml-1 text-emerald-400 animate-pulse">_</span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

// 3. Live Code Artifact Widget
const WebPreviewNode = ({ id, data }) => {
  const { setNodes, setEdges } = useReactFlow();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const deleteNode = () => { setNodes((nds) => nds.filter((n) => n.id !== id)); setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); };

  const handleCopy = () => {
    navigator.clipboard.writeText(data.htmlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-950 rounded-2xl border border-white/10 shadow-2xl min-w-[500px] flex flex-col overflow-hidden transition-all duration-300">
      <Handle type="target" position={Position.Top} className="opacity-0" />

      {/* Draggable Header */}
      <div className="flex items-center justify-between p-3 bg-black/40 border-b border-white/5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 text-zinc-500">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
          </div>
          <Code2 className="w-4 h-4 ml-2 text-indigo-400" />
          <span className="uppercase tracking-widest text-[10px] text-zinc-400 font-mono">Live Artifact Preview</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleCopy} className="flex items-center gap-1.5 text-[10px] font-mono bg-white/5 hover:bg-white/10 text-zinc-300 px-2 py-1 rounded-md transition-colors nodrag">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "COPIED!" : "COPY HTML"}
          </button>
          <WindowControls isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onDelete={deleteNode} />
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex-1 w-full min-h-[400px] bg-white relative nodrag">
          <iframe srcDoc={data.htmlCode} className="absolute top-0 left-0 w-full h-full border-none" title="Live Code Preview" sandbox="allow-scripts allow-modals" />
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

// 4. The Text Nodes (NOW COLLAPSIBLE)
const TextNode = ({ id, data, isUser }) => {
  const { setNodes, setEdges } = useReactFlow();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const deleteNode = () => { 
    setNodes((nds) => nds.filter((n) => n.id !== id)); 
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id)); 
  };

  return (
    <div className={`rounded-2xl border shadow-xl flex flex-col overflow-hidden transition-all duration-300 ${isUser ? 'bg-zinc-800 border-white/10 text-zinc-300' : 'bg-indigo-600/10 border-indigo-500/30 text-zinc-200'} min-w-[300px] max-w-[650px]`}>
      {isUser ? <Handle type="source" position={Position.Bottom} className="opacity-0" /> : <Handle type="target" position={Position.Top} className="opacity-0" />}

      {/* DRAGGABLE HEADER */}
      <div className="flex items-center justify-between p-3 bg-black/20 border-b border-white/5 cursor-grab active:cursor-grabbing">
         <div className="flex items-center gap-2">
           {isUser ? <User className="w-4 h-4 opacity-50" /> : <Bot className="w-4 h-4 opacity-50" />}
           <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">{isUser ? 'You' : 'Agent OS'}</span>
         </div>
         <WindowControls isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} onDelete={deleteNode} />
      </div>

      {/* SELECTABLE BODY */}
      {!isCollapsed && (
        <div className="p-5 text-sm leading-relaxed nodrag select-text cursor-text">
           <RenderMessage content={data.label} />
        </div>
      )}

      {!isUser && <Handle type="source" position={Position.Bottom} className="opacity-0" />}
    </div>
  );
};

// Registering the Node Types
const nodeTypes = {
  user_input: (props) => <TextNode {...props} isUser={true} />,
  assistant_response: (props) => <TextNode {...props} isUser={false} />,
  assistant_genui_image: ImageWidgetNode,
  assistant_genui_terminal: TerminalWidgetNode,
  assistant_genui_preview: WebPreviewNode,
};

// The Main Canvas Component
export default function SpatialWorkspace({ nodes, edges, onNodesChange, onEdgesChange }) {
  return (
    <div className="w-full h-full bg-[#09090b]">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes} fitView>
        <Background color="#2a2a2a" gap={24} size={2} />
        <Controls className="bg-zinc-900 border border-white/10 rounded-lg fill-white shadow-xl" />
      </ReactFlow>
    </div>
  );
}