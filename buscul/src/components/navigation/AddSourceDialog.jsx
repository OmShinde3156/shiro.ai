import React, { useState } from 'react';
import { 
  FileUp, 
  Youtube, 
  Globe, 
  X, 
  Loader2, 
  Plus,
  Link as LinkIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import API_BASE_URL from '../../api/config.js';

const AddSourceDialog = ({ isOpen, onClose, userId, onUploadSuccess }) => {
  const [activeTab, setActiveTab] = useState('file'); // 'file', 'url'
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setUploading(true);

    const formData = new FormData();
    files.forEach(file => formData.append("files", file));
    formData.append("user_id", userId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/upload-document`, {
        method: "POST",
        body: formData,
      });
      
      if (response.ok) {
        toast.success(`Successfully uploaded ${files.length} documents!`);
        onUploadSuccess();
        onClose();
      } else {
        throw new Error("Upload failed");
      }
    } catch (err) {
      toast.error("Failed to upload files.");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("url", url);
    formData.append("user_id", userId);

    try {
      console.log(`[Ingestion] Sending URL to ${API_BASE_URL}/upload-url:`, url);
      const response = await fetch(`${API_BASE_URL}/upload-url`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast.success("URL content ingested successfully!");
        setUrl('');
        onUploadSuccess();
        onClose();
      } else {
        const data = await response.json();
        throw new Error(data.detail || "Failed to process URL");
      }
    } catch (err) {
      console.error("[Ingestion] Error:", err);
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    // Fixed UI: Ensuring high z-index and fixed positioning with full screen overlay
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }} onClick={onClose}>
      <div className="w-full max-w-md bg-[#151926] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-primary/5">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                <Plus size={18} />
             </div>
             <h3 className="text-sm font-black text-white uppercase tracking-widest">Add New Source</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all">
             <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-4 gap-2 bg-black/20">
          <button 
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${activeTab === 'file' ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-white/5 border-transparent text-white/40'}`}
          >
            <FileUp size={14} /> File
          </button>
          <button 
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${activeTab === 'url' ? 'bg-secondary/10 border-secondary/40 text-secondary' : 'bg-white/5 border-transparent text-white/40'}`}
          >
            <LinkIcon size={14} /> URL
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {activeTab === 'file' ? (
            <div className="space-y-6">
               <div 
                 onClick={() => !uploading && document.getElementById('file-input').click()}
                 className="group border-2 border-dashed border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
               >
                 <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 group-hover:scale-110 group-hover:text-primary transition-all">
                    {uploading ? <Loader2 className="animate-spin" /> : <FileUp size={32} />}
                 </div>
                 <div className="text-center">
                    <p className="text-sm font-bold text-white mb-1">{uploading ? 'Processing files...' : 'Click to upload'}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">PDF, DOCX, TXT</p>
                 </div>
                 <input id="file-input" type="file" className="hidden" multiple accept=".pdf,.docx,.txt" onChange={handleFileUpload} disabled={uploading} />
               </div>
            </div>
          ) : (
            <form onSubmit={handleUrlSubmit} className="space-y-6">
               <div className="space-y-4">
                  <div className="flex gap-4 mb-4">
                     <div className="flex-1 p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                        <Youtube className="text-red-500" size={20} />
                        <span className="text-[10px] font-bold text-white/40 uppercase">YouTube</span>
                     </div>
                     <div className="flex-1 p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                        <Globe className="text-blue-400" size={20} />
                        <span className="text-[10px] font-bold text-white/40 uppercase">Website</span>
                     </div>
                  </div>
                  <div className="relative">
                    <input 
                      type="url" 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="Paste link here (YT or Web)..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-secondary/50 transition-all"
                      required
                    />
                  </div>
               </div>
               <button 
                 type="submit" 
                 disabled={uploading || !url}
                 className="w-full py-4 bg-secondary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-secondary/20"
               >
                 {uploading ? <Loader2 className="animate-spin size-4" /> : 'Ingest Link'}
               </button>
            </form>
          )}
        </div>

        <div className="p-6 bg-black/20 text-center">
           <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.2em]">Powered by Shiro Ingestion Engine v4.5</p>
        </div>
      </div>
    </div>
  );
};

export default AddSourceDialog;
