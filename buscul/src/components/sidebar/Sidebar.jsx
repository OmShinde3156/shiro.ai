import React, { useContext, useState, useRef, useEffect } from "react";
import { Context } from "../../context/Context";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import API_BASE_URL from "../../api/config.js";

const Sidebar = () => {
  const { onSent, prevPrompts = [], setRecentPrompt, documents, fetchDocuments, setMessages, setShowResults } = useContext(Context);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(false);

    if (!user || !user.id) {
      setUploadError("You must be logged in.");
      setUploading(false);
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("user_id", user.id);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadSuccess(true);
          setTimeout(() => setUploadSuccess(false), 3000);
          fetchDocuments(user.id);
          resolve(xhr.response);
        } else {
          setUploadError(`Upload failed: ${xhr.responseText}`);
          setSelectedFiles([]);
          reject(new Error(xhr.responseText));
        }
        setUploading(false);
      });

      xhr.addEventListener('error', () => {
        setUploadError('Upload failed due to a network error.');
        setSelectedFiles([]);
        setUploading(false);
        reject(new Error('Network error'));
      });

      xhr.open('POST', `${API_BASE_URL}/upload-document`);
      xhr.send(formData);
    });
  };

  const handleNewChat = () => {
    setRecentPrompt("");
    setMessages([]);
    setShowResults(false);
    navigate("/");
  };

  const isActive = (path) => location.pathname === path;
  
  const getNavClass = (path) => {
    const active = isActive(path);
    return `flex items-center gap-0 group-hover:gap-4 px-3 py-3 rounded-xl transition-all duration-300 cursor-pointer group/item ${
      active 
        ? "bg-[#72dcff]/10 text-[#72dcff] font-semibold" 
        : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--primary)]/5"
    }`;
  };

  return (
    <aside className="h-screen w-20 hover:w-64 fixed left-0 top-0 z-50 bg-[var(--sidebar-bg)] flex flex-col p-3 border-r border-[var(--border)] shadow-[4px_0_24px_rgba(114,220,255,0.08)] transition-all duration-300 group overflow-hidden">
      {/* Logo Section */}
      <div className="mb-10 cursor-pointer flex items-center px-1" onClick={() => navigate("/")}>
        <div className="min-w-[48px] h-12 rounded-xl bg-gradient-to-br from-[#72dcff] to-[#dd8bfb] flex items-center justify-center text-white font-black shadow-lg shadow-[#72dcff]/20 flex-shrink-0">S</div>
        <div className="ml-4 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
          <h1 className="text-xl font-bold text-[#72dcff] tracking-tight font-headline">Shiro.ai</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mt-1">The Neon Curator</p>
        </div>
      </div>

      <nav className="flex-grow space-y-2 overflow-y-auto overflow-x-hidden pr-2 scrollbar-none group-hover:scrollbar-thin scrollbar-thumb-surface-variant">
        <div onClick={() => navigate("/")} className={getNavClass("/")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">home</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Home</span>
        </div>

        <div onClick={() => navigate("/study-plan")} className={getNavClass("/study-plan")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">calendar_today</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Study Plan</span>
        </div>

        <div onClick={() => navigate("/documents")} className={getNavClass("/documents")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">description</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Documents</span>
        </div>

        <div onClick={() => navigate("/study-room")} className={getNavClass("/study-room")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">school</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Study Room</span>
        </div>

        {/* Upload File Section */}
        <div className="mt-8 border-t border-[var(--border)] pt-6 relative">
          <div 
            onClick={handleDivClick}
            className={`flex items-center gap-0 group-hover:gap-4 px-3 py-3 rounded-xl transition-all border border-dashed border-[var(--primary)]/30 cursor-pointer group/upload ${uploading ? 'bg-[var(--primary)]/10' : 'hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]/60'}`}
          >
            <div className="min-w-[48px] flex justify-center items-center">
              {uploading ? (
                <div className="w-5 h-5 rounded-full border-2 border-[var(--primary)]/30 border-t-[var(--primary)] animate-spin"></div>
              ) : (
                <span className="material-symbols-outlined text-[var(--text-main)] group-hover/upload:text-[var(--primary)]">add_circle</span>
              )}
            </div>
            <span className="font-medium text-sm opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">
              {uploading ? `Uploading ${uploadProgress}%` : 'Add Material'}
            </span>
            
            {uploading && (
              <div className="absolute bottom-0 left-0 h-1 bg-[var(--primary)] transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            )}
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

        {/* Documents preview */}
        {documents && documents.length > 0 && (
          <div className="mt-8 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4 px-4 font-bold whitespace-nowrap">Your Library</p>
            <div className="space-y-1">
              {documents.slice(0, 5).map((doc, index) => (
                <div key={index} onClick={() => navigate(`/documents/${doc.id}`)} className="flex items-center gap-4 px-5 py-2.5 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 rounded-xl transition-all duration-200 cursor-pointer group/doc">
                  <span className="material-symbols-outlined text-[18px] opacity-40 group-hover/doc:opacity-100">description</span>
                  <span className="text-xs truncate font-medium">{doc.filename}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="pt-6 border-t border-[var(--border)] mt-4 space-y-2">
        <div onClick={() => navigate("/settings")} className={getNavClass("/settings")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">settings</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Settings</span>
        </div>

        <div onClick={toggleTheme} className="flex items-center gap-0 group-hover:gap-4 px-3 py-3 text-[var(--text-muted)] hover:text-[var(--primary)] transition-all group/theme duration-200 cursor-pointer">
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">palette</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap capitalize">{theme} Mode</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
