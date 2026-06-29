/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  StickyNote, 
  Highlighter, 
  Eye, 
  Trash2, 
  X, 
  Check, 
  Edit, 
  RotateCcw,
  Info
} from 'lucide-react';
import { DocumentRecord } from '../types';

interface DocumentAnnotatorProps {
  doc: DocumentRecord;
  onUpdateDoc: (updatedFields: Partial<DocumentRecord>) => void;
  containerClassName?: string;
  imageClassName?: string;
  maxHeightClass?: string;
}

export const DocumentAnnotator: React.FC<DocumentAnnotatorProps> = ({
  doc,
  onUpdateDoc,
  containerClassName = "border border-[#1a1a1a] rounded-sm overflow-hidden bg-black/40 h-[240px] sm:h-[320px] lg:h-[650px] flex items-center justify-center relative select-none p-3",
  imageClassName = "object-contain max-h-[220px] sm:max-h-[300px] lg:max-h-[620px] shadow-2xl transition-all duration-300",
  maxHeightClass = "max-h-[620px]"
}) => {
  // Safe resolved image source (fallback to base64 if blob URL is expired/missing)
  const docImageSrc = doc.base64Data 
    ? `data:${doc.mimeType || 'image/jpeg'};base64,${doc.base64Data}` 
    : doc.imageUrl;

  // Modes: 'view' (default), 'note' (adding stickies), 'highlight' (drawing highlights)
  const [mode, setMode] = useState<'view' | 'note' | 'highlight'>('view');
  
  // Custom colors for sticky notes and highlights
  const [selectedColor, setSelectedColor] = useState<string>('yellow');

  // Drawing state (for highlights)
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // Note placing state
  const [activeNoteInput, setActiveNoteInput] = useState<{ x: number; y: number } | null>(null);
  const [noteText, setNoteText] = useState('');

  // Selected existing annotation for editing/viewing details
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  
  // State to track hover highlight
  const [hoverHighlightId, setHoverHighlightId] = useState<string | null>(null);

  // References and measurements for perfect responsive overlay alignment
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDims, setImgDims] = useState<{ width: number; height: number; left: number; top: number } | null>(null);

  const updateDimensions = () => {
    if (imgRef.current) {
      const { width, height, left, top } = imgRef.current.getBoundingClientRect();
      const parentRect = imgRef.current.parentElement?.getBoundingClientRect();
      if (parentRect) {
        setImgDims({
          width,
          height,
          left: left - parentRect.left,
          top: top - parentRect.top,
        });
      }
    }
  };

  // Run on mount, image change, and resize
  useEffect(() => {
    updateDimensions();
    // Use an interval to verify layout shifts after animation finishes
    const interval = setInterval(updateDimensions, 400);
    return () => clearInterval(interval);
  }, [docImageSrc, doc.id]);

  useEffect(() => {
    if (!imgRef.current) return;
    const observer = new ResizeObserver(() => {
      updateDimensions();
    });
    observer.observe(imgRef.current);
    if (imgRef.current.parentElement) {
      observer.observe(imgRef.current.parentElement);
    }
    return () => observer.disconnect();
  }, [docImageSrc, doc.id]);

  // Colors mapping
  const highlightColors: Record<string, { bg: string, border: string, hex: string }> = {
    yellow: { bg: 'bg-yellow-400/35', border: 'border-yellow-400/60', hex: '#facc15' },
    green: { bg: 'bg-emerald-400/35', border: 'border-emerald-400/60', hex: '#10b981' },
    blue: { bg: 'bg-sky-400/35', border: 'border-sky-400/60', hex: '#38bdf8' },
    pink: { bg: 'bg-pink-400/35', border: 'border-pink-400/60', hex: '#f472b6' },
  };

  const noteColors: Record<string, { bg: string, text: string, border: string, dot: string }> = {
    yellow: { bg: 'bg-[#fef08a]', text: 'text-amber-950', border: 'border-[#fde047]', dot: 'bg-yellow-500' },
    orange: { bg: 'bg-[#fed7aa]', text: 'text-orange-950', border: 'border-[#fdbb2f]', dot: 'bg-orange-500' },
    teal: { bg: 'bg-[#99f6e4]', text: 'text-teal-950', border: 'border-[#2dd4bf]', dot: 'bg-teal-500' },
    purple: { bg: 'bg-[#e9d5ff]', text: 'text-purple-950', border: 'border-[#c084fc]', dot: 'bg-purple-500' },
  };

  // Coordinate calculations relative to the image
  const getPercentageCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  // Mouse Handlers for Dragging (Highlights) and Clicking (Sticky Notes)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    
    // If popovers are open, close them if clicking outside
    setSelectedNoteId(null);
    setEditingNoteId(null);

    const coords = getPercentageCoords(e);

    if (mode === 'highlight') {
      setIsDrawing(true);
      setDrawStart(coords);
      setDrawCurrent(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || mode !== 'highlight') return;
    const coords = getPercentageCoords(e);
    setDrawCurrent(coords);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const coords = getPercentageCoords(e);

    if (mode === 'highlight' && isDrawing && drawStart) {
      setIsDrawing(false);
      const left = Math.min(drawStart.x, coords.x);
      const top = Math.min(drawStart.y, coords.y);
      const width = Math.abs(drawStart.x - coords.x);
      const height = Math.abs(drawStart.y - coords.y);

      // Only add if it's a real box, not a accidental tiny click
      if (width > 1.5 && height > 1.5) {
        const newHighlight = {
          id: Math.random().toString(36).substr(2, 9),
          x: left,
          y: top,
          width,
          height,
          color: selectedColor,
        };
        const currentHighlights = doc.highlights || [];
        onUpdateDoc({
          highlights: [...currentHighlights, newHighlight]
        });
      }
      setDrawStart(null);
      setDrawCurrent(null);
    } else if (mode === 'note') {
      // For notes, click to drop
      setActiveNoteInput({ x: coords.x, y: coords.y });
      setNoteText('');
    }
  };

  // Sticky Note handlers
  const handleAddNote = () => {
    if (!noteText.trim() || !activeNoteInput) return;
    const newNote = {
      id: Math.random().toString(36).substr(2, 9),
      x: activeNoteInput.x,
      y: activeNoteInput.y,
      text: noteText.trim(),
      color: selectedColor,
      createdAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };
    const currentNotes = doc.notes || [];
    onUpdateDoc({
      notes: [...currentNotes, newNote]
    });
    setActiveNoteInput(null);
    setNoteText('');
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNotes = doc.notes || [];
    onUpdateDoc({
      notes: currentNotes.filter(n => n.id !== id)
    });
    if (selectedNoteId === id) setSelectedNoteId(null);
    if (editingNoteId === id) setEditingNoteId(null);
  };

  const handleSaveEditNote = (id: string) => {
    if (!editText.trim()) return;
    const currentNotes = doc.notes || [];
    onUpdateDoc({
      notes: currentNotes.map(n => n.id === id ? { ...n, text: editText.trim() } : n)
    });
    setEditingNoteId(null);
    setSelectedNoteId(id);
  };

  // Highlight delete handler
  const handleDeleteHighlight = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentHighlights = doc.highlights || [];
    onUpdateDoc({
      highlights: currentHighlights.filter(h => h.id !== id)
    });
    if (hoverHighlightId === id) setHoverHighlightId(null);
  };

  // Clear all annotations
  const handleClearAll = () => {
    if (confirm('هل أنت متأكد من حذف كافة الملاحظات والتعليقات والتظليلات على هذه الوثيقة؟')) {
      onUpdateDoc({
        notes: [],
        highlights: []
      });
      setActiveNoteInput(null);
      setSelectedNoteId(null);
      setEditingNoteId(null);
      setHoverHighlightId(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full space-y-3">
      {/* 1. Styled Sticky Note & Highlights Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#0f0f0f] border border-[#1d1d1d] p-2 rounded-sm text-xs">
        {/* Active Mode buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => { setMode('view'); setActiveNoteInput(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-semibold transition-all cursor-pointer ${
              mode === 'view' 
                ? 'bg-[#d4af37] text-black shadow-md' 
                : 'text-gray-300 hover:text-white bg-[#161616] hover:bg-[#202020] border border-[#262626]'
            }`}
            title="وضع العرض والتصفح"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>تصفح</span>
          </button>
          
          <button
            type="button"
            onClick={() => { setMode('note'); setActiveNoteInput(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-semibold transition-all cursor-pointer ${
              mode === 'note' 
                ? 'bg-amber-600 text-white shadow-md border border-amber-500' 
                : 'text-gray-300 hover:text-white bg-[#161616] hover:bg-[#202020] border border-[#262626]'
            }`}
            title="إضافة ملاحظات لاصقة على الصورة"
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>ملاحظة لاصقة</span>
          </button>
          
          <button
            type="button"
            onClick={() => { setMode('highlight'); setActiveNoteInput(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-semibold transition-all cursor-pointer ${
              mode === 'highlight' 
                ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]' 
                : 'text-gray-300 hover:text-white bg-[#161616] hover:bg-[#202020] border border-[#262626]'
            }`}
            title="تظليل نصوص وفقرات بالماوس"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>تظليل النص</span>
          </button>
        </div>

        {/* Custom Toolbar Details & Colors / Reset */}
        <div className="flex items-center gap-3">
          {/* Colors Selection */}
          {(mode === 'note' || mode === 'highlight') && (
            <div className="flex items-center gap-1.5 border-l border-r border-[#222] px-3 py-0.5">
              <span className="text-[#888] text-[10px] ml-1">اللون:</span>
              {Object.keys(mode === 'note' ? noteColors : highlightColors).map((color) => {
                const isSelected = selectedColor === color;
                const bgValue = mode === 'note' 
                  ? noteColors[color]?.dot 
                  : highlightColors[color]?.hex;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-white scale-110' : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: bgValue, borderColor: '#000' }}
                  />
                );
              })}
            </div>
          )}

          {/* Reset / Clear All Annotations */}
          {((doc.notes && doc.notes.length > 0) || (doc.highlights && doc.highlights.length > 0)) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-sm transition-all cursor-pointer"
              title="حذف كافة الملاحظات والتظليلات من هذه الوثيقة"
            >
              <RotateCcw className="w-3 h-3" />
              <span>حذف التعديلات</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode Instructions banner */}
      {mode === 'note' && (
        <div className="bg-amber-950/20 border border-amber-900/40 text-amber-200 text-[11px] p-2 rounded-sm flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>انقر فوق أي مكان على صورة الوثيقة أدناه لإفلات وتدوين ملاحظة لاصقة جديدة.</span>
        </div>
      )}
      {mode === 'highlight' && (
        <div className="bg-[#d4af37]/5 border border-[#d4af37]/20 text-[#d4af37] text-[11px] p-2 rounded-sm flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
          <span>اضغط بالماوس واسحب لتظليل وتحديد أي نص أو منطقة معينة على صورة الوثيقة.</span>
        </div>
      )}

      {/* 2. Interactive Image Area with Annotation Overlay */}
      <div className={containerClassName}>
        <img
          ref={imgRef}
          src={docImageSrc}
          alt="Document Scanned Image with annotations"
          className={`${imageClassName} ${mode !== 'view' ? 'cursor-crosshair' : ''}`}
          referrerPolicy="no-referrer"
          onLoad={updateDimensions}
        />

        {/* Transparent Annotation Overlay, sizes exactly with the image */}
        {imgDims && (
          <div
            id="annotation-overlay"
            className="absolute select-none overflow-visible"
            style={{
              left: `${imgDims.left}px`,
              top: `${imgDims.top}px`,
              width: `${imgDims.width}px`,
              height: `${imgDims.height}px`,
              cursor: mode === 'note' ? 'copy' : mode === 'highlight' ? 'crosshair' : 'default',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Draw highlights */}
            {doc.highlights?.map((h) => {
              const colorStyle = highlightColors[h.color] || highlightColors.yellow;
              const isHovered = hoverHighlightId === h.id;
              
              return (
                <div
                  key={h.id}
                  className={`absolute border transition-all ${colorStyle.bg} ${colorStyle.border} ${
                    mode === 'view' ? 'hover:brightness-110' : ''
                  }`}
                  style={{
                    left: `${h.x}%`,
                    top: `${h.y}%`,
                    width: `${h.width}%`,
                    height: `${h.height}%`,
                  }}
                  onMouseEnter={() => mode === 'view' && setHoverHighlightId(h.id)}
                  onMouseLeave={() => mode === 'view' && setHoverHighlightId(null)}
                >
                  {/* Delete button when hovered in View mode or anytime in Highlight mode */}
                  {(isHovered || mode === 'highlight') && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteHighlight(h.id, e)}
                      className="absolute -top-3.5 -right-3.5 z-40 bg-red-600 hover:bg-red-500 text-white p-0.5 rounded-full shadow-lg border border-red-800 transition-transform hover:scale-115 cursor-pointer"
                      title="حذف التظليل"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Temporary Dragging Highlight box */}
            {isDrawing && drawStart && drawCurrent && (
              <div
                className={`absolute border-2 border-dashed border-[#d4af37] bg-[#d4af37]/20 pointer-events-none`}
                style={{
                  left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                  top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                  width: `${Math.abs(drawStart.x - drawCurrent.x)}%`,
                  height: `${Math.abs(drawStart.y - drawCurrent.y)}%`,
                }}
              />
            )}

            {/* Sticky Notes */}
            {doc.notes?.map((n) => {
              const colorStyle = noteColors[n.color] || noteColors.yellow;
              const isPopoverOpen = selectedNoteId === n.id;
              const isEditing = editingNoteId === n.id;

              return (
                <div
                  key={n.id}
                  className="absolute z-20 overflow-visible"
                  style={{
                    left: `${n.x}%`,
                    top: `${n.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Note marker button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (mode === 'view') {
                        setSelectedNoteId(selectedNoteId === n.id ? null : n.id);
                        setEditingNoteId(null);
                      }
                    }}
                    className={`flex items-center justify-center w-6 h-6 rounded-full border-2 ${colorStyle.bg} ${colorStyle.border} shadow-md hover:scale-115 transition-transform cursor-pointer ${
                      isPopoverOpen ? 'scale-115 ring-2 ring-white' : ''
                    }`}
                    title={n.text.slice(0, 30) + '...'}
                  >
                    <StickyNote className={`w-3.5 h-3.5 ${colorStyle.text}`} />
                  </button>

                  {/* Popover Card for Note detail / edit */}
                  {isPopoverOpen && (
                    <div
                      className="absolute z-30 bg-[#161616] border border-[#2d2d2d] rounded-sm p-3 w-64 shadow-2xl space-y-2 text-right text-xs"
                      style={{
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: '8px'
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-1 mb-1">
                        <span className="text-[#888] text-[10px] font-mono">ملاحظة {n.createdAt || ''}</span>
                        <div className="flex items-center gap-1.5">
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(n.id);
                                setEditText(n.text);
                              }}
                              className="text-gray-400 hover:text-[#d4af37]"
                              title="تعديل الملاحظة"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNote(n.id, e)}
                            className="text-gray-400 hover:text-red-400"
                            title="حذف الملاحظة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedNoteId(null)}
                            className="text-gray-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-[#2d2d2d] text-white p-2 text-xs rounded-sm resize-none focus:outline-none focus:border-[#d4af37]"
                            rows={3}
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="px-2 py-1 bg-[#222] hover:bg-[#333] text-gray-300 rounded-sm text-[10px]"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditNote(n.id)}
                              className="px-2 py-1 bg-[#d4af37] text-black hover:bg-[#b8962d] font-bold rounded-sm text-[10px]"
                            >
                              حفظ
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-200 whitespace-pre-wrap break-words font-sans leading-relaxed text-right">
                          {n.text}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Note input popup when drop a note in Note Mode */}
            {activeNoteInput && (
              <div
                className="absolute z-30 bg-[#161616] border border-[#2d2d2d] rounded-sm p-3 w-64 shadow-2xl space-y-2 text-right text-xs"
                style={{
                  left: `${activeNoteInput.x}%`,
                  top: `${activeNoteInput.y}%`,
                  transform: 'translate(-50%, -100%)',
                  marginTop: '-8px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-1 mb-1.5">
                  <span className="text-[#888] font-serif">إضافة ملاحظة جديدة</span>
                  <button type="button" onClick={() => setActiveNoteInput(null)} className="text-gray-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <textarea
                  autoFocus
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="أكتب ملاحظتك هنا..."
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] text-white p-2 text-xs rounded-sm resize-none focus:outline-none focus:border-[#d4af37]"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                />
                
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveNoteInput(null)}
                    className="px-2 py-1 bg-[#222] hover:bg-[#333] text-gray-300 rounded-sm text-[10px]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleAddNote}
                    className="px-2.5 py-1 bg-amber-600 text-white hover:bg-amber-500 font-bold rounded-sm text-[10px] flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
