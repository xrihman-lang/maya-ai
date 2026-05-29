import React, { useState } from 'react';
import { motion } from 'motion/react';
import animeAvatar from '../assets/images/anime_avatar_1780041312602.png';

export default function LoginPage({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username.trim());
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
      }}
      className="fixed inset-0 z-[88888] flex justify-center items-center bg-gradient-to-br from-[#e67e22] to-[#f1c40f]"
    >
      <div className="flex flex-col md:flex-row items-center justify-center gap-[15px] md:gap-[40px] max-w-[900px] w-full p-5">
        
        {/* Avatar Section */}
        <div className="flex-1 flex justify-center perspective-[1000px]">
          <motion.img 
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            src={animeAvatar}
            alt="Anime Avatar" 
            className="w-full max-w-[160px] md:max-w-[280px] h-auto object-contain rounded-[20px] shadow-[0_10px_20px_rgba(0,0,0,0.15)]"
          />
        </div>

        {/* Form Section */}
        <div className="flex-1 max-w-[380px] w-full text-center">
          <h2 className="text-white text-[1.8rem] md:text-[2rem] font-semibold mb-[8px] drop-shadow-md">Register Now</h2>
          <p className="text-[#ffeaa7] text-[0.85rem] mb-[25px] leading-[1.4]">Fill in this form to participate in our online workshop</p>
          
          <form onSubmit={handleSubmit} className="space-y-[15px]">
            <div className="relative">
              <span className="absolute left-[15px] top-1/2 -translate-y-1/2 text-[#7f8c8d] text-[1.1rem] z-10 select-none">
                👤
              </span>
              <input 
                type="text" 
                placeholder="Username" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full py-[16px] pl-[45px] pr-[15px] border-none rounded-lg bg-[#f5f5f5] text-[1rem] text-gray-800 outline-none transition-all duration-300 focus:bg-white focus:shadow-[0_0_15px_rgba(0,0,0,0.1)]"
              />
            </div>
            
            <div className="relative">
              <span className="absolute left-[15px] top-1/2 -translate-y-1/2 text-[#7f8c8d] text-[1.1rem] z-10 select-none">
                🔒
              </span>
              <input 
                type="password" 
                placeholder="Password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full py-[16px] pl-[45px] pr-[15px] border-none rounded-lg bg-[#f5f5f5] text-[1rem] text-gray-800 outline-none transition-all duration-300 focus:bg-white focus:shadow-[0_0_15px_rgba(0,0,0,0.1)]"
              />
            </div>
            
            <motion.button 
              whileHover={{ backgroundColor: '#ff3838' }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              className="w-full py-[16px] border-none rounded-lg bg-[#ff5252] text-white text-[1rem] font-bold tracking-[1px] cursor-pointer transition-colors shadow-[0_4px_10px_rgba(255,82,82,0.3)]"
            >
              NEXT
            </motion.button>
          </form>
        </div>

      </div>
    </motion.div>
  );
}
