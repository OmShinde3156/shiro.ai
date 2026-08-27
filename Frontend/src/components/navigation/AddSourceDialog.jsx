import { fetchWithAuth } from '../../api/fetchWithAuth';
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
    // Also append 'file' for single-file compatibility
    if (files.length === 1) {
      formData.append("file", files[0]);
    }
    formData.append("user_id", userId || 1);
    
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/upload-document`, {
        method: "POST",
        body: formData,
      });
      
      if (response.ok) {
        toast.success(files.length === 1 
          ? `"${files[0].name}" uploaded successfully!` 
          : `Successfully uploaded ${files.length} documents!`
        );
        onUploadSuccess && onUploadSuccess();
        onClose && onClose();
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Upload failed");
      }
    } catch (err) {
      toast.error(err.message || "Failed to upload files.");
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
    formData.append("user_id", userId || 1);

    try {
      console.log(`[Ingestion] Sending URL to ${API_BASE_URL}/upload-url:`, url);
      const response = await fetchWithAuth(`${API_BASE_URL}/upload-url`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast.success("URL content ingested successfully!");
        setUrl('');
        onUploadSuccess && onUploadSuccess();
        onClose && onClose();
      } else {
        const data = await response.json().catch(() => ({}));
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
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-xl bg-[#3F6048]/15 dark:bg-[#89A88D]/20 flex items-center justify-center text-[#3F6048] dark:text-[#89A88D]">
                <Plus size={18} />
             </div>
             <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-serif">Add New Study Source</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-surface)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">
             <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-3 gap-2 bg-[var(--bg-surface-elevated)] border-b border-[var(--border)]">
          <button 
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border flex items-center justify-center gap-2 ${
              activeTab === 'file' 
                ? 'bg-[var(--bg-surface)] border-[var(--border)] text-[#3F6048] dark:text-[#A8C5AC] shadow-xs' 
                : 'bg-transparent border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <FileUp size={14} /> Document / Image
          </button>
          <button 
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border flex items-center justify-center gap-2 ${
              activeTab === 'url' 
                ? 'bg-[var(--bg-surface)] border-[var(--border)] text-[#3F6048] dark:text-[#A8C5AC] shadow-xs' 
                : 'bg-transparent border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <LinkIcon size={14} /> URL / Web
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'file' ? (
            <div className="space-y-4">
               <div 
                 onClick={() => !uploading && document.getElementById('file-input').click()}
                 className="group border-2 border-dashed border-[var(--border)] rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:border-[#3F6048] hover:bg-[#3F6048]/5 transition-all cursor-pointer text-center bg-[var(--bg-surface-elevated)]"
               >
                 <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] group-hover:scale-105 group-hover:text-[#3F6048] transition-all shadow-xs">
                    {uploading ? <Loader2 className="animate-spin text-[#3F6048]" size={28} /> : <FileUp size={28} />}
                 </div>
                 <div>
                    <p className="text-sm font-bold text-[var(--text-main)] font-serif mb-1">
                      {uploading ? 'Processing files...' : 'Click to select or drop files'}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
                      PDF, DOCX, PPTX, Images, TXT, MD, CSV, Excel
                    </p>
                 </div>
                 <input 
                   id="file-input" 
                   type="file" 
                   className="hidden" 
                   multiple 
                   accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.markdown,.csv,.tsv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.json,.tex,.html,image/*" 
                   onChange={handleFileUpload} 
                   disabled={uploading} 
                 />
               </div>
            </div>
          ) : (
            <form onSubmit={handleUrlSubmit} className="space-y-4">
               <div className="space-y-3">
                  <div className="flex gap-3 mb-2">
                     <div className="flex-1 p-3 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)] flex items-center gap-2.5">
                        <Youtube className="text-red-500 shrink-0" size={18} />
                        <span className="text-[10px] font-bold text-[var(--text-main)] uppercase font-mono">YouTube</span>
                     </div>
                     <div className="flex-1 p-3 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)] flex items-center gap-2.5">
                        <Globe className="text-blue-500 shrink-0" size={18} />
                        <span className="text-[10px] font-bold text-[var(--text-main)] uppercase font-mono">Web Page</span>
                     </div>
                  </div>
                  <div className="relative">
                     <input 
                       type="url" 
                       required
                       value={url}
                       onChange={e => setUrl(e.target.value)}
                       placeholder="Paste YouTube or Article URL..." 
                       className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs text-[var(--text-main)] focus:border-[#3F6048] outline-none placeholder-[var(--text-muted)]"
                     />
                  </div>
               </div>
               <button 
                 type="submit" 
                 disabled={uploading || !url.trim()}
                 className="w-full py-3 bg-[#3F6048] hover:bg-[#34523D] dark:bg-[#89A88D] dark:text-black text-white font-bold rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2"
               >
                 {uploading ? (
                   <><Loader2 className="animate-spin" size={16} /> Ingesting Content...</>
                 ) : (
                   'Ingest Web Content'
                 )}
               </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddSourceDialog;
