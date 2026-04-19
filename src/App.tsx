/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import { Bookshelf } from './components/Bookshelf';
import { DiaryLayout } from './components/DiaryLayout';
import { Book } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Volume2, VolumeX, Moon, Sun, Trash2 } from 'lucide-react';

const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });
const AudioContext = createContext<{ isMuted: boolean; toggleMute: () => void }>({ isMuted: false, toggleMute: () => {} });

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(u === null && loading ? false : false);
    });
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleMute = () => setIsMuted(prev => !prev);
  const toggleTheme = () => setIsDark(prev => !prev);

  const handleWipeData = async () => {
    if (!user) return;
    const confirm = window.confirm("Are you incredibly sure? This will PERMANENTLY BURN all your books and memories to ashes. You cannot undo this.");
    if (!confirm) return;
    
    setIsWiping(true);
    try {
      const bq = query(collection(db, 'books'), where('userId', '==', user.uid));
      const snaps = await getDocs(bq);
      for (const b of snaps.docs) {
         const pq = query(collection(db, 'books', b.id, 'pages'), where('userId', '==', user.uid));
         const psnaps = await getDocs(pq);
         for (const p of psnaps.docs) {
           await deleteDoc(doc(db, 'books', b.id, 'pages', p.id));
         }
         await deleteDoc(doc(db, 'books', b.id));
      }
      setSelectedBook(null);
      alert("All memories have been reduced to ashes. You have a fresh library.");
    } catch (err) {
      console.error(err);
      alert("Something went wrong trying to burn the collection.");
    }
    setIsWiping(false);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#fdfaf6] dark:bg-[#121212] transition-colors duration-500">
        <div className="animate-pulse text-[#b6a690] dark:text-[#888] font-serif italic text-xl">Entering the library...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <AudioContext.Provider value={{ isMuted, toggleMute }}>
        <div className="min-h-screen bg-[#fdfaf6] text-[#4a3f35] dark:bg-[#121212] dark:text-[#e0e0e0] transition-colors duration-500 selection:bg-[#e0d5c1] dark:selection:bg-[#333] selection:text-[#4a3f35] dark:selection:text-[#fff]">
          <header className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-[#fdfaf6] to-transparent dark:from-[#121212]">
            <h1 
              className="text-2xl font-serif tracking-tight cursor-pointer" 
              onClick={() => setSelectedBook(null)}
            >
              Memory Keeper
            </h1>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleTheme}
                className="p-2 hover:bg-[#ece6da] dark:hover:bg-[#2a2a2a] rounded-full transition-colors"
                title={isDark ? "Light Mode" : "Dark Mode"}
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button 
                onClick={toggleMute}
                className="p-2 hover:bg-[#ece6da] dark:hover:bg-[#2a2a2a] rounded-full transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              {user ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm opacity-60 hidden sm:inline">{user.displayName}</span>
                  <button 
                    onClick={handleWipeData}
                    disabled={isWiping}
                    title="Burn Everything"
                    className="flex items-center justify-center p-2 text-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button 
                    onClick={logout}
                    className="flex items-center gap-2 text-sm px-4 py-2 hover:bg-[#ece6da] dark:hover:bg-[#2a2a2a] rounded-full transition-colors"
                  >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">Exit</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={loginWithGoogle}
                  className="flex items-center gap-2 text-sm px-6 py-2 bg-[#4a3f35] text-[#fdfaf6] dark:bg-[#e0e0e0] dark:text-[#121212] hover:bg-[#5d4e41] dark:hover:bg-[#ffffff] rounded-full transition-all shadow-sm"
                >
                  <LogIn size={16} />
                  <span>Enter</span>
                </button>
              )}
            </div>
          </header>

          <main className="pt-24 pb-12 min-h-[calc(100vh-6rem)]">
            <AnimatePresence mode="wait">
              {!user ? (
                <motion.div 
                  key="landing"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-xl mx-auto text-center mt-32 px-6"
                >
                  <h2 className="text-5xl font-serif mb-6 leading-tight">Every memory is a story worth keeping.</h2>
                  <p className="text-lg opacity-70 mb-10 leading-relaxed font-light">
                    A digital sanctuary for your moments, thoughts, and photographs. 
                    Organized neatly on your personal bookshelf.
                  </p>
                  <button 
                    onClick={loginWithGoogle}
                    className="px-10 py-4 bg-[#4a3f35] text-[#fdfaf6] dark:bg-[#e0e0e0] dark:text-[#121212] text-lg rounded-full hover:shadow-xl hover:-translate-y-1 transition-all"
                  >
                    Begin your diary
                  </button>
                </motion.div>
              ) : selectedBook ? (
                <DiaryLayout 
                  key="diary"
                  book={selectedBook} 
                  onBack={() => setSelectedBook(null)} 
                />
              ) : (
                <Bookshelf 
                  key="bookshelf"
                  onSelectBook={setSelectedBook} 
                />
              )}
            </AnimatePresence>
          </main>
        </div>
      </AudioContext.Provider>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const useAudio = () => useContext(AudioContext);
