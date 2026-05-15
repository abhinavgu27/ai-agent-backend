import React from 'react';
import { ReactFlow, Background, Controls, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Sparkles, Brain, Bot, User } from 'lucide-react';
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
  </div>
);

// 2. The Text Nodes (User & Agent)
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
  </div>
);

// 3. Registering the Node Types
const nodeTypes = {
  user_input: (props) => <TextNode {...props} isUser={true} />,
  assistant_response: (props) => <TextNode {...props} isUser={false} />,
  assistant_genui_image: ImageWidgetNode,
};

// 4. The Main Canvas Component
export default function SpatialWorkspace({ nodes, onNodesChange }) {
  return (
    <div className="w-full h-full bg-[#09090b]">
      <ReactFlow nodes={nodes} onNodesChange={onNodesChange} nodeTypes={nodeTypes} fitView>
        <Background color="#2a2a2a" gap={24} size={2} />
        <Controls className="bg-zinc-900 border border-white/10 rounded-lg fill-white shadow-xl" />
      </ReactFlow>
    </div>
  );
}