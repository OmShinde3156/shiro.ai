import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';
import { fetchWithAuth } from '../../api/fetchWithAuth';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  UploadCloud, 
  Search, 
  Trash2, 
  Edit2, 
  School, 
  HelpCircle, 
  Layers, 
  FileText, 
  ExternalLink,
  Plus,
  CheckCircle2,
  FolderOpen,
  ArrowRight
} from 'lucide-react';

import Card, { CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';

export const DocumentsPage = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments } = useContext(Context);
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchDocuments(user.id);
    }
  }, [user]);

  const handleFileUpload = async (filesOrFile) => {
    if (!filesOrFile) return;
    const fileList = filesOrFile instanceof FileList || Array.isArray(filesOrFile) 
      ? Array.from(filesOrFile) 
      : [filesOrFile];
    
    if (fileList.length === 0) return;

    setIsUploading(true);
    setUploadProgress(20);

    const formData = new FormData();
    fileList.forEach(file => formData.append('files', file));
    // Also append 'file' for single-file backwards compatibility
    if (fileList.length === 1) {
      formData.append('file', fileList[0]);
    }
    formData.append('user_id', user?.id || 1);

    try {
      setUploadProgress(50);
      const response = await fetchWithAuth(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(90);
      if (response.ok) {
        toast.success(fileList.length === 1 
          ? `"${fileList[0].name}" processed successfully!`
          : `Successfully processed ${fileList.length} documents!`
        );
        fetchDocuments(user?.id || 1);
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Network error during upload');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    
    setDeletingId(id);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/documents/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success("Document deleted");
        fetchDocuments(user.id);
      }
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  // Subjects filter
  const subjects = ['all', 'General', 'CS / Tech', 'Math', 'Science', 'Notes'];

  const filteredDocs = (documents || []).filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (doc.subject && doc.subject.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSubject = selectedSubject === 'all' || 
                           (doc.subject && doc.subject.toLowerCase() === selectedSubject.toLowerCase());
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#89A88D] mb-1 font-mono">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>KNOWLEDGE REPOSITORY</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] font-serif">
            Document Library
          </h1>
          <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-1">
            Upload any textbook, lecture slides, diagrams, notes, or datasets for Truth-Aware AI analysis.
          </p>
        </div>

        {/* Upload Button */}
        <div>
          <input
            type="file"
            id="doc-upload-input"
            className="hidden"
            multiple
            accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.markdown,.csv,.tsv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.json,.tex,.html,image/*"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <Button
            variant="primary"
            size="md"
            className="w-full sm:w-auto justify-center"
            onClick={() => document.getElementById('doc-upload-input')?.click()}
            disabled={isUploading}
          >
            <UploadCloud className="w-4 h-4" />
            {isUploading ? `Processing (${uploadProgress}%)...` : "Upload Documents"}
          </Button>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length > 0) handleFileUpload(e.dataTransfer.files);
        }}
        onClick={() => document.getElementById('doc-upload-input')?.click()}
        className="p-4 sm:p-6 rounded-2xl border-2 border-dashed border-[var(--border)] hover:border-[#89A88D] bg-[var(--bg-surface)] hover:bg-[#89A88D]/5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center shadow-xs active:scale-[0.99]"
      >
        <div className="p-3 rounded-full bg-[#89A88D]/15 text-[#89A88D] border border-[#89A88D]/30">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-main)] font-serif">
            Drop your PDFs, Slides, Notes, or Images here
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">
            Supports PDF, DOCX/DOC, PPTX/PPT, Images (PNG/JPG/WEBP), TXT, Markdown, CSV & Excel
          </p>
        </div>
      </div>

      {/* Search & Subject Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl text-xs md:text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#89A88D]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar touch-scroll pb-1">
          {subjects.map((subj) => (
            <button
              key={subj}
              onClick={() => setSelectedSubject(subj)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 active:scale-95 ${
                selectedSubject === subj
                  ? 'bg-[#89A88D] text-black font-semibold shadow-sm'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border)]'
              }`}
            >
              {subj === 'all' ? 'All Sources' : subj}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredDocs.map((doc) => (
            <Card
              key={doc.id}
              onClick={() => navigate(`/documents/${doc.id}`)}
              className="p-5 flex flex-col justify-between h-48 cursor-pointer hover:scale-[1.01] bg-[var(--bg-surface)] border-[var(--border)]"
            >
              {/* Header */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-[#89A88D]/15 border border-[#89A88D]/30 text-[#89A88D] shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="sage" size="sm">
                      {doc.subject || 'General'}
                    </Badge>
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      disabled={deletingId === doc.id}
                      className="p-1 text-[var(--text-muted)] hover:text-[#C96B62] transition-colors rounded-md"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-[var(--text-main)] text-sm truncate font-serif" title={doc.filename}>
                  {doc.filename}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                  {doc.summary || "Ready for Grounded RAG Chat, Quiz generation, and Feynman active recall."}
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  {doc.page_count ? `${doc.page_count} Pages` : 'Indexed'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/room/doc_${doc.id}`); }}
                    className="p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors flex items-center gap-1 text-[11px]"
                    title="Open Study Room"
                  >
                    <School className="w-3.5 h-3.5 text-[#89A88D]" />
                    <span>Study</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/documents/${doc.id}`); }}
                    className="p-1.5 rounded-lg bg-[#89A88D]/15 hover:bg-[#89A88D]/25 text-[#89A88D] transition-colors flex items-center gap-1 text-[11px] font-medium"
                  >
                    <span>View</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#89A88D]/15 border border-[#89A88D]/30 flex items-center justify-center text-[#89A88D] mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-main)] font-serif">No Documents Match Your Query</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Upload your lecture notes, syllabus, or textbook PDFs to begin grounded learning.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => document.getElementById('doc-upload-input')?.click()}
          >
            Upload New Document
          </Button>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
