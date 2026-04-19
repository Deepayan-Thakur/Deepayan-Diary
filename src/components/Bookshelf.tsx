import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { Book } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Book as BookIcon, Loader2, FolderHeart } from 'lucide-react';
import { useSound } from '../hooks/useSound';

interface Props {
  onSelectBook: (book: Book) => void;
}

const CATEGORIES = ['Travel', 'Personal', 'Family', 'Work', 'Ideas', 'Uncategorized'];

export const Bookshelf: React.FC<Props> = ({ onSelectBook }) => {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const { playSound } = useSound();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'books'),
      where('userId', '==', user.uid)
    );

    return onSnapshot(q, (snapshot) => {
      const bList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Book));
      bList.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setBooks(bList);
      setLoading(false);
    });
  }, [user]);

  const handleCreateBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const coverColor = formData.get('color') as string;
    const category = formData.get('category') as string;

    if (!title || !user) return;

    await addDoc(collection(db, 'books'), {
      title,
      coverColor,
      category: category || 'Uncategorized',
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    setShowAddModal(false);
    playSound('click');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin opacity-20" size={32} />
      </div>
    );
  }

  // Group books by category
  const booksByCategory = CATEGORIES.reduce((acc, cat) => {
    const matched = books.filter(b => (b.category || 'Uncategorized') === cat);
    if (matched.length > 0) acc[cat] = matched;
    return acc;
  }, {} as Record<string, Book[]>);

  const activeCategories = Object.keys(booksByCategory);

  return (
    <div className="max-w-6xl mx-auto px-6">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl font-serif mb-2">My Library</h2>
          <p className="text-sm opacity-50 uppercase tracking-widest">Organized collections</p>
        </div>
        <button 
          onMouseEnter={() => playSound('hover')}
          onClick={() => { setShowAddModal(true); playSound('click'); }}
          className="p-4 bg-white dark:bg-[#1a1a1a] border border-[#ece6da] dark:border-[#333] rounded-full hover:shadow-lg dark:hover:shadow-white/5 transition-all text-[#4a3f35] dark:text-[#ececece]"
        >
          <Plus size={24} />
        </button>
      </div>

      {books.length === 0 ? (
        <div className="py-32 border-2 border-dashed border-[#ece6da] dark:border-[#333] rounded-3xl text-center">
          <BookIcon className="mx-auto mb-4 opacity-10" size={64} />
          <p className="opacity-40 italic font-serif text-lg">Your shelf is waiting...</p>
          <button 
            onClick={() => setShowAddModal(true)}
            onMouseEnter={() => playSound('hover')}
            className="mt-6 text-sm underline underline-offset-4 font-medium"
          >
            Create your first memory book
          </button>
        </div>
      ) : (
        <div className="space-y-24">
          {activeCategories.map((category) => (
            <div key={category} className="relative">
              <div className="flex items-center gap-3 mb-8 opacity-60">
                <FolderHeart size={18} />
                <h3 className="font-serif text-xl tracking-wide">{category}</h3>
              </div>

              {/* Responsive Shelf: 4 books on Desktop, 2 on Mobile */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-16">
                <AnimatePresence>
                  {booksByCategory[category].map((book, idx) => (
                    <motion.div
                      key={book.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                      onMouseEnter={() => playSound('hover')}
                      onClick={() => {
                        playSound('open');
                        onSelectBook(book);
                      }}
                      className="cursor-pointer group flex flex-col items-center"
                    >
                      {/* Book Spine/Cover Representation (Theme-safe colors) */}
                      <div 
                        className="relative w-36 sm:w-40 h-52 sm:h-56 shadow-2xl rounded-r-md transition-all group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex overflow-hidden border border-black/10 dark:border-white/10"
                        style={{ backgroundColor: book.coverColor || '#8B4513' }}
                      >
                        {/* Spine effect */}
                        <div className="absolute left-0 top-0 bottom-0 w-4 bg-black/20 dark:bg-black/40 border-r border-white/20" />
                        
                        {/* Golden lines / Decor */}
                        <div className="mt-auto mb-8 mx-auto w-12 h-0.5 bg-white/40" />
                        
                        <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
                          <span 
                            className="text-white font-serif text-base sm:text-lg leading-tight select-none opacity-90 group-hover:opacity-100 transition-opacity drop-shadow-md"
                          >
                            {book.title}
                          </span>
                        </div>
                      </div>
                      
                      <h4 className="mt-6 font-serif text-center opacity-60 group-hover:opacity-100 transition-opacity px-2 line-clamp-2">
                        {book.title}
                      </h4>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Modern Shelf Line Base */}
              <div className="mt-12 h-4 w-full bg-[#e8e0d0] dark:bg-[#1a1a1a] rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_2px_10px_rgba(255,255,255,0.03)] border border-black/5 dark:border-white/5" />
            </div>
          ))}
        </div>
      )}

      {/* Add Book Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-[#1a1a1a] p-10 rounded-3xl shadow-2xl w-full max-w-md border border-[#ece6da] dark:border-[#333]"
            >
              <h3 className="text-2xl font-serif mb-8 dark:text-white">New Collection</h3>
              <form onSubmit={handleCreateBook} className="space-y-6">
                <div>
                  <label className="block text-xs uppercase tracking-widest opacity-50 mb-2 dark:text-white">Book Title</label>
                  <input 
                    name="title" 
                    autoFocus
                    placeholder="E.g., Summer in Paris"
                    className="w-full bg-[#fdfaf6] dark:bg-[#222] border-b border-[#ece6da] dark:border-[#444] py-3 px-2 text-lg focus:outline-none focus:border-[#4a3f35] dark:focus:border-[#888] transition-colors font-serif dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs uppercase tracking-widest opacity-50 mb-2 dark:text-white">Category</label>
                  <select 
                    name="category"
                    className="w-full bg-[#fdfaf6] dark:bg-[#222] border-b border-[#ece6da] dark:border-[#444] py-3 px-2 text-base focus:outline-none focus:border-[#4a3f35] dark:focus:border-[#888] transition-colors font-sans dark:text-white"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest opacity-50 mb-2 dark:text-white">Cover Color</label>
                  <div className="flex gap-3 mt-4 flex-wrap">
                    {/* Rich colors that look good in both light and dark backgrounds */}
                    {['#3A3025', '#2c3e50', '#8b4513', '#1e3328', '#6F2B3F', '#2e4a47', '#455A64', '#D4AF37'].map(color => (
                      <label key={color} className="relative cursor-pointer group">
                        <input type="radio" name="color" value={color} className="sr-only" defaultChecked={color === '#3A3025'} />
                        <div 
                          className="w-8 h-8 rounded-full border-2 border-black/10 dark:border-white/10 transition-all group-hover:scale-110"
                          style={{ backgroundColor: color }}
                          onMouseEnter={() => playSound('hover')}
                        />
                        <div className="absolute inset-0 border-2 border-[#4a3f35] dark:border-white scale-125 rounded-full peer-checked:opacity-100 opacity-0 transition-opacity" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-6">
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-2 text-sm opacity-50 hover:opacity-100 dark:text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    onMouseEnter={() => playSound('hover')}
                    onClick={() => playSound('click')}
                    className="px-8 py-2 bg-[#4a3f35] dark:bg-[#e0e0e0] text-white dark:text-[#121212] rounded-full text-sm font-medium hover:bg-[#5d4e41] dark:hover:bg-white transition-all"
                  >
                    Place on shelf
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
