import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Shield, Users, Activity, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [logins, setLogins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "user_logins"), orderBy("lastLogin", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      let totalUses = 0;
      snapshot.forEach(doc => {
        const item = doc.data();
        data.push({ id: doc.id, ...item });
        totalUses += (item.loginCount || 1);
      });
      setLogins(data);
      setLoading(false);
    }, (error) => {
      console.error("Admin Panel Error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const totalUsers = logins.length;
  // Calculate total uses based on all login counts combined
  const totalLogins = logins.reduce((acc, curr) => acc + (curr.loginCount || 1), 0);

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex flex-col p-4 md:p-8 font-sans text-white overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <Shield className="text-red-500 w-8 h-8" />
          <h2 className="text-2xl font-bold text-red-50">Admin Command Center</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-white/5 hover:bg-red-500/20 text-white rounded-full transition-colors border border-white/10"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="max-w-5xl mx-auto w-full flex-grow flex flex-col gap-6 overflow-hidden">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-white/50 mb-1 text-sm uppercase tracking-wider font-semibold">Total Unique Users</p>
              <h3 className="text-4xl font-bold text-white">{loading ? '...' : totalUsers}</h3>
            </div>
            <Users className="w-12 h-12 text-cyan-500/50" />
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-white/50 mb-1 text-sm uppercase tracking-wider font-semibold">Total Platform Uses (Sessions)</p>
              <h3 className="text-4xl font-bold text-white">{loading ? '...' : totalLogins}</h3>
            </div>
            <Activity className="w-12 h-12 text-red-500/50" />
          </div>
        </div>

        {/* User List */}
        <div className="bg-white/5 border border-white/10 rounded-2xl flex-grow overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/10 bg-black/40">
            <h3 className="font-semibold text-lg text-white">Recent Logins</h3>
          </div>
          <div className="overflow-y-auto flex-grow p-0">
            {loading ? (
              <div className="flex justify-center p-8 text-white/50 animate-pulse">Loading data...</div>
            ) : logins.length === 0 ? (
              <div className="flex justify-center p-8 text-white/50">No login data found.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="p-4 font-medium">Email</th>
                    <th className="p-4 font-medium">Last Scanned</th>
                    <th className="p-4 font-medium text-right">Login Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logins.map((user) => (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-white">{user.email || 'Unknown'}</div>
                        <div className="text-xs text-white/40">{user.id}</div>
                      </td>
                      <td className="p-4 text-white/70">
                        {user.lastLogin ? formatDistanceToNow(user.lastLogin, { addSuffix: true }) : 'Never'}
                      </td>
                      <td className="p-4 text-right text-white/90 font-bold">
                        {user.loginCount || 1}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
