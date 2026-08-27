import { fetchWithAuth } from '../../api/fetchWithAuth';
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';

export const StudyRoomLobby = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments } = useContext(Context);
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomData, setNewRoomData] = useState({ name: '', subject: '', document_id: '' });
  
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    fetchRooms();
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  const fetchRooms = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/rooms/`);
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomData.name || !user?.id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/rooms/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRoomData,
          user_id: user.id
        })
      });
      const data = await res.json();
      if (data.room_id) {
        navigate(`/room/${data.room_id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoin = (roomId) => {
    if (roomId.trim()) {
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] p-8 md:p-12 text-[var(--text-main)] overflow-y-auto custom-scroll flex justify-center">
      <div className="w-full max-w-6xl">
        <header className="flex justify-between items-center mb-12 mt-4">
           <div>
             <h1 className="text-3xl md:text-4xl font-bold mb-1 tracking-tight font-serif">Study Rooms</h1>
             <p className="text-[var(--text-secondary)] text-sm">Join a virtual classroom and study together with AI.</p>
           </div>
           <button onClick={() => navigate('/home')} className="text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all bg-[var(--bg-surface)] p-3 rounded-2xl border border-[var(--border)] shadow-xs">
              <span className="material-symbols-outlined">close</span>
           </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Action Panel */}
           <div className="lg:col-span-1 space-y-6">
              <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border)] shadow-sm relative overflow-hidden group">
                 <h2 className="text-xl font-bold mb-3 font-serif">Create a Room</h2>
                 <p className="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">Host a focus session. You can attach a PDF syllabus or textbook for everyone to read.</p>
                 <button 
                   onClick={() => setShowCreateModal(true)}
                   className="w-full py-4 bg-[#3F6048] hover:bg-[#34523D] dark:bg-[#89A88D] text-white dark:text-black font-bold rounded-2xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm text-sm"
                 >
                   <span className="material-symbols-outlined">add</span>
                   Start New Session
                 </button>
              </div>

              <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border)] shadow-sm">
                 <h2 className="text-lg font-bold mb-4 font-serif">Join by Code</h2>
                 <div className="flex gap-2">
                    <input 
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="e.g. A4B9C2"
                      className="flex-1 bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:border-[#3F6048] text-[var(--text-main)] outline-none uppercase font-mono tracking-widest"
                    />
                    <button 
                      onClick={() => handleJoin(joinCode)}
                      disabled={!joinCode.trim()}
                      className="w-12 h-12 bg-[#3F6048] text-white dark:bg-[#89A88D] dark:text-black rounded-xl flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                 </div>
              </div>
           </div>

           {/* Public Rooms */}
           <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-2.5 h-2.5 rounded-full bg-[#3F6048] dark:bg-[#89A88D] animate-pulse"></div>
                 <h2 className="text-lg font-bold font-serif">Live Public Rooms</h2>
              </div>
              
              {loading ? (
                <div className="flex justify-center py-20 text-[var(--text-muted)]">
                  <span className="material-symbols-outlined animate-spin text-4xl">autorenew</span>
                </div>
              ) : rooms.length === 0 ? (
                <div className="bg-[var(--bg-surface)] rounded-3xl p-12 text-center border border-[var(--border)] border-dashed">
                   <span className="material-symbols-outlined text-5xl text-[var(--text-muted)] opacity-50 mb-3">search_off</span>
                   <p className="text-[var(--text-secondary)] text-sm">No public rooms available right now.<br/>Be the first to host one!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rooms.map(room => (
                     <div key={room.id} onClick={() => handleJoin(room.id)} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border)] hover:border-[#3F6048]/40 dark:hover:border-[#89A88D]/40 cursor-pointer transition-all shadow-xs group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-3 relative z-10">
                           <span className="text-[10px] uppercase tracking-widest text-[#3F6048] dark:text-[#A8C5AC] font-bold bg-[#3F6048]/15 px-2.5 py-0.5 rounded-full">{room.subject}</span>
                           <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs font-bold font-mono">
                              <span className="material-symbols-outlined text-[14px]">group</span>
                              {room.members_count}
                           </div>
                        </div>
                        <h3 className="text-base font-bold mb-1 relative z-10 font-serif">{room.name}</h3>
                        <p className="text-xs text-[var(--text-muted)] font-mono relative z-10">ID: {room.id}</p>
                     </div>
                  ))}
                </div>
              )}
           </div>
        </div>

        {/* Create Room Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowCreateModal(false)}>
            <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl shadow-xl p-8" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold font-serif">New Session</h3>
                  <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                     <span className="material-symbols-outlined">close</span>
                  </button>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)] mb-1.5 block">Room Name</label>
                   <input 
                     value={newRoomData.name} 
                     onChange={(e) => setNewRoomData({...newRoomData, name: e.target.value})}
                     placeholder="e.g. DSA Midterm Prep"
                     className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-main)] rounded-xl p-3.5 text-sm focus:border-[#3F6048] outline-none" 
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)] mb-1.5 block">Subject</label>
                   <input 
                     value={newRoomData.subject} 
                     onChange={(e) => setNewRoomData({...newRoomData, subject: e.target.value})}
                     placeholder="e.g. Computer Science"
                     className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-main)] rounded-xl p-3.5 text-sm focus:border-[#3F6048] outline-none" 
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)] mb-1.5 block">Shared Material (Optional)</label>
                   <select 
                     value={newRoomData.document_id}
                     onChange={(e) => setNewRoomData({...newRoomData, document_id: e.target.value})}
                     className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-main)] rounded-xl p-3.5 text-sm focus:border-[#3F6048] outline-none"
                   >
                     <option value="" className="bg-[var(--bg-surface)] text-[var(--text-main)]">None</option>
                     {documents.map(doc => (
                       <option key={doc.id} value={doc.id} className="bg-[var(--bg-surface)] text-[var(--text-main)]">{doc.filename}</option>
                     ))}
                   </select>
                 </div>
                 <button 
                   onClick={handleCreateRoom}
                   disabled={!newRoomData.name}
                   className="w-full py-4 mt-2 bg-[#3F6048] text-white dark:bg-[#89A88D] dark:text-black font-bold rounded-xl hover:scale-[1.01] transition-all disabled:opacity-30 disabled:scale-100 uppercase tracking-widest text-xs"
                 >
                   Launch Room
                 </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyRoomLobby;
