import { fetchWithAuth } from '../../api/fetchWithAuth';
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';
import './DocumentsPage.css';

const DocumentsPage = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments } = useContext(Context);
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [newSubject, setNewSubject] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchDocuments(user.id);
    }
  }, [user]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document? This cannot be undone.")) return;
    
    setDeletingId(id);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/documents/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchDocuments(user.id);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateSubject = async (id, e) => {
    e.stopPropagation();
    try {
      const formData = new FormData();
      formData.append('subject', newSubject);

      const response = await fetchWithAuth(`${API_BASE_URL}/documents/${id}/subject`, {
        method: 'PUT',
        body: formData,
      });

      if (response.ok) {
        setEditingId(null);
        fetchDocuments(user.id);
      }
    } catch (err) {
      console.error("Update subject failed:", err);
    }
  };

  const getSubjectInfo = (subject) => {
    const s = (subject || 'General').toLowerCase();
    if (s.includes('math')) return { color: '#72dcff', emoji: '🔢', icon: 'calculate' };
    if (s.includes('science') || s.includes('physic') || s.includes('chem')) return { color: '#5eead4', emoji: '🧪', icon: 'science' };
    if (s.includes('history') || s.includes('social')) return { color: '#ff9d6c', emoji: '📜', icon: 'history_edu' };
    if (s.includes('code') || s.includes('program') || s.includes('tech')) return { color: '#dd8bfb', emoji: '💻', icon: 'terminal' };
    if (s.includes('art') || s.includes('design')) return { color: '#fb7185', emoji: '🎨', icon: 'palette' };
    return { color: 'var(--primary)', emoji: '📚', icon: 'description' };
  };

  const quickActions = [
    { id: 1, title: "Take Quiz", desc: "Test what you know.", icon: "quiz", emoji: "🧠", color: "primary", route: "/quiz" },
    { id: 2, title: "Study Cards", desc: "Quick memory review.", icon: "view_carousel", emoji: "🃏", color: "secondary", route: "/flashcards" },
    { id: 3, title: "Summarize", desc: "Short, easy notes.", icon: "auto_awesome", emoji: "📝", color: "tertiary", route: "/summary" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-10">
      {/* Header Section */}
      <section className="flex flex-col gap-6 pt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate("/home")} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all text-[var(--text-muted)] hover:text-primary">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2">My Library 📚</h1>
              <p className="text-white/80 font-body text-sm md:text-base max-w-2xl">All your study notes and AI helps in one place. Simple and fast.</p>
            </div>
          </div>
          <button 
            onClick={() => document.querySelector('aside input[type="file"]')?.click()}
            className="hidden md:flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-white font-headline font-bold px-6 py-3 rounded-full hover:shadow-[0_0_20px_rgba(114,220,255,0.4)] transition-all transform hover:-translate-y-0.5"
          >
            <span className="material-symbols-outlined fill">cloud_upload</span>
            Add New File
          </button>
        </div>

        {/* Search Bar Pill */}
        <div className="relative w-full max-w-2xl bg-white/5 rounded-full border border-white/10 focus-within:border-primary/50 transition-all overflow-hidden flex items-center px-4 py-3 shadow-inner">
          <span className="material-symbols-outlined text-white/40 mr-3">search</span>
          <input className="w-full bg-transparent border-none focus:ring-0 text-white placeholder:text-white/30 font-body outline-none text-sm" placeholder="Search your books, notes, or topics..." type="text"/>
        </div>
      </section>

      {/* Quick Actions Horizontal Scroll */}
      <section className="flex flex-col gap-4">
        <h2 className="font-headline text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-xl">bolt</span>
          Quick Helps
        </h2>
        <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0">
          {quickActions.map((action) => (
            <div 
              key={action.id}
              onClick={() => navigate(action.route)}
              className="flex-none w-64 glass-card p-5 hover:bg-white/10 transition-all cursor-pointer group relative overflow-hidden flex flex-col gap-3 border-white/10"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 bg-${action.color}/5 rounded-full blur-2xl -mr-8 -mt-8`}></div>
              <div className="flex justify-between items-center">
                <div className={`w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-${action.color}/30 text-[var(--${action.color})] group-hover:scale-110 transition-transform`}>
                  <span className="material-symbols-outlined fill text-xl">{action.icon}</span>
                </div>
                <span className="text-2xl">{action.emoji}</span>
              </div>
              <div>
                <h3 className="font-headline font-bold text-white mb-1">{action.title}</h3>
                <p className="font-body text-xs text-white/60 line-clamp-2">{action.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Documents Grid */}
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-2xl font-bold text-white tracking-tight">Recent Files</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents?.map((doc) => {
            const info = getSubjectInfo(doc.subject);
            return (
              <article 
                key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}`)}
                className="glass-card relative overflow-hidden group cursor-pointer border-white/10 hover:border-primary/40 shadow-lg transition-all"
                style={{ borderLeft: `4px solid ${info.color}` }}
              >
                <div className="relative z-10 flex flex-col h-full gap-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10" style={{ color: info.color }}>
                      <span className="material-symbols-outlined text-2xl">{info.icon}</span>
                    </div>
                    <span className="text-2xl opacity-40 group-hover:opacity-100 transition-opacity">{info.emoji}</span>
                  </div>

                  <div>
                    <h3 className="font-headline font-bold text-lg text-white mb-1 group-hover:text-primary transition-colors truncate">{doc.filename}</h3>
                    <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: info.color }}>{doc.subject || 'General Studies'}</p>
                  </div>

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: info.color }}></div>
                      <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Ready to Study</span>
                    </div>
                    <button 
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white/20 hover:bg-red-500/10 hover:text-red-400 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Add New Card */}
          <div 
            onClick={() => document.querySelector('aside input[type="file"]')?.click()}
            className="border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center p-8 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-[var(--text-muted)] group-hover:text-primary group-hover:border-primary/40 transition-all mb-3">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span className="text-xs font-bold text-[var(--text-muted)] group-hover:text-primary">Upload New Material</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DocumentsPage;
