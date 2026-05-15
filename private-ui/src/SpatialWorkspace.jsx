import React from 'react';
import { ReactFlow, Background, Controls, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Sparkles, Brain, Bot, User, Terminal, Code2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 1. The Image Generation Widget
const ImageWidgetNode = ({ data }) => (
  <div className="bg-zinc-900/80 backdrop-blur-3xl p-4 rounded-3xl border border-white/10 shadow-2xl min-w-[320px]">
    <Handle type="target" position={Position.Top} className="opacity-0" />
    <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
      <Sparkles className="w-5 h-5 text-indigo-400" />
      <span className="font-semibold text-xs text-zinc-400 uppercase tracking-wide">Image Synthesis</span>
    </div>
    {data.isLoading ? (
      <div className="w-full aspect-square bg-zinc-950 rounded-xl flex flex-col items-center justify-center border border-dashed border-white/5 gap-2">
          <Brain className="w-8 h-8 text-zinc-700 animate-pulse" />
          <span className="text-zinc-500 text-xs font-mono animate-pulse">Generating...</span>
      </div>
    ) : (
      <img src={data.image_url} alt="Generated" className="w-full aspect-square rounded-xl object-cover" />
    )}
    <Handle type="source" position={Position.Bottom} className="opacity-0" />
  </div>
);

// 2. The Hacker Terminal Widget
const TerminalWidgetNode = ({ data }) => (
  <div className="bg-black/90 backdrop-blur-md p-4 rounded-xl border border-zinc-800 shadow-2xl min-w-[400px] max-w-[500px] font-mono">
    <Handle type="target" position={Position.Top} className="opacity-0" />
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800 text-zinc-500">
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
        <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
      </div>
      <Terminal className="w-4 h-4 ml-2 text-zinc-600" />
      <span className="uppercase tracking-widest text-[10px] text-zinc-500">System.Terminal // Root</span>
    </div>
    <div className="text-emerald-400 text-xs whitespace-pre-wrap leading-relaxed">{data.output}</div>
    <div className="mt-2 text-emerald-400 animate-pulse">_</div>
    <Handle type="source" position={Position.Bottom} className="opacity-0" />
  </div>
);

// 3. NEW: Live Code Artifact Widget (The Final Boss)
const WebPreviewNode = ({ data }) => (
  <div className="bg-zinc-950 p-2 rounded-2xl border border-white/10 shadow-2xl min-w-[500px] min-h-[350px] flex flex-col">
    <Handle type="target" position={Position.Top} className="opacity-0" />
    
    {/* Mac-style Window Header */}
    <div className="flex items-center justify-between mb-2 px-2 pb-2 border-b border-white/5 text-zinc-500 mt-1">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
          <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
        </div>
        <Code2 className="w-4 h-4 ml-2 text-indigo-400" />
        <span className="uppercase tracking-widest text-[10px] text-zinc-400 font-mono">Live Artifact Preview</span>
      </div>
    </div>

    {/* The Live Sandboxed Iframe */}
    <div className="flex-1 w-full bg-white rounded-xl overflow-hidden relative">
      <iframe 
        srcDoc={data.htmlCode} 
        className="absolute top-0 left-0 w-full h-full border-none"
        title="Live Code Preview"
        sandbox="allow-scripts allow-modals"
      />
    </div>
    <Handle type="source" position={Position.Bottom} className="opacity-0" />
  </div>
);

// 4. The Text Nodes (User & Agent)
const TextNode = ({ data, isUser }) => (
  <div className={`p-4 rounded-2xl border shadow-xl ${isUser ? 'bg-zinc-800 border-white/10 text-zinc-300' : 'bg-indigo-600/10 border-indigo-500/30 text-zinc-200'} min-w-[250px] max-w-[400px]`}>
    {isUser ? <Handle type="source" position={Position.Bottom} className="opacity-0" /> : <Handle type="target" position={Position.Top} className="opacity-0" />}
    <div className="flex items-center gap-2 mb-2 opacity-50">
       {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
       <span className="text-[10px] font-bold uppercase tracking-wider">{isUser ? 'You' : 'Agent OS'}</span>
    </div>
    <div className="text-sm leading-relaxed">
       <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.label}</ReactMarkdown>
    </div>
    {!isUser && <Handle type="source" position={Position.Bottom} className="opacity-0" />}
  </div>
);

// Registering the Node Types
const nodeTypes = {
  user_input: (props) => <TextNode {...props} isUser={true} />,
  assistant_response: (props) => <TextNode {...props} isUser={false} />,
  assistant_genui_image: ImageWidgetNode,
  assistant_genui_terminal: TerminalWidgetNode,
  assistant_genui_preview: WebPreviewNode, // <-- NEW LIVE PREVIEW
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