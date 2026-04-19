import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  urls: string[];
  playSound: (sound: string) => void;
}

export const ImageBundle: React.FC<Props> = ({ urls, playSound }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('flip');
    setCurrentIndex((prev) => (prev + 1) % urls.length);
  };

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('flip');
    setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length);
  };

  return (
    <div className="my-8 flex justify-center">
      {/* Bundle Stack Representation */}
      <div 
        onMouseEnter={() => playSound('hover')}
        onClick={() => { playSound('imageClick'); setIsOpen(true); }}
        className="relative w-48 h-56 sm:w-56 sm:h-64 cursor-pointer group perspective-[1000px]"
      >
        {urls.slice(0, 3).map((url, idx) => (
          <motion.div
            key={idx}
            className="absolute inset-0 bg-white dark:bg-[#e0e0e0] shadow-xl p-3 border border-[#ece6da] dark:border-white/10"
            style={{ 
              zIndex: 3 - idx,
              rotate: idx === 0 ? 0 : idx === 1 ? 5 : -5,
              x: idx === 0 ? 0 : idx === 1 ? 12 : -12,
              y: idx === 0 ? 0 : idx === 1 ? 6 : -6,
              transformOrigin: 'bottom center'
            }}
            whileHover={idx === 0 ? { y: -15, scale: 1.02, rotate: 0 } : {}}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <img 
              src={url} 
              alt="Bundle top" 
              className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-500 ease-out"
              referrerPolicy="no-referrer"
            />
            {idx === 0 && (
              <div className="absolute -bottom-4 right-0 bg-[#fff9f0] dark:bg-[#121212] dark:text-white border border-[#ece6da] dark:border-[#333] rounded-full px-4 py-1.5 text-[10px] uppercase tracking-tighter shadow-md font-sans font-bold z-10 transition-transform group-hover:scale-110">
                {urls.length} images
              </div>
            )}
            
            {/* Gloss overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none mix-blend-overlay" />
          </motion.div>
        ))}
      </div>

      {/* Fullscreen Viewer Dialog */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 sm:p-20"
            onClick={() => { playSound('click'); setIsOpen(false); }}
          >
            <button 
              className="absolute top-6 right-6 sm:top-10 sm:right-10 text-white/50 hover:text-white transition-colors p-4 hover:bg-white/10 rounded-full"
              onClick={() => { playSound('click'); setIsOpen(false); }}
              onMouseEnter={() => playSound('hover')}
            >
              <X size={32} />
            </button>

            <motion.div 
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
              transition={{ duration: 0.3 }}
              className="relative max-h-full max-w-6xl w-full flex items-center justify-center perspective-[1200px]"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={urls[currentIndex]} 
                alt="Viewer content" 
                className="max-h-[80vh] max-w-full object-contain shadow-2xl rounded-sm ring-1 ring-white/10"
                referrerPolicy="no-referrer"
              />
              
              <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-8 text-white/60 bg-black/40 backdrop-blur-md px-8 py-3 rounded-full border border-white/10">
                <button 
                   onClick={prev} 
                   onMouseEnter={() => playSound('hover')}
                   className="hover:text-white hover:bg-white/10 p-2 rounded-full transition-all"
                >
                   <ChevronLeft size={28} />
                </button>
                <span className="text-sm font-mono tracking-widest text-white/80">{currentIndex + 1} <span className="opacity-40">/</span> {urls.length}</span>
                <button 
                   onClick={next} 
                   onMouseEnter={() => playSound('hover')}
                   className="hover:text-white hover:bg-white/10 p-2 rounded-full transition-all"
                >
                   <ChevronRight size={28} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
