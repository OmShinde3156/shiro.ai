import { fetchWithAuth } from '../../api/fetchWithAuth';
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';

const StudyRoomLobby = () => {
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
    <div className="min-h-screen bg-[#0b0e14] p-12 text-white overflow-y-auto custom-scroll flex justify-center">
      <div className="w-full max-w-6xl">
        <header className="flex justify-between items-center mb-16 mt-8">
           <div>
             <h1 className="text-5xl font-black mb-2 tracking-tighter">Study Rooms</h1>
             <p className="text-white/40 font-medium">Join a virtual classroom and study together with AI.</p>
           </div>
           <button onClick={() => navigate('/home')} className="text-white/30 hover:text-white transition-all bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10">
              <span className="material-symbols-outlined">close</span>
           </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Action Panel */}
           <div className="lg:col-span-1 space-y-6">
              <div className="bg-[#151926] p-8 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                 <h2 className="text-2xl font-black mb-6">Create a Room</h2>
                 <p className="text-sm text-white/50 mb-8 leading-relaxed">Host a focus session. You can attach a PDF syllabus or textbook for everyone to read.</p>
                 <button 
                   onClick={() => setShowCreateModal(true)}
                   className="w-full py-5 bg-gradient-to-br from-primary to-secondary text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_15px_30px_rgba(114,220,255,0.2)]"
                 >
                   <span className="material-symbols-outlined">add</span>
                   Start New Session
                 </button>
              </div>

              <div className="bg-[#151926] p-8 rounded-[2rem] border border-white/5 shadow-2xl">
                 <h2 className="text-xl font-bold mb-6">Join by Code</h2>
                 <div className="flex gap-2">
                    <input 
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="e.g. A4B9C2"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-primary outline-none uppercase font-mono tracking-widest"
                    />
                    <button 
                      onClick={() => handleJoin(joinCode)}
                      disabled={!joinCode.trim()}
                      className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                 </div>
              </div>
           </div>

           {/* Public Rooms */}
           <div className="lg:col-span-2">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                 <h2 className="text-xl font-bold">Live Public Rooms</h2>
              </div>
              
              {loading ? (
                <div className="flex justify-center py-20 text-white/20">
                  <span className="material-symbols-outlined animate-spin text-4xl">autorenew</span>
                </div>
              ) : rooms.length === 0 ? (
                <div className="bg-white/5 rounded-[2rem] p-12 text-center border border-white/5 border-dashed">
                   <span className="material-symbols-outlined text-6xl text-white/10 mb-4">search_off</span>
                   <p className="text-white/40">No public rooms available right now.<br/>Be the first to host one!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {rooms.map(room => (
                     <div key={room.id} onClick={() => handleJoin(room.id)} className="bg-[#151926] p-6 rounded-3xl border border-white/5 hover:border-primary/40 cursor-pointer transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all"></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                           <span className="text-[10px] uppercase tracking-widest text-primary font-bold bg-primary/10 px-3 py-1 rounded-full">{room.subject}</span>
                           <div className="flex items-center gap-1.5 text-white/40 text-xs font-bold">
                              <span className="material-symbols-outlined text-[14px]">group</span>
                              {room.members_count}
                           </div>
                        </div>
                        <h3 className="text-lg font-black mb-1 relative z-10">{room.name}</h3>
                        <p className="text-xs text-white/30 font-mono relative z-10">ID: {room.id}</p>
                     </div>
                  ))}
                </div>
              )}
           </div>
        </div>

        {/* Create Room Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowCreateModal(false)}>
            <div className="w-full max-w-md bg-[#151926] border border-white/10 rounded-[2rem] shadow-2xl p-8" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black">New Session</h3>
                  <button onClick={() => setShowCreateModal(false)} className="text-white/30 hover:text-white">
                     <span className="material-symbols-outlined">close</span>
                  </button>
               </div>
               
               <div className="space-y-6">
                 <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Room Name</label>
                   <input 
                     value={newRoomData.name} 
                     onChange={(e) => setNewRoomData({...newRoomData, name: e.target.value})}
                     placeholder="e.g. DSA Midterm Prep"
                     className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:border-primary outline-none" 
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Subject</label>
                   <input 
                     value={newRoomData.subject} 
                     onChange={(e) => setNewRoomData({...newRoomData, subject: e.target.value})}
                     placeholder="e.g. Computer Science"
                     className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:border-primary outline-none" 
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Shared Material (Optional)</label>
                   <select 
                     value={newRoomData.document_id}
                     onChange={(e) => setNewRoomData({...newRoomData, document_id: e.target.value})}
                     className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:border-primary outline-none appearance-none"
                   >
                     <option value="" className="bg-[#151926]">None</option>
                     {documents.map(doc => (
                       <option key={doc.id} value={doc.id} className="bg-[#151926]">{doc.filename}</option>
                     ))}
                   </select>
                 </div>
                 <button 
                   onClick={handleCreateRoom}
                   disabled={!newRoomData.name}
                   className="w-full py-5 mt-4 bg-primary text-black font-black rounded-xl hover:scale-[1.02] transition-all disabled:opacity-30 disabled:scale-100 uppercase tracking-widest text-xs"
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
