import React, { useState } from 'react';
import { Shield, Lock, Eye, Mic, HardDrive, Cpu, RefreshCw, X, CheckCircle2, ChevronRight, Globe2, Copy, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PrivacyPolicyModalProps {
  onClose: () => void;
  onClearData?: () => void;
}

export default function PrivacyPolicyModal({ onClose, onClearData }: PrivacyPolicyModalProps) {
  const [lang, setLang] = useState<'hinglish' | 'en'>('hinglish');
  const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'controls'>('summary');
  const [dataCleared, setDataCleared] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const policyUrl = 'https://mayaai.sbs/privacy';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(policyUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch (e) {
      // Fallback
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const handleClearAllData = () => {
    if (confirm(lang === 'hinglish' ? 'Kya aap apna saara local chat history aur memory delete karna chahte hain?' : 'Are you sure you want to delete all local history and saved preferences?')) {
      localStorage.removeItem('maya_chat_history');
      localStorage.removeItem('maya_user_memory');
      localStorage.removeItem('maya_user_name');
      localStorage.removeItem('maya_user_password');
      localStorage.removeItem('maya_users_db');
      setDataCleared(true);
      if (onClearData) onClearData();
      setTimeout(() => setDataCleared(false), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-2xl w-full max-h-[88vh] bg-[#0c0d12]/95 border border-maya-cyan/20 rounded-[2rem] shadow-[0_0_60px_rgba(0,240,255,0.15)] flex flex-col overflow-hidden text-white font-sans"
      >
        {/* Header Bar */}
        <div className="p-5 sm:p-6 pb-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-maya-cyan/10 border border-maya-cyan/30 flex items-center justify-center text-maya-cyan shadow-[0_0_15px_rgba(0,240,255,0.2)]">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white font-display">MAYA Privacy Policy</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-maya-cyan/10 text-maya-cyan border border-maya-cyan/20">
                  v2.5
                </span>
              </div>
              <p className="text-[11px] text-white/50 font-mono">
                {lang === 'hinglish' ? 'Aapka Data aur Privacy Maya ke sath 100% Secure hai' : 'Your data and privacy are 100% secure with MAYA'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'hinglish' ? 'en' : 'hinglish')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono transition-colors text-white/80"
              title="Toggle Language"
            >
              <Globe2 size={13} className="text-maya-cyan" />
              <span>{lang === 'hinglish' ? 'English' : 'Hinglish'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Official URL bar for mayaai.sbs */}
        <div className="px-5 py-2.5 bg-maya-cyan/[0.04] border-b border-maya-cyan/15 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 text-white/80 font-mono text-[11px] truncate">
            <span className="text-maya-cyan font-bold">Public URL:</span>
            <a href="https://mayaai.sbs/privacy" target="_blank" rel="noopener noreferrer" className="text-white hover:text-maya-cyan underline truncate">
              https://mayaai.sbs/privacy
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono text-maya-cyan border border-white/10 transition-colors"
              title="Copy URL to clipboard"
            >
              {copiedUrl ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedUrl ? 'Copied!' : 'Copy URL'}</span>
            </button>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-maya-cyan/10 hover:bg-maya-cyan/20 text-[11px] font-mono text-maya-cyan border border-maya-cyan/25 transition-colors"
            >
              <span>Open Page</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex px-5 pt-3 border-b border-white/5 gap-2 bg-black/20 text-xs font-mono">
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-2.5 px-3 border-b-2 font-medium transition-all ${
              activeTab === 'summary'
                ? 'border-maya-cyan text-maya-cyan'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            {lang === 'hinglish' ? 'Main Highlights' : 'Highlights'}
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 px-3 border-b-2 font-medium transition-all ${
              activeTab === 'details'
                ? 'border-maya-cyan text-maya-cyan'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            {lang === 'hinglish' ? 'Complete Policy' : 'Detailed Policy'}
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`pb-2.5 px-3 border-b-2 font-medium transition-all ${
              activeTab === 'controls'
                ? 'border-maya-cyan text-maya-cyan'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            {lang === 'hinglish' ? 'Data Controls' : 'Your Data Controls'}
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(88vh-180px)] space-y-6 text-sm leading-relaxed text-white/80 no-scrollbar">
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-maya-cyan/5 border border-maya-cyan/20">
                <p className="text-xs text-white/90 font-medium">
                  {lang === 'hinglish'
                    ? 'Maya AI ko aapki privacy aur safety ko dhyan me rakh kar banaya gaya hai. Hum aapka koi personal data bechte nahi hain aur na hi kisi 3rd party tracker ke sath share karte hain.'
                    : 'MAYA AI is engineered with privacy and security at its core. We do not sell your personal data or share it with third-party tracking networks.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-maya-cyan font-bold">
                    <Mic size={16} />
                    <span>{lang === 'hinglish' ? 'Voice & Audio' : 'Voice & Microphone'}</span>
                  </div>
                  <p className="text-white/60">
                    {lang === 'hinglish'
                      ? 'Mic ka use tabhi hota hai jab aap live voice session start karte hain. Audio stream real-time me process hoti hai aur server par store nahi hoti.'
                      : 'Microphone is active only when you initiate live voice mode. Audio is processed ephemerally in real-time and never archived.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-pink-400 font-bold">
                    <Eye size={16} />
                    <span>{lang === 'hinglish' ? 'Camera & Live Lens' : 'Camera & Live Lens'}</span>
                  </div>
                  <p className="text-white/60">
                    {lang === 'hinglish'
                      ? 'Selfie/face scan sirf skincare advice aur facial expression diagnosis ke liye temporary decode hota hai. Photo database me save nahi ki jaati.'
                      : 'Camera frames are processed on-demand for skincare tips and expression analysis. Images are never permanently saved.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <HardDrive size={16} />
                    <span>{lang === 'hinglish' ? 'Local Browser Storage' : 'Local Storage Only'}</span>
                  </div>
                  <p className="text-white/60">
                    {lang === 'hinglish'
                      ? 'Aapki chat history aur custom preferences aapke apne device ke browser (LocalStorage) me save rehti hain. Aap kabhi bhi 1-click me erase kar sakte hain.'
                      : 'Chat records, custom name, and memory live inside your browser’s localStorage on your device. You can purge them with a single click.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Cpu size={16} />
                    <span>{lang === 'hinglish' ? 'Google Gemini AI' : 'Official Gemini Engine'}</span>
                  </div>
                  <p className="text-white/60">
                    {lang === 'hinglish'
                      ? 'Maya Google ke official Gemini models ke through securely baat karti hai. Backend proxy ke through connection encrypted rehta hai.'
                      : 'Responses are powered securely via official Google Gemini APIs through an encrypted backend proxy.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6 text-xs sm:text-sm">
              <section className="space-y-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock size={16} className="text-maya-cyan" />
                  1. Information We Collect
                </h3>
                <p className="text-white/70">
                  {lang === 'hinglish'
                    ? 'MAYA AI use karte waqt hum nimnlikhit jankari sirf aapko interactive experience dene ke liye use karte hain:'
                    : 'While using MAYA AI, the following inputs are processed exclusively to provide conversational and assistant features:'}
                </p>
                <ul className="list-disc pl-5 space-y-1 text-white/60">
                  <li><strong>{lang === 'hinglish' ? 'User Messages' : 'User Prompts'}:</strong> Text prompts, voice transcripts, and context sent directly during conversation.</li>
                  <li><strong>{lang === 'hinglish' ? 'City / Weather Location' : 'City Weather'}:</strong> Only user-specified city names (e.g. Delhi, Mumbai) to retrieve temperature and generate skincare recommendations. We do not track background GPS coordinates.</li>
                  <li><strong>{lang === 'hinglish' ? 'Live Camera / Visual Input' : 'Visual Inputs'}:</strong> Base64 image frames taken explicitly by you for skincare or object diagnosis.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu size={16} className="text-maya-cyan" />
                  2. How Data is Processed & Shared
                </h3>
                <p className="text-white/70">
                  {lang === 'hinglish'
                    ? 'Aapke prompt server-side secure proxy ke through Google Gemini API ko bheje jaate hain. Hum kisi bhi 3rd-party advertising platform ko data nahi dete aur na hi user behavioral profiles monetize karte hain.'
                    : 'Prompts and visual attachments are transmitted securely through our backend proxy to Google Gemini API endpoints over TLS encryption. We do not share data with advertising agencies or data brokers.'}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield size={16} className="text-maya-cyan" />
                  3. Health & Skincare Disclaimer
                </h3>
                <p className="text-white/70 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                  {lang === 'hinglish'
                    ? '⚠️ Maya ek AI companion aur general wellness/skincare guide hai, certified doctor ya dermatologist nahi hai. Kisi bhi serious skin problem ya medical condition ke liye humesha certified medical professional se consult karein.'
                    : '⚠️ MAYA is an AI companion and general skincare wellness guide, not a licensed medical professional or dermatologist. For persistent skin conditions or medical issues, always seek advice from a qualified healthcare practitioner.'}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <HardDrive size={16} className="text-maya-cyan" />
                  4. Data Retention & User Rights
                </h3>
                <p className="text-white/70">
                  {lang === 'hinglish'
                    ? 'Aap jab chahein apne browser ki history aur saved memory ko "Reset" button ya niche diye gaye Data Controls se instantly clear kar sakte hain.'
                    : 'You retain total control over your conversational history. Stored browser data can be purged instantaneously at any time.'}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Globe2 size={16} className="text-maya-cyan" />
                  5. Google AdSense & Cookies
                </h3>
                <p className="text-white/70">
                  {lang === 'hinglish'
                    ? 'Hum mayaai.sbs par Google AdSense use karte hain. Google aur anya 3rd-party vendors cookies ka use karte hain taaki users ke purane visits ke aadhar par relevant ads dikhaye jaa sakein. Aap Google Ads Settings par jaakar personalized ads ko opt out kar sakte hain.'
                    : 'We use Google AdSense on mayaai.sbs. Third-party vendors, including Google, use cookies (including the DoubleClick cookie) to serve ads based on user visits to this and other websites. Users may opt out of personalized advertising by visiting Google Ads Settings (google.com/settings/ads).'}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock size={16} className="text-maya-cyan" />
                  6. Official Domain & Contact
                </h3>
                <p className="text-white/70">
                  <strong>Official Website:</strong> <a href="https://mayaai.sbs" target="_blank" rel="noopener noreferrer" className="text-maya-cyan underline">https://mayaai.sbs</a><br />
                  <strong>Direct Policy URL:</strong> <a href="https://mayaai.sbs/privacy" target="_blank" rel="noopener noreferrer" className="text-maya-cyan underline">https://mayaai.sbs/privacy</a><br />
                  <strong>Inquiries / Contact:</strong> <a href="mailto:mohdalikhan990x@gmail.com" className="text-maya-cyan underline">mohdalikhan990x@gmail.com</a>
                </p>
              </section>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {lang === 'hinglish' ? 'Apna Local Data Erase Karein' : 'Clear All Local Data & Chat Logs'}
                  </h3>
                  <p className="text-xs text-white/50 mt-1">
                    {lang === 'hinglish'
                      ? 'Is button ko dabane se aapke browser me saved sabhi messages, user name, saved password aur Maya memory delete ho jayegi.'
                      : 'Clicking below purges all stored messages, identity credentials, and contextual memory saved in this browser.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClearAllData}
                    className="px-4 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                  >
                    <RefreshCw size={14} />
                    {lang === 'hinglish' ? 'Saara Data Clear Karein' : 'Purge All Data'}
                  </button>

                  {dataCleared && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono"
                    >
                      <CheckCircle2 size={15} />
                      <span>{lang === 'hinglish' ? 'Data safalta-purvak clear ho gaya!' : 'Local data successfully wiped!'}</span>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-xs space-y-2 text-white/60">
                <div className="font-bold text-white text-xs">Security & Transparency Standards</div>
                <div className="flex items-center gap-2 text-maya-cyan">
                  <CheckCircle2 size={13} />
                  <span>No background voice recording</span>
                </div>
                <div className="flex items-center gap-2 text-maya-cyan">
                  <CheckCircle2 size={13} />
                  <span>No persistent face or photo storage</span>
                </div>
                <div className="flex items-center gap-2 text-maya-cyan">
                  <CheckCircle2 size={13} />
                  <span>Zero tracking cookies & no ad telemetry</span>
                </div>
                <div className="flex items-center gap-2 text-maya-cyan">
                  <CheckCircle2 size={13} />
                  <span>Client-side key safety via backend proxy</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <span className="text-[10px] font-mono text-white/40">
            {lang === 'hinglish' ? 'Last Updated: October 2026 • Powered by GDX' : 'Last Updated: October 2026 • Powered by GDX'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-maya-cyan/20 hover:bg-maya-cyan/30 text-maya-cyan border border-maya-cyan/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
          >
            {lang === 'hinglish' ? 'Theek Hai, Samajh Gaya' : 'Got It, Close'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
