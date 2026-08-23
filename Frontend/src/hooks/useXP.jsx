import { fetchWithAuth } from '../api/fetchWithAuth';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../api/config';
import toast from 'react-hot-toast';

export const useXP = () => {
  const { user, updateUser } = useAuth();
  const [isAwarding, setIsAwarding] = useState(false);

  const awardXP = async (amount, reason = "Action completed") => {
    if (!user || !user.id || isAwarding) return;
    
    setIsAwarding(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/progress/xp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xp_amount: amount }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update user context
        updateUser({ xp: data.xp, level: data.level });
        
        // Show celebratory toast
        toast.success(
          (t) => (
            <div className="flex flex-col gap-1 w-full min-w-[200px]">
              <span className="font-bold text-sm text-white">{reason}</span>
              <div className="flex items-center justify-between">
                <span className="text-primary font-black">+{amount} XP</span>
                <span className="text-[10px] text-white/50 uppercase tracking-widest">Level {data.level}</span>
              </div>
            </div>
          ),
          { duration: 3000 }
        );

        if (data.level_up) {
          setTimeout(() => {
            toast(
              (t) => (
                <div className="flex flex-col items-center gap-2 p-2">
                  <span className="text-4xl">🎉</span>
                  <span className="font-black text-xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Level Up!</span>
                  <span className="text-sm font-bold text-white">You reached Level {data.level}</span>
                </div>
              ),
              { duration: 5000, style: { minWidth: '250px' } }
            );
          }, 1000);
        }
      }
    } catch (err) {
      console.error("Failed to award XP:", err);
    } finally {
      setIsAwarding(false);
    }
  };

  return { awardXP };
};
