import React, { useContext, useState, useRef, useEffect } from "react";
import { Context } from "../../context/Context";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import API_BASE_URL from "../../api/config.js";

const Sidebar = () => {
  const { onSent, prevPrompts = [], setRecentPrompt, documents, fetchDocuments, setMessages, setShowResults } = useContext(Context);
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    if (user && user.id) {
      fetchDocuments(user.id);
    }
  }, [user]);

  const uniquePrompts = [...new Set(prevPrompts)];

  const handleDivClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event) => {
    if (event.target.files.length > 0) {
      const files = Array.from(event.target.files);
      if (files.length > 5) {
        setUploadError("Max 5 files at once.");
        return;
      }
      setSelectedFiles(files);
      setUploadError(null);
      setUploadSuccess(false);
      await uploadDocuments(files);
    }
  };

  const uploadDocuments = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      if (!user || !user.id) {
        setUploadError("You must be logged in.");
        setUploading(false);
        return;
      }

      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("user_id", user.id);

      const response = await fetch(`${API_BASE_URL}/upload-document`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }
      
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      fetchDocuments(user.id);

    } catch (error) {
      setUploadError(error.message);
      setSelectedFiles([]);
    } finally {
      setUploading(false);
    }
  };

  const handleNewChat = () => {
    setRecentPrompt("");
    setMessages([]);
    setShowResults(false);
    navigate("/");
  };

  const isActive = (path) => location.pathname === path;
  
  const getNavClass = (path) => {
    if (isActive(path)) {
      return "flex items-center gap-3 px-4 py-3 bg-[#72dcff]/10 text-[#72dcff] rounded-xl font-semibold transition-all duration-200 translate-x-1 cursor-pointer";
    }
    return "flex items-center gap-3 px-4 py-3 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--primary)]/5 rounded-xl transition-colors group duration-200 cursor-pointer";
  };

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 z-50 bg-[var(--sidebar-bg)] flex flex-col p-6 border-r border-[var(--border)] shadow-[4px_0_24px_rgba(114,220,255,0.08)]">
      <div className="mb-10 cursor-pointer" onClick={() => navigate("/")}>
        <h1 className="text-xl font-bold text-[#72dcff] tracking-tight font-headline">Shiro.ai</h1>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mt-1">The Neon Curator</p>
      </div>

      <nav className="flex-grow space-y-2 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-surface-variant">
        <div onClick={handleNewChat} className={getNavClass("/")}>
          <span className="material-symbols-outlined">chat</span>
          <span className="font-['Inter'] font-medium text-sm tracking-wide">Chats</span>
        </div>

        <div className={getNavClass("/documents")} 
        onClick={() => navigate("/documents")}
          >
          <span className="material-symbols-outlined">description</span>
          <span className="font-['Inter'] font-medium text-sm tracking-wide">Documents</span>
        </div>

        <div className={getNavClass("/help")} onClick={() => {}}>
          <span className="material-symbols-outlined">help</span>
          <span className="font-['Inter'] font-medium text-sm tracking-wide">Help Desk</span>
        </div>

        <div className={getNavClass("/settings")} onClick={() => navigate("/settings")}>
          <span className="material-symbols-outlined">settings</span>
          <span className="font-['Inter'] font-medium text-sm tracking-wide">Settings</span>
        </div>

        {/* Upload File Section */}
        <div className="mt-8 border-t border-[var(--border)] pt-6">
          <div 
            onClick={handleDivClick}
            className={`flex flex-col gap-2 px-4 py-3 rounded-xl transition-all border border-dashed border-[var(--primary)]/30 cursor-pointer group ${uploading ? 'opacity-50' : 'hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]/60'}`}
          >
            <div className="flex items-center gap-3 text-[var(--text-main)] group-hover:text-[var(--primary)]">
              <span className="material-symbols-outlined text-lg">add_circle</span>
              <span className="font-medium text-sm">Add Material</span>
            </div>
            {uploading && <div className="h-1 w-full bg-[#72dcff]/20 rounded-full overflow-hidden mt-1"><div className="h-full bg-[#72dcff] animate-[progress_2s_ease-in-out_infinite]"></div></div>}
            {uploadSuccess && <p className="text-[10px] text-green-400">✓ Uploaded successfully</p>}
            {uploadError && <p className="text-[10px] text-error-dim overflow-hidden text-ellipsis whitespace-nowrap" title={uploadError}>{uploadError}</p>}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.gif,.bmp,.tiff"
            disabled={uploading}
            multiple
          />
        </div>

        {/* Uploaded Documents preview */}
        {documents && documents.length > 0 && (
          <div className="mt-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4 px-2 font-bold">Your Documents</p>
            <div className="space-y-1">
              {documents.slice(0, 8).map((doc, index) => (
                <div key={index} onClick={() => navigate(`/documents/${doc.id}`)} className="flex items-center gap-3 px-4 py-2.5 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 rounded-xl transition-all duration-200 cursor-pointer group">
                  <span className="material-symbols-outlined text-[18px] opacity-40 group-hover:opacity-100">description</span>
                  <span className="text-xs truncate font-medium">{doc.filename}</span>
                </div>
              ))}
              {documents.length > 8 && (
                <div onClick={() => navigate("/documents")} className="px-4 py-2 text-[10px] text-[var(--primary)]/60 hover:text-[var(--primary)] hover:underline cursor-pointer transition-colors">
                  + {documents.length - 8} more documents
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Chats preview */}
        {uniquePrompts.length > 0 && (
          <div className="mt-8">
             <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4 px-2 font-bold">Recent Activity</p>
             <div className="space-y-1">
               {uniquePrompts.slice(0, 5).map((item, index) => (
                 <div key={index} onClick={() => { setRecentPrompt(item); navigate("/"); }} className="flex items-center gap-3 px-4 py-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--primary)]/5 rounded-xl transition-all duration-200 cursor-pointer group">
                   <span className="material-symbols-outlined text-[18px] opacity-40 group-hover:opacity-100">history</span>
                   <span className="text-xs truncate">{item}</span>
                 </div>
               ))}
             </div>
          </div>
        )}
      </nav>

      <div className="pt-6 border-t border-[var(--border)] mt-4 space-y-2">
        <div onClick={toggleTheme} className="flex items-center gap-3 px-4 py-3 text-[var(--text-muted)] hover:text-[#72dcff] transition-colors group duration-200 cursor-pointer">
          <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
          <span className="font-['Inter'] font-medium text-sm tracking-wide">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </div>

        {user ? (
          <div onClick={logout} className="flex items-center gap-3 px-4 py-3 text-[var(--text-muted)] hover:text-error transition-colors group duration-200 cursor-pointer">
            <span className="material-symbols-outlined">logout</span>
            <span className="font-['Inter'] font-medium text-sm tracking-wide">Logout</span>
          </div>
        ) : (
          <div onClick={() => navigate("/login")} className="flex items-center gap-3 px-4 py-3 text-[var(--text-muted)] hover:text-[#72dcff] transition-colors group duration-200 cursor-pointer">
            <span className="material-symbols-outlined">login</span>
            <span className="font-['Inter'] font-medium text-sm tracking-wide">Sign In</span>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;