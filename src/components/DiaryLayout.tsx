import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../App';
import { Book, Page, ContentBlock } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, Trash2, ArrowLeft, Type, ImageIcon, Layers, Save, Loader2, Upload, List, BookOpen, Edit2 } from 'lucide-react';
import { useSound } from '../hooks/useSound';
import { ImageBundle } from './ImageBundle';

interface Props {
  book: Book;
  onBack: () => void;
}

export const DiaryLayout: React.FC<Props> = ({ book, onBack }) => {
  const { user } = useAuth();
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0); // Tracks spread/page index
  const [isEditing, setIsEditing] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [editChapterDetails, setEditChapterDetails] = useState('');
  const [newContent, setNewContent] = useState<ContentBlock[]>([]);
  const [uploading, setUploading] = useState(false);
  const { playSound } = useSound();
  const containerRef = useRef<HTMLDivElement>(null);

  const [turnDirection, setTurnDirection] = useState(1);
  const touchStartX = useRef<number | null>(null);

  const [isTwoPageLayout, setIsTwoPageLayout] = useState(true);
  const [charsPerPage, setCharsPerPage] = useState(1200);
  const [showChapters, setShowChapters] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      // Desktop gets Two-Page Spread. Mobile & Tablet get single page
      if (window.innerWidth >= 1024) {
        setIsTwoPageLayout(true);
        setCharsPerPage(1800); // Massive capacity for dual A4
      } else {
        setIsTwoPageLayout(false);
        if (window.innerWidth < 640) setCharsPerPage(750); 
        else setCharsPerPage(1100);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'books', book.id, 'pages'),
      where('userId', '==', user.uid)
    );

    return onSnapshot(q, (snapshot) => {
      const pList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Page));
      pList.sort((a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));
      setPages(pList);
    });
  }, [book.id, user]);

  const virtualPages = React.useMemo(() => {
    if (!pages || pages.length === 0) return [];
    const vPages: any[] = [];

    pages.forEach((page, pIdx) => {
      // Inject standard Chapter Cover Virtual Page first
      vPages.push({
        id: `${page.id}-chapter-intro`,
        sourcePageId: page.id,
        timestamp: page.timestamp,
        isChapterCover: true,
        chapterTitle: page.chapterTitle || `Chapter ${pIdx + 1}`,
        chapterDetails: page.chapterDetails || '',
        content: []
      });

      let currentVPage = { id: `${page.id}-0`, sourcePageId: page.id, timestamp: page.timestamp, content: [] as any[] };
      let capacity = 0;

      const advance = () => {
        if (currentVPage.content.length > 0) vPages.push(currentVPage);
        currentVPage = { id: `${page.id}-${vPages.length + 1}`, sourcePageId: page.id, timestamp: page.timestamp, content: [] };
        capacity = 0;
      };

      page.content.forEach((block: any) => {
        if (block.type === 'image') {
          if (capacity > 0.4) advance();
          currentVPage.content.push(block);
          capacity += 0.6;
        } else if (block.type === 'bundle') {
          if (capacity > 0.5) advance();
          currentVPage.content.push(block);
          capacity += 0.5;
        } else if (block.type === 'text') {
          let text = block.value as string || '';
          while (text.length > 0) {
            const charsLeft = (1 - capacity) * charsPerPage;
            
            if (charsLeft < 50 && text.length > 50) {
              advance();
              continue;
            }

            if (text.length <= charsLeft) {
              currentVPage.content.push({ ...block, id: `${block.id}-${vPages.length}`, value: text });
              capacity += text.length / charsPerPage;
              break;
            } else {
              let splitIndex = Math.floor(charsLeft);
              const lookback = text.substring(Math.floor(splitIndex * 0.7), splitIndex);
              const nl = lookback.lastIndexOf('\n');
              const sp = lookback.lastIndexOf(' ');
              
              if (nl !== -1) splitIndex = Math.floor(splitIndex * 0.7) + nl + 1;
              else if (sp !== -1) splitIndex = Math.floor(splitIndex * 0.7) + sp;

              if (splitIndex <= 0) splitIndex = charsLeft;

              const chunk = text.substring(0, splitIndex);
              text = text.substring(splitIndex).trimStart();
              
              currentVPage.content.push({ ...block, id: `${block.id}-${vPages.length}`, value: chunk });
              advance();
            }
          }
        }
      });
      if (currentVPage.content.length > 0) vPages.push(currentVPage);
    });
    return vPages;
  }, [pages, charsPerPage]);

  const totalSpreads = isTwoPageLayout ? Math.ceil((virtualPages.length + 1) / 2) : Math.max(1, virtualPages.length + 1);
  const safeSpreadIdx = Math.min(currentPageIdx, Math.max(0, totalSpreads - 1));

  let leftPage: any = null;
  let rightPage: any = null;

  if (isEditing) {
    if (isTwoPageLayout) {
      leftPage = virtualPages.length > 0 ? virtualPages[virtualPages.length - 1] : null;
      rightPage = 'editing';
    } else {
      leftPage = null;
      rightPage = 'editing';
    }
  } else {
    if (isTwoPageLayout) {
      leftPage = safeSpreadIdx === 0 ? null : virtualPages[safeSpreadIdx * 2 - 1];
      rightPage = virtualPages[safeSpreadIdx * 2];
    } else {
      leftPage = null;
      rightPage = safeSpreadIdx === 0 ? 'cover' : (virtualPages.length > 0 ? virtualPages[safeSpreadIdx - 1] : null);
    }
  }

  const chapters = React.useMemo(() => {
    return pages.map((p, index) => {
      let targetIndex = virtualPages.findIndex(vp => vp.sourcePageId === p.id);
      if (targetIndex === -1) targetIndex = 0;
      const jumpIdx = isTwoPageLayout ? Math.ceil((targetIndex + 1) / 2) : targetIndex + 1;
      return {
        id: p.id,
        title: p.chapterTitle || `Chapter ${index + 1}`,
        date: p.timestamp ? new Date(p.timestamp.seconds * 1000).toLocaleDateString() : 'New',
        spreadIdx: jumpIdx
      };
    });
  }, [pages, virtualPages, isTwoPageLayout]);

  useEffect(() => {
    if (!isEditing && currentPageIdx > safeSpreadIdx) {
      setCurrentPageIdx(safeSpreadIdx);
    }
  }, [virtualPages.length, isEditing, currentPageIdx, safeSpreadIdx]);

  const handleNextPage = () => {
    if (safeSpreadIdx < totalSpreads - 1) {
      setTurnDirection(1);
      playSound('flip');
      setCurrentPageIdx(safeSpreadIdx + 1);
    }
  };

  const handlePrevPage = () => {
    if (safeSpreadIdx > 0) {
      setTurnDirection(-1);
      playSound('flip');
      setCurrentPageIdx(safeSpreadIdx - 1);
    }
  };

  const handleEditPage = (sourcePageId: string) => {
    const originalPage = pages.find(p => p.id === sourcePageId);
    if (!originalPage) return;
    
    setTurnDirection(1);
    setEditingPageId(sourcePageId);
    setIsEditing(true);
    setEditChapterTitle(originalPage.chapterTitle || '');
    setEditChapterDetails(originalPage.chapterDetails || '');
    setNewContent(originalPage.content);
    playSound('flip');
  };

  const startNewPage = () => {
    setTurnDirection(1);
    setIsEditing(true);
    setEditingPageId(null);
    setEditChapterTitle('');
    setEditChapterDetails('');
    setNewContent([{ id: Math.random().toString(), type: 'text', value: '' }]);
    playSound('flip');
  };

  const savePage = async () => {
    if (!user) return;
    
    const payload: any = {
      content: newContent.filter(c => {
         if (c.type === 'bundle') return (c.value as string[]).length > 0;
         return c.value !== '';
      }),
    };

    if (editChapterTitle.trim()) payload.chapterTitle = editChapterTitle.trim();
    if (editChapterDetails.trim()) payload.chapterDetails = editChapterDetails.trim();

    if (editingPageId) {
      await updateDoc(doc(db, 'books', book.id, 'pages', editingPageId), payload);
    } else {
      payload.bookId = book.id;
      payload.userId = user.uid;
      payload.pageNumber = pages.length + 1;
      payload.timestamp = serverTimestamp();
      await addDoc(collection(db, 'books', book.id, 'pages'), payload);
    }
    
    setTurnDirection(1);
    setIsEditing(false);
    setEditingPageId(null);
    setCurrentPageIdx(99999);
    playSound('flip');
  };

  const addBlock = (type: 'text' | 'image' | 'bundle') => {
    playSound('click');
    const defaultVal = type === 'bundle' ? [] : '';
    setNewContent([...newContent, { id: Math.random().toString(), type, value: defaultVal }]);
  };

  const updateBlock = (id: string, value: string | string[]) => {
    setNewContent(prev => prev.map(c => c.id === id ? { ...c, value } : c));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, blockId: string, isBundle: boolean = false) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(
        files.map(async (file: File) => {
          const storageRef = ref(storage, `images/${user.uid}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          return await getDownloadURL(storageRef);
        })
      );
      if (isBundle) {
        setNewContent(prev => prev.map(c => {
          if (c.id === blockId) {
            const currentArray = (c.value as string[]) || [];
            return { ...c, value: [...currentArray, ...uploadedUrls] };
          }
          return c;
        }));
      } else {
        updateBlock(blockId, uploadedUrls[0]);
      }
    } catch (error) {
      console.error(error);
      alert("Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const pageVariants = {
    initial: (direction: number) => ({
      originX: direction > 0 ? 1 : 0, 
      rotateY: direction > 0 ? 120 : -120,
      filter: "brightness(0.6) drop-shadow(0px 30px 40px rgba(0,0,0,0.5))",
      opacity: 0,
      scale: 0.96,
      z: direction > 0 ? 150 : -150,
      rotateZ: direction > 0 ? 4 : -4,
      skewY: direction > 0 ? -6 : 6,
    }),
    in: {
      originX: 0.5,
      rotateY: 0,
      filter: "brightness(1) drop-shadow(0px 5px 15px rgba(0,0,0,0.05))",
      opacity: 1,
      scale: 1,
      z: 0,
      rotateZ: 0,
      skewY: 0,
      transition: { type: 'spring', damping: 22, stiffness: 70, mass: 0.9, restDelta: 0.001 }
    },
    out: (direction: number) => ({
      originX: direction > 0 ? 0 : 1,
      rotateY: direction > 0 ? -120 : 120,
      filter: "brightness(0.6) drop-shadow(0px 30px 40px rgba(0,0,0,0.5))",
      opacity: 0,
      scale: 0.96,
      z: direction > 0 ? -150 : 150,
      rotateZ: direction > 0 ? -4 : 4,
      skewY: direction > 0 ? 6 : -6,
      transition: { type: 'spring', damping: 22, stiffness: 70, mass: 0.9, restDelta: 0.001 }
    })
  };

  const renderPageContent = (page: any, side: 'left' | 'right' | 'single') => {
    if (page === 'cover') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
           <BookOpen size={48} className="mb-6 opacity-20 dark:text-white" />
           <h1 className="text-3xl sm:text-5xl font-serif font-bold dark:text-white mb-4 tracking-tight">{book.title}</h1>
           <p className="text-xs uppercase tracking-widest opacity-50 dark:text-gray-400">Front Cover</p>
        </div>
      );
    }
    
    if (!page) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 italic font-serif">
          <BookOpen strokeWidth={1} size={48} className="mb-4" />
          <p className="text-xl sm:text-2xl dark:text-white">A blank page</p>
        </div>
      );
    }

    if (page.isChapterCover) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative group/cover">
           <p className="text-xs sm:text-sm font-sans uppercase tracking-[0.3em] opacity-40 dark:text-gray-400 mb-8 border-b border-black/10 dark:border-white/10 pb-4 w-1/3 mx-auto">Chapter Intro</p>
           <h2 className="text-3xl sm:text-4xl font-serif font-bold dark:text-white mb-6 leading-tight max-w-[90%]">{page.chapterTitle}</h2>
           {page.chapterDetails && (
             <p className="text-sm sm:text-base font-serif italic opacity-70 dark:text-gray-300 max-w-[80%] mx-auto leading-relaxed">{page.chapterDetails}</p>
           )}
           <div className="absolute bottom-12 text-[10px] sm:text-xs opacity-30 font-serif uppercase tracking-widest dark:text-white">
             {new Date(page.timestamp?.seconds * 1000 || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
           </div>
           
           {!isEditing && (
             <button 
               onClick={(e) => { e.stopPropagation(); handleEditPage(page.sourcePageId); }}
               className="absolute top-4 right-4 p-2 opacity-0 group-hover/cover:opacity-50 hover:!opacity-100 transition-opacity dark:text-white pointer-events-auto z-[60]"
             >
               <Edit2 size={16} />
             </button>
           )}
        </div>
      );
    }

    return (
      <div className={`flex-1 flex flex-col justify-start overflow-hidden relative z-50 w-full ${isTwoPageLayout ? 'max-w-[600px]' : 'max-w-[800px]'} mx-auto group/page pr-2`}>
        {!isEditing && (
           <button 
             onClick={(e) => { e.stopPropagation(); handleEditPage(page.sourcePageId); }}
             className="absolute top-2 right-0 p-2 opacity-0 group-hover/page:opacity-50 hover:!opacity-100 transition-opacity dark:text-white pointer-events-auto z-[60]"
           >
             <Edit2 size={16} />
           </button>
        )}
        <div className="flex-1 overflow-y-auto pointer-events-auto book-scroll hide-scrollbar mt-4 pt-10">
          {page.content.map((block: any, idx: number) => (
          <div key={idx} className="mb-4 sm:mb-6 flex-shrink-0 break-words w-full">
            {block.type === 'text' && (
              <p className="text-base sm:text-[17px] font-serif leading-relaxed opacity-[0.85] dark:text-[#E0E0E0] whitespace-pre-wrap">
                {block.value}
              </p>
            )}
            {block.type === 'image' && (
              <div className="flex justify-center my-4 sm:my-6 relative max-h-[40vh]">
                <DecoratedImage url={block.value as string} playSound={playSound} />
              </div>
            )}
            {block.type === 'bundle' && (
              <div className="my-4 sm:my-6 flex justify-center scale-75 origin-top sm:scale-100">
                 <ImageBundle urls={block.value as string[]} playSound={playSound} />
              </div>
            )}
          </div>
        ))}
        </div>

        <div className="mt-auto pt-6 border-t border-black/5 dark:border-white/5 text-[10px] sm:text-xs opacity-40 font-serif flex justify-between items-center z-10 dark:text-white mt-12 pointer-events-none">
          {side === 'right' || side === 'single' ? (
             <>
               <span className="tracking-widest invisible sm:visible">MK</span>
               <span className="mx-auto sm:mx-0 uppercase tracking-widest">
                 {new Date(page.timestamp?.seconds * 1000 || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
               </span>
             </>
          ) : (
             <>
               <span className="mx-auto sm:mx-0 uppercase tracking-widest">
                 {new Date(page.timestamp?.seconds * 1000 || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
               </span>
               <span className="tracking-widest invisible sm:visible">MK</span>
             </>
          )}
        </div>
      </div>
    );
  };

  const renderEditor = () => (
    <div className="flex-1 flex flex-col items-center overflow-y-auto book-scroll pb-16 z-50 px-2 pointer-events-auto">
      <div className="w-full flex-shrink-0 mb-6 border-b border-black/5 dark:border-white/5 pb-6 mt-4">
        <input 
          type="text"
          placeholder="Chapter Intro Title (e.g. Chapter 1)"
          value={editChapterTitle}
          onChange={(e) => setEditChapterTitle(e.target.value)}
          className="w-full bg-transparent text-xl sm:text-2xl font-serif font-bold dark:text-white text-center outline-none placeholder:opacity-20 mb-2"
        />
        <textarea
          placeholder="Optional chapter details, location, or quote..."
          value={editChapterDetails}
          onChange={(e) => setEditChapterDetails(e.target.value)}
          className="w-full bg-transparent text-sm sm:text-base font-serif italic dark:text-gray-300 text-center outline-none placeholder:opacity-20 resize-none h-16"
        />
      </div>

      {newContent.map((block) => (
        <div key={block.id} className="group relative w-full flex-shrink-0 min-h-[100px] flex items-center justify-center">
          {block.type === 'text' && (
            <textarea 
              className="w-full h-full min-h-[200px] bg-transparent border border-transparent focus:border-[#ece6da] dark:focus:border-[#333] focus:ring-0 text-base sm:text-xl font-serif leading-relaxed resize-none placeholder:opacity-20 dark:text-[#EAEAEA] placeholder:dark:text-white/20 outline-none p-2 sm:p-4"
              placeholder="Pen your thoughts here..."
              value={block.value as string}
              onChange={(e) => updateBlock(block.id, e.target.value)}
              autoFocus
            />
          )}
          {block.type === 'image' && (
            <div className="text-center w-full py-4 my-4 bg-white/50 dark:bg-black/20 rounded-lg border border-dashed border-[#ece6da] dark:border-[#333] flex flex-col items-center justify-center">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#ece6da] dark:border-[#444] rounded-full text-xs font-sans uppercase tracking-widest hover:shadow-md transition-all dark:text-white">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <span>Upload Image</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id, false)} disabled={uploading} />
              </label>
              {block.value && typeof block.value === 'string' && (
                <div className="mt-4 flex justify-center max-h-[40vh] overflow-hidden">
                  <DecoratedImage url={block.value} playSound={playSound} />
                </div>
              )}
            </div>
          )}
          {block.type === 'bundle' && (
            <div className="text-center w-full py-4 my-4 bg-white/50 dark:bg-black/20 rounded-lg border border-dashed border-[#ece6da] dark:border-[#333] flex flex-col items-center justify-center">
               <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#ece6da] dark:border-[#444] rounded-full text-xs font-sans uppercase tracking-widest hover:shadow-md transition-all dark:text-white">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
                <span>Upload Collection</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, block.id, true)} disabled={uploading} />
              </label>
              {(block.value as string[]).length > 0 && (
                <div className="mt-2 text-xs font-mono uppercase opacity-50 dark:text-white">
                  { (block.value as string[]).length } memories packaged
                </div>
              )}
            </div>
          )}
          <button 
             onClick={() => setNewContent(prev => prev.filter(c => c.id !== block.id))}
             onMouseEnter={() => playSound('hover')}
             className="absolute right-0 sm:right-2 top-0 sm:top-2 p-2 text-red-400 hover:text-red-600 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-[#1a1a1a] rounded-full shadow-sm border border-red-100 dark:border-red-900 z-50"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="pt-8 mb-4 flex justify-center gap-4 sm:gap-8 w-full shrink-0">
        <button type="button" onClick={() => addBlock('text')} onMouseEnter={() => playSound('hover')} className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity dark:text-white">
          <div className="p-2 sm:p-3 bg-white dark:bg-[#222] rounded-full border border-black/10 dark:border-white/10 shadow-sm"><Type size={16} /></div>
        </button>
        <button type="button" onClick={() => addBlock('image')} onMouseEnter={() => playSound('hover')} className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity dark:text-white">
          <div className="p-2 sm:p-3 bg-white dark:bg-[#222] rounded-full border border-black/10 dark:border-white/10 shadow-sm"><ImageIcon size={16} /></div>
        </button>
        <button type="button" onClick={() => addBlock('bundle')} onMouseEnter={() => playSound('hover')} className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity dark:text-white">
          <div className="p-2 sm:p-3 bg-white dark:bg-[#222] rounded-full border border-black/10 dark:border-white/10 shadow-sm"><Layers size={16} /></div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full mx-auto px-2 sm:px-4 pb-24 overflow-hidden min-h-screen flex flex-col" ref={containerRef}>
      <div className="max-w-7xl mx-auto w-full mb-4 sm:mb-8 flex items-center justify-between z-10 px-4">
        <div className="w-32 flex items-center gap-4 relative">
          <button 
            onClick={() => { playSound('click'); onBack(); }}
            onMouseEnter={() => playSound('hover')}
            className="flex items-center gap-2 text-sm opacity-50 hover:opacity-100 transition-opacity dark:text-white"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          {!isEditing && virtualPages.length > 0 && (
            <div className="relative">
              <button 
                onClick={() => { playSound('click'); setShowChapters(!showChapters); }}
                onMouseEnter={() => playSound('hover')}
                className="flex items-center gap-2 text-sm opacity-50 hover:opacity-100 transition-opacity dark:text-white"
              >
                <List size={16} />
                <span className="hidden sm:inline">Index</span>
              </button>
              {showChapters && (
                <div className="absolute top-10 left-0 w-48 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md shadow-2xl rounded-xl py-2 border border-black/5 dark:border-white/5 z-[150] max-h-[50vh] overflow-y-auto">
                    {chapters.map((ch, i) => (
                      <button 
                        key={ch.id} 
                        onClick={() => {
                          playSound('flip');
                          setTurnDirection(ch.spreadIdx > safeSpreadIdx ? 1 : -1);
                          setCurrentPageIdx(ch.spreadIdx);
                          setShowChapters(false);
                        }}
                        onMouseEnter={() => playSound('hover')}
                        className="w-full text-left px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
                      >
                         <p className="font-serif text-sm dark:text-white font-medium">{ch.title}</p>
                         <p className="text-xs opacity-50 dark:text-gray-400 mt-1">{ch.date}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="text-center px-4">
          <h2 className="text-2xl sm:text-3xl font-serif dark:text-white truncate">{book.title}</h2>
          <p className="text-xs uppercase tracking-widest opacity-50 dark:text-gray-400 mt-1">
            {isTwoPageLayout ? `Spread ${safeSpreadIdx + 1} of ${isEditing ? '?' : Math.max(1, totalSpreads)}` : `Page ${safeSpreadIdx + 1} of ${isEditing ? '?' : Math.max(1, totalSpreads)}`}
          </p>
        </div>

        <div className="w-24 flex justify-end">
          {(!isEditing && pages.length === 0) || (!isEditing && user) ? (
            <button 
              onClick={startNewPage}
              onMouseEnter={() => playSound('hover')}
              className="p-3 bg-white dark:bg-[#1a1a1a] border border-[#ece6da] dark:border-[#333] hover:bg-[#fdfaf6] dark:hover:bg-[#222] rounded-full transition-all shadow-sm group relative z-50 text-black dark:text-white"
            >
              <Plus size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          ) : null}
        </div>
      </div>

      <div 
        className="flex-1 flex justify-center perspective-[3000px] items-center overflow-hidden w-full relative"
        onTouchStart={(e) => {
          if (isEditing) return;
          const touch = e.touches[0];
          touchStartX.current = touch.clientX;
        }}
        onTouchEnd={(e) => {
          if (isEditing || !touchStartX.current) return;
          const touch = e.changedTouches[0];
          const diffX = touch.clientX - touchStartX.current;
          if (diffX > 50) handlePrevPage();
          if (diffX < -50) handleNextPage();
          touchStartX.current = null;
        }}
      >
        <AnimatePresence mode="popLayout" custom={turnDirection}>
          <motion.div
            key={isEditing ? 'editing' : safeSpreadIdx}
            custom={turnDirection}
            variants={pageVariants}
            initial="initial"
            animate="in"
            exit="out"
            className={`flex mx-auto relative z-30 transform-gpu ${isTwoPageLayout ? 'w-full max-w-[1200px] aspect-[2/1.3] lg:aspect-[2/1.35]' : 'a4-page bg-[#fffff8] dark:bg-[#1e1e1e] shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl border border-black/5 dark:border-white/5 w-full max-w-4xl aspect-[1/1.4] sm:aspect-[1/1.414]'}`}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {isTwoPageLayout ? (
              <>
                <div className="flex-1 relative bg-[#fffff8] dark:bg-[#1e1e1e] rounded-l-2xl border-y border-l border-black/5 dark:border-white/5 flex flex-col p-6 sm:p-12 overflow-hidden shadow-[inset_-20px_0_40px_rgba(0,0,0,0.06),0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[inset_-20px_0_40px_rgba(0,0,0,0.4),0_20px_50px_rgba(0,0,0,0.3)]">
                  <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/20 dark:from-black/60 via-transparent to-transparent pointer-events-none mix-blend-multiply dark:mix-blend-normal z-40" />
                  {safeSpreadIdx === 0 ? renderPageContent('cover', 'left') : renderPageContent(leftPage, 'left')}
                </div>
                
                <div className="flex-1 relative bg-[#fffff8] dark:bg-[#1e1e1e] rounded-r-2xl border-y border-r border-black/5 dark:border-white/5 flex flex-col p-6 sm:p-12 overflow-hidden shadow-[inset_20px_0_40px_rgba(0,0,0,0.04),0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[inset_20px_0_40px_rgba(0,0,0,0.3),0_20px_50px_rgba(0,0,0,0.3)]">
                  <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black/20 dark:from-black/60 via-transparent to-transparent pointer-events-none mix-blend-multiply dark:mix-blend-normal z-40" />
                  {rightPage === 'editing' ? renderEditor() : renderPageContent(rightPage, 'right')}
                </div>
                {/* Book Center Crease */}
                <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-black/10 dark:bg-black/50 z-50 pointer-events-none" />
              </>
            ) : (
              <>
                 <div className="flex-1 relative flex flex-col p-6 sm:p-12 overflow-hidden">
                   <div className="absolute left-0 top-0 bottom-0 w-8 md:w-12 bg-gradient-to-r from-black/20 dark:from-black/40 via-black/5 to-transparent pointer-events-none mix-blend-multiply dark:mix-blend-normal z-40" />
                   {rightPage === 'editing' ? renderEditor() : renderPageContent(rightPage, 'single')}
                 </div>
              </>
            )}

            {/* Global Texture Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.02] mix-blend-multiply dark:mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/paper.png')]" />
          </motion.div>
        </AnimatePresence>

        {!isEditing && (
          <>
            {safeSpreadIdx > 0 && (
              <div 
                onClick={handlePrevPage}
                 onMouseEnter={() => playSound('hover')}
                className="absolute left-0 top-0 bottom-0 w-20 sm:w-1/4 z-50 cursor-[w-resize] group"
              >
                <div className="absolute left-2 sm:left-[5%] top-1/2 -translate-y-1/2 p-2 sm:p-4 text-[#4a3f35] dark:text-white opacity-0 group-hover:opacity-100 sm:group-hover:-translate-x-2 transition-all drop-shadow-md pointer-events-none">
                   <ChevronLeft size={64} strokeWidth={1} />
                </div>
              </div>
            )}
            {safeSpreadIdx < totalSpreads - 1 && (
              <div 
                onClick={handleNextPage}
                onMouseEnter={() => playSound('hover')}
                className="absolute right-0 top-0 bottom-0 w-20 sm:w-1/4 z-50 cursor-[e-resize] group"
              >
                <div className="absolute right-2 sm:right-[5%] top-1/2 -translate-y-1/2 p-2 sm:p-4 text-[#4a3f35] dark:text-white opacity-0 group-hover:opacity-100 sm:group-hover:translate-x-2 transition-all drop-shadow-md pointer-events-none">
                   <ChevronRight size={64} strokeWidth={1} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isEditing && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex gap-4 w-max px-6 py-3 bg-white/95 dark:bg-[#111]/95 backdrop-blur-xl rounded-full shadow-2xl border border-black/5 dark:border-white/10"
        >
          <button 
            onClick={() => { playSound('click'); setIsEditing(false); }}
            className="px-6 py-2 bg-transparent text-[#4a3f35] dark:text-white rounded-full hover:bg-gray-100 dark:hover:bg-[#333] transition-all text-sm font-medium uppercase tracking-widest"
          >
            Discard
          </button>
          <button 
            onClick={savePage}
            disabled={uploading}
            className="px-8 py-2 bg-[#1a1a1a] dark:bg-[#e0e0e0] text-white dark:text-[#121212] rounded-full shadow-md hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 text-sm font-bold uppercase tracking-widest disabled:opacity-50 disabled:hover:scale-100"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Store</span>
          </button>
        </motion.div>
      )}
    </div>
  );
};

const DecoratedImage = ({ url, playSound }: { url: string, playSound: any }) => {
  return (
    <div 
      className="relative inline-block mx-2 my-2 cursor-pointer group"
      onClick={() => playSound('imageClick')}
      onMouseEnter={() => playSound('hover')}
    >
      <div className="bg-white dark:bg-[#e0e0e0] p-2 shadow-[0_4px_15px_rgba(0,0,0,0.1)] transform group-hover:scale-[1.02] transition-all duration-300 ease-out group-hover:rotate-1 rounded-sm">
        <img 
          src={url} 
          alt="Memory" 
          className="max-w-full max-h-[35vh] object-contain rounded-sm"
          referrerPolicy="no-referrer"
          onError={(e) => (e.currentTarget.src = 'https://picsum.photos/seed/broken/400/300?blur=10')}
        />
      </div>
      <div className="absolute -top-3 -left-3 w-10 h-6 bg-[#fdfaf6]/80 dark:bg-white/40 border border-black/5 dark:border-white/10 shadow-sm backdrop-blur-[2px] transform -rotate-45 group-hover:-translate-y-1 group-hover:-translate-x-1 transition-all" style={{ clipPath: 'polygon(5% 0, 95% 0, 100% 100%, 0% 100%)' }} />
      <div className="absolute -bottom-3 -right-3 w-10 h-6 bg-[#fdfaf6]/80 dark:bg-white/40 border border-black/5 dark:border-white/10 shadow-sm backdrop-blur-[2px] transform -rotate-45 group-hover:translate-y-1 group-hover:translate-x-1 transition-all" style={{ clipPath: 'polygon(5% 0, 95% 0, 100% 100%, 0% 100%)' }} />
    </div>
  );
};
