/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Camera, Plus, X, Loader2, Menu, MessageSquarePlus, MessageSquare, Trash2, LogOut, LogIn, User, Lock, Check, Key, Wallet, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { chatWithAIStream, ChatMessage } from './services/geminiService';
import CameraOverlay from './components/CameraOverlay';
import { CodeBlock } from './components/CodeBlock';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

const DEFAULT_NOIR_AVATAR = "https://image.pollinations.ai/prompt/gorgeous%20dark%20anime%20girl%20hacker%20red%20theme%20black%20hair%20cool%20confident%20pose%20close%20up%20profile%20picture%20masterpiece?width=512&height=512&nologo=true&seed=8888";

interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const Avatar = ({ role, customAvatar, onClick, userPic }: { role: 'user' | 'model', customAvatar?: string | null, onClick?: () => void, userPic?: string | null }) => {
  const [imgError, setImgError] = useState(false);
  
  if (role === 'user') {
    return (
      <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center mt-1 overflow-hidden shrink-0 shadow-lg">
        {!imgError && userPic ? (
           <img src={userPic} alt="User" onError={() => setImgError(true)} className="w-full h-full object-cover"/>
        ) : (
           <span className="text-white text-xs">You</span>
        )}
      </div>
    );
  }
  
  return (
    <div 
      onClick={onClick}
      className={`w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center mt-1 overflow-hidden shrink-0 shadow-lg ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      {!imgError && (customAvatar || DEFAULT_NOIR_AVATAR) ? (
        <img 
          src={customAvatar || DEFAULT_NOIR_AVATAR} 
          alt="Noir AI" 
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-black font-bold text-[10px] bg-white w-full h-full flex items-center justify-center">N</span>
      )}
    </div>
  );
};

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('noir_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error('Failed to parse sessions', err);
      }
    }
    
    // Migrate old format if exists
    const oldHistory = localStorage.getItem('noir_chat_history');
    if (oldHistory) {
      try {
        const msgs = JSON.parse(oldHistory);
        return [{ id: Date.now().toString(), name: 'Percakapan Lama', messages: msgs, updatedAt: Date.now() }];
      } catch (err) {}
    }
    
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (sessions.length > 0) return sessions[0].id;
    return null;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (activeSessionId) {
       const session = sessions.find(s => s.id === activeSessionId);
       if (session) return session.messages;
    }
    return [{ role: 'model', text: 'Sistem online. Saya Noir AI, asisten pemrograman Anda. Kirimkan script, error log, atau screenshot kode yang perlu kita retas.' }];
  });

  useEffect(() => {
    localStorage.setItem('noir_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Sync current messages to active session
  useEffect(() => {
    if (activeSessionId) {
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          // Update name based on first user message if name is "Percakapan Baru"
          let name = s.name;
          if (name === 'Percakapan Baru' && messages.some(m => m.role === 'user')) {
             const firstUserMsg = messages.find(m => m.role === 'user')?.text || '';
             name = firstUserMsg.slice(0, 30) + (firstUserMsg.length > 30 ? '...' : '');
          }
          return { ...s, messages, updatedAt: Date.now(), name };
        }
        return s;
      }));
    } else if (messages.length > 1) {
      // Auto create session if the user types something
      const newId = Date.now().toString();
      const firstUserMsg = messages.find(m => m.role === 'user')?.text || 'Percakapan Baru';
      const name = firstUserMsg.slice(0, 30) + (firstUserMsg.length > 30 ? '...' : '');
      const newSessionInfo = { id: newId, name, messages, updatedAt: Date.now() };
      setSessions(prev => [newSessionInfo, ...prev]);
      setActiveSessionId(newId);
    }
  }, [messages, activeSessionId]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Sidebar state
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => localStorage.getItem('noir_login') === 'true');
  const [showLoginModal, setShowLoginModal] = useState(!isLoggedIn);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [customAvatar, setCustomAvatar] = useState<string | null>(() => localStorage.getItem('noir_avatar'));
  const [userAvatar, setUserAvatar] = useState<string | null>(() => localStorage.getItem('user_anime_avatar'));

  // API Key & Credit States
  const [credits, setCredits] = useState<number>(() => {
    const saved = localStorage.getItem('noir_credits');
    return saved ? parseFloat(saved) : 10.00; // Starting $10
  });
  const [apiKeys, setApiKeys] = useState<any[]>(() => {
    const saved = localStorage.getItem('noir_api_keys');
    return saved ? JSON.parse(saved) : [];
  });
  const [showApiModal, setShowApiModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  useEffect(() => {
    localStorage.setItem('noir_credits', credits.toFixed(2));
  }, [credits]);

  useEffect(() => {
    localStorage.setItem('noir_api_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  const generateApiKey = () => {
    if (!newKeyName.trim()) return alert("Berikan nama untuk API Key Anda");
    const newKey = {
      id: Math.random().toString(36).substr(2, 9),
      name: newKeyName,
      key: `nr-${Math.random().toString(36).substr(2, 24)}`,
      createdAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
    setApiKeys([newKey, ...apiKeys]);
    setNewKeyName('');
  };

  const deleteApiKey = (id: string) => {
    setApiKeys(apiKeys.filter(k => k.id !== id));
  };

  // Subscription states
  const FREE_LIMIT = 5;
  const [isPremium, setIsPremium] = useState<boolean>(() => localStorage.getItem('noir_is_premium') === 'true');
  const [messageCount, setMessageCount] = useState<number>(() => {
    const savedCount = localStorage.getItem('noir_message_count');
    return savedCount ? parseInt(savedCount, 10) : 0;
  });
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<{name: string, price: string} | null>(null);

  const closePremiumModal = () => {
    setShowPremiumModal(false);
    setTimeout(() => setCheckoutTier(null), 300);
  };

  useEffect(() => {
    localStorage.setItem('noir_is_premium', String(isPremium));
  }, [isPremium]);

  useEffect(() => {
    localStorage.setItem('noir_message_count', String(messageCount));
  }, [messageCount]);

  useEffect(() => {
    localStorage.setItem('noir_login', String(isLoggedIn));
    if (isLoggedIn) setShowLoginModal(false);
  }, [isLoggedIn]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true);
        setShowLoginModal(false);
      } else {
        // We only clear if login was solely driven by Firebase.
        // If they logged in as admin locally, we might not want to override it.
        // Let's just track firebase user for now.
        // setIsLoggedIn(false); 
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    if (loginForm.user === "admin" && loginForm.pass === "1234") {
      setIsLoggedIn(true);
      setShowLoginModal(false);
    } else {
      alert("Username atau Password Salah");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setIsLoggedIn(true);
      setShowLoginModal(false);
    } catch (error) {
      if (error instanceof Error) {
        alert("Gagal masuk dengan Google: " + error.message);
      } else {
        alert("Gagal masuk dengan Google.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
      setShowLoginModal(true);
      setIsMenuOpen(false);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  useEffect(() => {
    if (!userAvatar) {
      const fallbackAvatar = "https://image.pollinations.ai/prompt/cute%20anime%20boy%20hacker%20style%20profile%20picture?width=512&height=512&nologo=true";
      fetch('https://api.waifu.pics/sfw/waifu')
        .then(res => {
          if (!res.ok) throw new Error('API unstable');
          return res.json();
        })
        .then(data => {
          if (data && data.url) {
            setUserAvatar(data.url);
            localStorage.setItem('user_anime_avatar', data.url);
          } else {
            throw new Error('Invalid data');
          }
        })
        .catch(() => {
          // Silent fallback to avoid console noise
          setUserAvatar(fallbackAvatar);
          localStorage.setItem('user_anime_avatar', fallbackAvatar);
        });
    }
  }, [userAvatar]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let touchStartX = 0;
    
    // Global swipe detector
    const handleGlobalTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };
    
    const handleGlobalTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const distance = touchEndX - touchStartX;
      
      setIsMenuOpen(prevIsOpen => {
        if (!prevIsOpen && distance > 50 && touchStartX < 80) {
          // Swipe Right to Open (If started near the left edge)
          return true;
        } else if (prevIsOpen && distance < -50) {
          // Swipe Left to Close (Anywhere on screen)
          return false;
        }
        return prevIsOpen;
      });
    };

    window.addEventListener('touchstart', handleGlobalTouchStart, { passive: true });
    window.addEventListener('touchend', handleGlobalTouchEnd, { passive: true });
    
    return () => {
      window.removeEventListener('touchstart', handleGlobalTouchStart);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewChat = () => {
    if (isLoading) {
      alert("Harap tunggu hingga AI selesai memproses respon sebelum berpindah obrolan.");
      return;
    }
    setActiveSessionId(null);
    setMessages([{ role: 'model', text: 'Sistem online. Percakapan baru telah dimulai. Apa yang ingin kita retas hari ini?' }]);
    setIsMenuOpen(false);
  };

  const switchChat = (id: string) => {
    if (isLoading) {
      alert("Harap tunggu hingga AI selesai memproses respon sebelum berpindah obrolan.");
      return;
    }
    const session = sessions.find(s => s.id === id);
    if (session) {
      setActiveSessionId(id);
      setMessages(session.messages);
      setIsMenuOpen(false);
    }
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) {
      alert("Harap tunggu hingga AI selesai memproses respon sebelum menghapus obrolan.");
      return;
    }
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (activeSessionId === id) {
        if (filtered.length > 0) {
          setActiveSessionId(filtered[0].id);
          setMessages(filtered[0].messages);
        } else {
          startNewChat();
        }
      }
      return filtered;
    });
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMsg: ChatMessage = { 
      role: 'user', 
      text: input, 
      image: selectedImage || undefined 
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      // Add an empty model message placeholder
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      const stream = await chatWithAIStream(newMessages);
      let fullResponse = '';
      
      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'model', text: fullResponse };
          return updated;
        });
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'model', text: 'Maaf, saya sedang mengalami kendala teknis.' };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setIsMenuOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const base64Compressed = canvas.toDataURL('image/jpeg', 0.8);
          setCustomAvatar(base64Compressed);
          try {
            localStorage.setItem('noir_avatar', base64Compressed);
          } catch (err) {
            console.error('Failed to save to localStorage:', err);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const onCameraCapture = (imageData: string) => {
    setSelectedImage(imageData);
    setIsMenuOpen(false);
  };

  return (
    <div 
      className="flex flex-col h-[100dvh] text-[#E0E0E0] font-sans selection:bg-white/20 select-none bg-neutral-900 bg-cover bg-center relative overflow-hidden"
      style={{ backgroundImage: 'url("https://drive.google.com/uc?id=1eSWuWAZ_3yyha63nMTM7J35NW3wPNTLU")' }}
    >
      {/* Dark Overlay to maintain readability */}
      <div className="absolute inset-0 bg-black/60 pointer-events-none" />

      {/* Login Modal Overlay */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm shadow-2xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-[350px] bg-black/80 p-6 rounded-xl border-2 border-[#00ffff] text-center shadow-[0_0_30px_rgba(0,255,255,0.3)] relative overflow-hidden font-rajdhani"
            >
              {/* Box Design matching provided code */}
              <div className="w-full h-[140px] overflow-hidden rounded-lg mb-4 border border-[#00ffff]/20">
                <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                  <source src="/animasi.mp4" type="video/mp4" />
                </video>
              </div>

              <h2 className="text-[#00ffff] text-[22px] font-black mb-4 tracking-[0.1em] uppercase">WELCOME BACK</h2>

              <div className="space-y-4 mb-5">
                <div className="w-full h-10 flex items-center border-2 border-[#00ffff] rounded-lg px-3 bg-transparent gap-3 focus-within:shadow-[0_0_10px_rgba(0,255,255,0.1)] transition-all">
                  <User size={18} className="text-[#00ffff] shrink-0" />
                  <input 
                    type="text" 
                    placeholder="User" 
                    value={loginForm.user}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, user: e.target.value }))}
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm font-medium placeholder:text-[#00ffff]/30"
                  />
                </div>

                <div className="w-full h-10 flex items-center border-2 border-[#00ffff] rounded-lg px-3 bg-transparent gap-3 focus-within:shadow-[0_0_10px_rgba(0,255,255,0.1)] transition-all">
                  <Lock size={18} className="text-[#00ffff] shrink-0" />
                  <input 
                    type="password" 
                    placeholder="Pass" 
                    value={loginForm.pass}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, pass: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm font-medium placeholder:text-[#00ffff]/30"
                  />
                </div>
              </div>

              <input 
                type="button" 
                value="Masuk" 
                onClick={handleLogin}
                className="w-full h-10 bg-[#00ffff] text-black font-bold rounded-lg cursor-pointer hover:bg-[#00ffff]/90 transition-all uppercase tracking-[0.1em] text-sm mb-4 shadow-[0_0_15px_rgba(0,255,255,0.2)] active:scale-[0.98]"
              />

              <div className="relative mb-4 flex items-center justify-center">
                <div className="border-t border-[#00ffff]/20 w-full absolute"></div>
                <span className="bg-black/80 px-3 text-[10px] text-white/40 uppercase tracking-widest relative z-10 font-bold">atau</span>
              </div>

              <button 
                onClick={handleGoogleLogin}
                className="w-full h-10 bg-white/5 border border-white/10 text-white font-bold rounded-lg cursor-pointer hover:bg-white/10 transition-all uppercase tracking-[0.1em] text-[12px] mb-4 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Masuk dengan Google
              </button>

              <div className="flex justify-between items-center px-1">
                <a href="#" className="text-white text-[12px] hover:text-[#00ffff] transition-colors">Forget Password</a>
                <a href="#" className="text-white text-[12px] hover:text-[#00ffff] transition-colors">Sign up</a>
              </div>

              {isLoggedIn && (
                <button 
                  onClick={() => setShowLoginModal(false)}
                  className="mt-6 text-[10px] uppercase font-bold tracking-widest text-white/30 hover:text-white transition-colors"
                >
                  Tutup
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Management Modal */}
      <AnimatePresence>
        {showApiModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-[#0A0A0A] border-2 border-[#00ffff]/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.1)] flex flex-col font-rajdhani"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[#00ffff]/5 to-transparent">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-widest uppercase">Manajemen API</h2>
                  <p className="text-xs text-[#00ffff]/60 font-bold uppercase tracking-wider">Terapkan aplikasi cerdas dengan Noir API</p>
                </div>
                <button 
                  onClick={() => setShowApiModal(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 max-h-[70vh]">
                {/* Credit Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between min-h-[100px]">
                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-[#00ffff]/60">Total Kredit API</span>
                    <div className="flex items-end justify-between">
                      <span className="text-4xl font-black text-white font-mono">${credits.toFixed(2)} <span className="text-sm text-white/40">USD</span></span>
                      <span className="text-[10px] bg-[#00ffff]/10 text-[#00ffff] px-2 py-1 rounded font-bold uppercase">Aktif</span>
                    </div>
                  </div>
                  <div className="p-5 rounded-xl bg-white/5 border border-white/10 border-dashed flex flex-col justify-center items-center text-center cursor-pointer hover:bg-white/10 transition-colors">
                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 mb-1">Peringkat Saldo Rendah</span>
                    <p className="text-xs text-white/60">Isi ulang otomatis saat ini dinonaktifkan.</p>
                  </div>
                </div>

                {/* Create Key */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-white/80 uppercase tracking-widest flex items-center gap-2">
                    <Plus size={16} className="text-[#00ffff]" />
                    Buat Kunci Baru
                  </h3>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="Masukkan nama Kunci API (contoh: App Produksi)" 
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00ffff]/50 transition-colors"
                    />
                    <button 
                      onClick={generateApiKey}
                      className="bg-[#00ffff] text-black font-black px-6 rounded-xl text-xs uppercase tracking-widest hover:bg-[#00ffff]/90 transition-all active:scale-95 shadow-[0_0_15px_rgba(0,255,255,0.3)]"
                    >
                      Bikin
                    </button>
                  </div>
                </div>

                {/* Key List */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-white/80 uppercase tracking-widest">Kunci Aktif</h3>
                  {apiKeys.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl">
                      <p className="text-white/30 text-sm">Belum ada Kunci API yang dibuat.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {apiKeys.map((key) => (
                        <div key={key.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between group hover:border-[#00ffff]/30 transition-all">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{key.name}</span>
                              <span className="text-[9px] text-[#00ffff] bg-[#00ffff]/10 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Live</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-[10px] text-white/40 font-mono tracking-wider break-all">{key.key}</code>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(key.key);
                                  alert("Kunci berhasil disalin!");
                                }}
                                className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white transition-colors"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2 shrink-0 ml-4">
                            <span className="text-[10px] text-white/30 uppercase font-bold">{key.createdAt}</span>
                            <button 
                              onClick={() => deleteApiKey(key.id)}
                              className="text-[10px] text-red-500/50 hover:text-red-500 font-black uppercase tracking-widest transition-colors opacity-0 group-hover:opacity-100"
                            >
                              Cabut Kunci
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Info */}
              <div className="p-4 bg-white/5 border-t border-white/10 text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-[0.1em]">Data penggunaan dapat tertunda hingga 5 menit. Syarat Pemakaian Noir API Berlaku.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Overlay layer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              drag="x"
              dragConstraints={{ left: -300, right: 0 }}
              dragElastic={0.05}
              onDragEnd={(e, info) => {
                if (info.offset.x < -80 || info.velocity.x < -400) {
                  setIsMenuOpen(false);
                }
              }}
              className="absolute top-0 left-0 bottom-0 z-50 w-72 bg-[#1A1A1A] border-r border-white/10 flex flex-col shadow-2xl"
            >
              {/* Sidebar Header */}
              <div className="p-5 flex items-center justify-between border-b border-white/5">
                <h2 className="text-sm font-bold tracking-widest text-[#00ff88] uppercase">History Chat</h2>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 p-3 space-y-2">
                <button 
                  onClick={startNewChat}
                  disabled={isLoading}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${isLoading ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed' : 'bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20 border-[#00ff88]/20'}`}
                >
                  <MessageSquarePlus size={18} />
                  <span className="text-sm font-bold tracking-wide">CHAT BARU</span>
                </button>
                
                <div className="pt-2">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-white/30 px-3 pb-2 pt-1">Recent</div>
                  {sessions.map(session => (
                    <button 
                      key={session.id}
                      onClick={() => switchChat(session.id)}
                      disabled={isLoading}
                      className={`w-full group flex items-center justify-between p-3 rounded-xl transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${activeSessionId === session.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/60 hover:text-white/90'}`}
                    >
                      <div className="flex items-center gap-3 truncate pr-2">
                        <MessageSquare size={16} className={activeSessionId === session.id ? 'text-[#00ff88]' : 'text-white/40'} />
                        <span className="text-[13px] truncate font-medium">{session.name}</span>
                      </div>
                      <div 
                        onClick={(e) => deleteChat(session.id, e)}
                        className={`p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors ${activeSessionId === session.id ? 'text-white/30' : 'opacity-0 group-hover:opacity-100 text-white/30'}`}
                      >
                        <Trash2 size={14} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-white/5 space-y-3 pb-8">
                {/* Credit Display */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 group">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-[#00ffff]" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-white/60">Kredit API</span>
                  </div>
                  <span className="text-sm font-black text-[#00ffff] font-mono">${credits.toFixed(2)}</span>
                </div>

                <button 
                  onClick={() => {
                    setShowApiModal(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors border border-dashed border-white/20 text-sm font-bold tracking-widest uppercase font-rajdhani text-white/70"
                >
                  <Key size={18} className="text-[#00ffff]" />
                  Manajemen API
                </button>

                {isLoggedIn ? (
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20 text-sm font-bold tracking-widest uppercase font-rajdhani"
                  >
                    <LogOut size={18} />
                    LOGOUT
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setShowLoginModal(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#00ffff]/10 text-[#00ffff] hover:bg-[#00ffff]/20 transition-colors border border-[#00ffff]/20 text-sm font-bold tracking-widest uppercase font-rajdhani shadow-[0_0_15px_rgba(0,255,255,0.1)]"
                  >
                    <LogIn size={18} />
                    LOGIN V2
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between border-b border-white/10 shrink-0 bg-black/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <Menu size={22} />
          </button>
          <Avatar role="model" customAvatar={customAvatar} onClick={() => avatarInputRef.current?.click()} />
          <h1 className="text-2xl font-black uppercase tracking-widest bg-gradient-to-br from-[#ff003c] via-[#ff4d79] to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,0,60,0.4)]" style={{ WebkitTextStroke: '0.5px rgba(255,0,60,0.5)' }}>NOIR AI</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88]" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#00ff88]">Online</span>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-4 py-8 scrollbar-hide z-10">
        <div className="max-w-3xl mx-auto space-y-8">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Message Content */}
              <div className={`flex flex-col min-w-0 flex-1 w-full max-w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`text-[15px] leading-relaxed min-w-0 max-w-full break-words
                  ${msg.role === 'user' 
                    ? 'bg-[#2A2A2A] text-white px-5 py-3.5 rounded-[24px] rounded-br-sm shadow-sm inline-block max-w-[85%]' 
                    : 'bg-transparent text-white/90 py-1 w-full overflow-hidden'}`}
                >
                  {msg.image && (
                    <div className="mb-3 relative rounded-xl overflow-hidden border border-white/10 pointer-events-none">
                      <img src={msg.image} alt="User upload" className="max-w-xs w-full h-auto" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="markdown-body w-full max-w-full min-w-0 overflow-hidden break-words">
                    <Markdown
                      components={{
                        p: ({ children }) => <span className="block mb-2 last:mb-0 leading-relaxed">{children}</span>,
                        code(props) {
                          const { children, className, node, ...rest } = props;
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          const isBlock = match || codeString.includes('\n');

                          return isBlock ? (
                            <CodeBlock language={match ? match[1] : 'text'} value={codeString} />
                          ) : (
                            <code {...rest} className="bg-black/30 rounded px-1.5 py-0.5 text-[#00ff88] text-[12px] break-all">
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {msg.text}
                    </Markdown>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 flex-row"
            >
              <div className="flex flex-col flex-1 items-start justify-center">
                <div className="text-[15px] bg-transparent text-white/50 flex items-center h-full py-1">
                  <div className="flex space-x-1.5 items-center">
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 bg-current rounded-full" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 bg-current rounded-full" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 bg-current rounded-full" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-black/40 backdrop-blur-md border-t border-white/5 shrink-0 z-10">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          
          {/* Image Preview inside input area */}
          <AnimatePresence>
            {selectedImage && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex"
              >
                <div className="relative group p-1 bg-[#2A2A2A] rounded-xl border border-white/10">
                  <img src={selectedImage} className="w-16 h-16 object-cover rounded-lg" />
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 p-1 bg-black rounded-full border border-white/20 text-white hover:bg-neutral-800 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-2.5 relative">
            {/* Unified Attachment Button */}
            <div className="pb-1 relative">
              <button 
                onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                className={`p-3 rounded-full transition-all duration-300 shadow-lg shrink-0
                  ${isAttachmentMenuOpen ? 'bg-white text-black rotate-45' : 'bg-white/10 text-white/70 hover:bg-white/20 tracking-widest'}`}
              >
                <Plus size={22} strokeWidth={2.5} />
              </button>

              {/* Attachment Popup Menu */}
              <AnimatePresence>
                {isAttachmentMenuOpen && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsAttachmentMenuOpen(false)}
                      className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-16 left-0 z-50 min-w-[180px] bg-[#1A1A1A] border border-white/10 rounded-2xl p-2 shadow-2xl flex flex-col gap-1 overflow-hidden"
                    >
                      <button 
                        onClick={() => {
                          setIsAttachmentMenuOpen(false);
                          setIsCameraOpen(true);
                        }}
                        className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors text-sm font-medium"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/50 group-hover:text-white">
                          <Camera size={18} />
                        </div>
                        Ambil Foto
                      </button>
                      <button 
                        onClick={() => {
                          setIsAttachmentMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors text-sm font-medium"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/50 group-hover:text-white">
                          <ImageIcon size={18} />
                        </div>
                        Pilih Galeri
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Standard AI Input Box */}
            <div className="flex-1 flex items-center gap-1.5 bg-[#1E1E1E] border border-white/5 rounded-[28px] p-1 focus-within:border-white/20 focus-within:bg-[#252525] transition-all shadow-sm mb-1">
              {/* Main Input */}
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Tanya Noir AI..."
                className="flex-1 bg-transparent border-0 ring-0 outline-none hover:ring-0 focus:ring-0 focus:outline-none text-[15px] py-2 px-4 resize-none max-h-32 min-h-[40px] flex items-center scrollbar-hide text-white placeholder:text-white/30 select-text"
              />

              {/* Send Button */}
              <div className="pr-1">
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className={`w-9 h-9 rounded-full transition-all flex items-center justify-center shrink-0
                    ${(!input.trim() && !selectedImage) || isLoading 
                      ? 'bg-transparent text-white/20' 
                      : 'bg-white text-black hover:bg-neutral-200 shadow-[0_0_10px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95'}`}
                >
                  <Send size={15} strokeWidth={2.5} className={(!input.trim() && !selectedImage) || isLoading ? '' : 'ml-0.5'} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="text-center text-[10px] text-neutral-600">
            Noir dapat membuat kesalahan. Harap periksa info penting.
          </div>
        </div>
      </footer>

      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />

      {/* Camera Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <CameraOverlay isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={onCameraCapture} />
        )}
      </AnimatePresence>
    </div>
  );
}


