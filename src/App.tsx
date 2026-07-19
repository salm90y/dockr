/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Component } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Users, 
  Download, 
  Trash2, 
  Search, 
  RefreshCw, 
  FileSpreadsheet, 
  Plus, 
  Check, 
  ArrowLeft, 
  Sparkles,
  Info,
  Calendar,
  Hash,
  Building,
  ChevronLeft,
  X,
  QrCode,
  Link as LinkIcon,
  ExternalLink,
  Copy,
  ShieldCheck,
  FileCheck2,
  Printer,
  Archive,
  LayoutGrid,
  List,
  TableProperties,
  Camera,
  Video,
  Folder,
  FolderOpen,
  Share2,
  ChevronRight,
  Eye,
  Layers,
  FileImage,
  Edit3,
  Settings,
  LogOut,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';

import { DocumentRecord, ExtractionStats, UserProfile } from './types';
import { generateSampleDocument } from './sampleGenerator';
import { DocumentAnnotator } from './components/DocumentAnnotator';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, getDoc } from './lib/mockFirebase';
import { db, handleFirestoreError, OperationType, auth } from './lib/mockFirebase';
import { onAuthStateChanged, User, signOut } from './lib/mockFirebase';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { safeStorage } from './lib/safeStorage';
import Tesseract from 'tesseract.js';

// Shared, persistent Tesseract.js worker for high-performance offline OCR
let cachedTesseractWorker: any = null;
let currentOcrLoggerCallback: ((m: any) => void) | null = null;

async function getSharedTesseractWorker() {
  if (!cachedTesseractWorker) {
    console.log("Initializing persistent, high-performance Tesseract.js worker...");
    cachedTesseractWorker = await Tesseract.createWorker(['ara', 'eng'], undefined, {
      logger: (m) => {
        if (currentOcrLoggerCallback) {
          try {
            currentOcrLoggerCallback(m);
          } catch (err) {
            console.error("Error in active OCR progress callback:", err);
          }
        }
      }
    });
  }
  return cachedTesseractWorker;
}

// Helper function to encode Arabic text into safe base64 URL parameter
const encodeMetadata = (doc: any) => {
  const dataToEncode = {
    no: doc.documentNumber || '',
    dt: doc.documentDate || '',
    au: doc.issuingAuthority || '',
    su: doc.documentSubject || '',
    ty: doc.documentType || 'أخرى',
    pt: doc.penaltyType || '',
    la: doc.legalArticle || '',
    pr: doc.penaltyReason || '',
    pd: doc.penaltyDuration || '',
    tx: doc.extractedText ? doc.extractedText.slice(0, 400) : ''
  };
  try {
    const jsonStr = JSON.stringify(dataToEncode);
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    return `${window.location.origin}${window.location.pathname}?vdata=${base64}`;
  } catch (e) {
    console.error('Encoding error:', e);
    return '';
  }
};

// Helper function to decode safe base64 URL parameter back to Arabic document fields
const decodeMetadata = (base64Str: string) => {
  try {
    const jsonStr = decodeURIComponent(escape(atob(base64Str)));
    const data = JSON.parse(jsonStr);
    return {
      documentNumber: data.no || '',
      documentDate: data.dt || '',
      issuingAuthority: data.au || '',
      documentSubject: data.su || '',
      documentType: data.ty || 'أخرى',
      penaltyType: data.pt || '',
      legalArticle: data.la || '',
      penaltyReason: data.pr || '',
      penaltyDuration: data.pd || '',
      extractedText: data.tx || ''
    };
  } catch (e) {
    console.error('Decoding error:', e);
    return null;
  }
};

// Safe UUID Generator for all environments including non-secure sandboxed iframes
const safeRandomUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Beautiful, verified official logo of the Iraqi Ministry of Interior (وزارة الداخلية العراقية)
function IraqiMinistryLogo({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <div className={`relative ${className} flex items-center justify-center`}>
      <img 
        src="https://upload.wikimedia.org/wikipedia/commons/1/10/MOI.png" 
        alt="شعار وزارة الداخلية العراقية" 
        className="w-full h-full object-contain select-none"
        referrerPolicy="no-referrer"
        onError={(e) => {
          // Fallback to official coat of arms of Iraq if the specific MoI logo is unreachable
          e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/8/82/Coat_of_arms_of_Iraq.svg";
        }}
      />
    </div>
  );
}

export interface FolderCategory {
  type: string;
  label: string;
  color: string;
  isCustom?: boolean;
  createdAt?: number;
}

export const DEFAULT_CATEGORIES: FolderCategory[] = [
  { type: 'الكل', label: 'كافة الوثائق والأرشيف', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  { type: 'تقاعد', label: 'ملفات التقاعد المكتملة', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  { type: 'عقوبة', label: 'الأوامر الإدارية والعقوبات', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { type: 'نقل وإلحاق', label: 'مجلد النقل للإلحاق', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { type: 'التحاق', label: 'قرارات المباشرة والالتحاق', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { type: 'سحب يد', label: 'ملفات سحب اليد والتوقيف', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { type: 'إجازة سنوية', label: 'إجازات الضباط والمنتسبين', color: 'text-blue-400 bg-blue-500/10 border-blue-400/20' },
  { type: 'وفاة', label: 'سجلات الشهداء والمتوفين', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  { type: 'تاريخ انفكاك', label: 'ملفات الانفكاك والمغادرة', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  { type: 'أخرى', label: 'مستندات وكتب رسمية متنوعة', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' }
];

// Robust React Error Boundary to capture and display client-side rendering issues
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="min-h-screen bg-[#050505] text-[#e5e5e5] p-8 flex items-center justify-center font-sans antialiased">
          <div className="max-w-2xl w-full border border-red-500/30 bg-[#0c0606] p-6 rounded-lg shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h1 className="text-xl font-bold">⚠️ عذراً، حدث خطأ غير متوقع في واجهة التطبيق</h1>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              تظهر هذه الشاشة بسبب توقف أحد عناصر الواجهة عن العمل بشكل طبيعي. يرجى تصوير هذه الشاشة وإرسالها إلينا لنتمكن من حل الخلل فوراً:
            </p>
            <div className="p-4 bg-black border border-neutral-800 rounded font-mono text-xs text-red-400 overflow-auto max-h-60 text-left" dir="ltr">
              <p className="font-bold mb-2 text-red-500">Error: {this.state.error?.message}</p>
              <pre className="whitespace-pre-wrap text-[11px]">{this.state.error?.stack}</pre>
              {this.state.errorInfo && (
                <pre className="whitespace-pre-wrap text-[11px] mt-2 text-gray-500">
                  {JSON.stringify(this.state.errorInfo, null, 2)}
                </pre>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  safeStorage.clear();
                  window.location.reload();
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded transition-colors cursor-pointer"
              >
                مسح التخزين المؤقت وإعادة التشغيل
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-xs px-4 py-2 rounded transition-colors cursor-pointer"
              >
                تحديث الصفحة
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Highly robust utility to normalize Arabic characters and rejoin disconnected letters from OCR output
function rejoinArabicLetters(text: string): string {
  if (!text) return "";

  // 1. Convert any Arabic presentation forms (isolated/initial/medial/final glyphs) 
  // to their standard nominal Arabic characters so they can connect correctly in browser.
  let normalized = text.normalize('NFKC');

  // 2. Remove any zero-width characters (ZWNJ, ZWJ, ZWSP, BOM) that cause browsers to render connected letters as disconnected
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 3. Process line by line to preserve formatting and layout where possible.
  const lines = normalized.split('\n');
  const processedLines = lines.map(line => {
    if (!line.trim()) return line;
    if (!/[\u0600-\u06FF]/.test(line)) return line;

    // Replace multiple spaces (2 or more) with a placeholder to keep word boundaries
    let tempLine = line.replace(/\s{2,}/g, ' ___WORD_BREAK___ ');

    const tokens = tempLine.split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) return line;

    // Check if the majority of Arabic tokens in this line are single characters.
    const arabicTokens = tokens.filter(t => /[\u0600-\u06FF]/.test(t));
    if (arabicTokens.length > 2) {
      const singleLetterCount = arabicTokens.filter(t => t.length === 1).length;
      const ratio = singleLetterCount / arabicTokens.length;
      
      // If more than 50% of the Arabic tokens are single letters, it's a spaced-out OCR line.
      if (ratio > 0.5) {
        let newLine = "";
        for (let i = 0; i < tokens.length; i++) {
          const current = tokens[i];
          const next = tokens[i + 1];
          
          newLine += current;
          
          if (next) {
            const isCurrentArabicChar = current.length === 1 && /[\u0600-\u06FF]/.test(current);
            const isNextArabicChar = next.length === 1 && /[\u0600-\u06FF]/.test(next);
            
            // If both are single Arabic characters, do NOT put a space between them (join them).
            if (isCurrentArabicChar && isNextArabicChar) {
              // Join directly without space
            } else if (current === '___WORD_BREAK___' || next === '___WORD_BREAK___') {
              // Word break will be handled by replace later
            } else {
              newLine += " ";
            }
          }
        }
        tempLine = newLine;
      }
    }
    
    // Fallback: simple recursive replacement of isolated letter spacing.
    let prevLine;
    do {
      prevLine = tempLine;
      // Match a single Arabic char, followed by one or more spaces, followed by another single Arabic char,
      // where the second is at the end or followed by a space, and the first is at the start or preceded by a space.
      tempLine = tempLine.replace(/(?<=^|\s)([\u0600-\u06FF])\s+([\u0600-\u06FF])(?=\s|$)/g, '$1$2');
    } while (tempLine !== prevLine);

    // Restore the word boundaries and remove double spacing
    tempLine = tempLine.replace(/___WORD_BREAK___/g, ' ');
    tempLine = tempLine.replace(/\s+/g, ' ').trim();

    return tempLine;
  });

  return processedLines.join('\n');
}

export default function App() {
  const [user, setUser] = useState<User | null>({ uid: 'local', email: 'admin@local' } as any);
  const [userProfile, setUserProfile] = useState<UserProfile | null>({ fullName: 'المدير العام', role: 'admin' } as any);
  const isAdminUser = userProfile?.role === 'admin' || user?.email === 'ahmed1986y5@gmail.com';
  const [loading, setLoading] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  useEffect(() => {
    // 1. Check if there is a secure local offline user session stored
    const localUserStr = safeStorage.getItem('archiver_local_user');
    const localProfileStr = safeStorage.getItem('archiver_local_profile');
    if (localUserStr && localProfileStr) {
      try {
        setUser(JSON.parse(localUserStr));
        setUserProfile(JSON.parse(localProfileStr));
        setLoading(false);
        return;
      } catch (err) {
        console.error("Failed to restore secure offline user session:", err);
      }
    }

    // 2. Fallback to Firebase onAuthStateChanged if online
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            if (u.email === 'ahmed1986y5@gmail.com' && data.role !== 'admin') {
              // Force update to admin if they are the admin email but role is incorrect
              await updateDoc(docRef, { role: 'admin' });
              data.role = 'admin';
            }
            setUserProfile(data);
          } else {
             // Create the user profile if it doesn't exist
             const isAdmin = u.email === 'ahmed1986y5@gmail.com';
             const newProfile = {
               email: u.email || '',
               fullName: u.displayName || 'مستخدم',
               role: isAdmin ? 'admin' : 'employee',
               createdAt: Date.now()
             };
             await setDoc(docRef, newProfile);
             setUserProfile(newProfile as UserProfile);
          }
        } catch (e) {
          console.error("Failed to fetch user profile", e);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      safeStorage.removeItem('archiver_local_user');
      safeStorage.removeItem('archiver_local_profile');
      setUser(null);
      setUserProfile(null);
      await signOut(auth);
    } catch (e) {
      console.error("Error during sign out:", e);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#090b0f] flex items-center justify-center"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>;
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <Login onLoginSuccess={(localUser, localProfile) => {
          if (localUser && localProfile) {
            setUser(localUser);
            setUserProfile(localProfile);
          }
        }} />
      </ErrorBoundary>
    );
  }

  if (showAdminDashboard && isAdminUser) {
    const isOffline = safeStorage.getItem('archiver_is_offline') === 'true';
    return (
      <ErrorBoundary>
        <div dir="rtl" className="min-h-screen bg-[#050505] text-[#e5e5e5] font-sans antialiased pb-12">
          <header className="bg-gradient-to-b from-[#0a0a0a] to-[#040404] border-b border-[#1c1c1c] sticky top-0 z-40 shadow-xl px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <h1 className="text-xl font-cairo font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ffffff] via-[#f3df95] to-[#d4af37]">لوحة تحكم المشرف</h1>
            </div>
            <button
              onClick={() => setShowAdminDashboard(false)}
              className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-white text-xs font-bold px-4 py-2 rounded-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              العودة للتطبيق
            </button>
          </header>
          <AdminDashboard isOfflineMode={isOffline} />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <MainApp user={user} userProfile={userProfile} isAdminUser={isAdminUser} onLogout={handleLogout} onOpenAdmin={() => setShowAdminDashboard(true)} />
    </ErrorBoundary>
  );
}

function MainApp({ user, userProfile, isAdminUser, onLogout, onOpenAdmin }: { user: User, userProfile: UserProfile | null, isAdminUser: boolean, onLogout: () => void, onOpenAdmin: () => void }) {
  // Offline Mode & Local Heuristics / Ollama AI Configuration States
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    const saved = safeStorage.getItem('archiver_is_offline');
    return saved !== null ? saved === 'true' : true;
  });
  const [useOllama, setUseOllama] = useState<boolean>(() => {
    return safeStorage.getItem('archiver_use_ollama') === 'true';
  });
  const [ollamaUrl, setOllamaUrl] = useState<string>(() => {
    return safeStorage.getItem('archiver_ollama_url') || 'http://localhost:11434';
  });
  const [ollamaModel, setOllamaModel] = useState<string>(() => {
    return safeStorage.getItem('archiver_ollama_model') || 'qwen2.5:7b';
  });
  const [showOllamaSettingsModal, setShowOllamaSettingsModal] = useState<boolean>(false);

  useEffect(() => {
    safeStorage.setItem('archiver_is_offline', String(isOfflineMode));
  }, [isOfflineMode]);

  useEffect(() => {
    safeStorage.setItem('archiver_use_ollama', String(useOllama));
    safeStorage.setItem('archiver_ollama_url', ollamaUrl);
    safeStorage.setItem('archiver_ollama_model', ollamaModel);
  }, [useOllama, ollamaUrl, ollamaModel]);

  const [documents, setDocuments] = useState<DocumentRecord[]>(() => {
    try {
      const saved = safeStorage.getItem('archiver_documents');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch (e) {
      console.error('Failed to parse saved documents:', e);
      return [];
    }
  });

  // Real-time synchronization with Firebase Firestore, plus initial seeding from local storage
  useEffect(() => {
    if (isOfflineMode) return;
    const unsubscribe = onSnapshot(collection(db, "documents"), (snapshot) => {
      const docsList: DocumentRecord[] = [];
      snapshot.forEach((docSnap) => {
        docsList.push(docSnap.data() as DocumentRecord);
      });
      
      // Order descending by createdAt
      docsList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
 
      if (docsList.length > 0) {
        setDocuments(docsList);
        safeStorage.setItem('archiver_documents', JSON.stringify(docsList));
      } else {
        // If Firestore is empty but we have local storage data, seed Firestore!
        try {
          const saved = safeStorage.getItem('archiver_documents');
          const localDocs = saved ? JSON.parse(saved) as DocumentRecord[] : [];
          if (localDocs.length > 0) {
            localDocs.forEach((docRecord) => {
              const enriched = { 
                ...docRecord, 
                createdAt: docRecord.createdAt || Date.now() 
              };
              setDoc(doc(db, "documents", docRecord.id), enriched).catch(err => {
                console.error("Firestore seeding error for doc:", docRecord.id, err);
                handleFirestoreError(err, OperationType.WRITE, `documents/${docRecord.id}`);
              });
            });
          } else {
            setDocuments([]);
            safeStorage.setItem('archiver_documents', JSON.stringify([]));
          }
        } catch (e) {
          console.error("Failed to seed Firestore from local storage:", e);
          setDocuments([]);
          safeStorage.setItem('archiver_documents', JSON.stringify([]));
        }
      }
    }, (error) => {
      console.error("Firestore snapshot listener failed:", error);
      handleFirestoreError(error, OperationType.GET, "documents");
    });
 
    return () => unsubscribe();
  }, [isOfflineMode]);
 
  // Custom categories / folders states
  const [categories, setCategories] = useState<FolderCategory[]>(() => {
    try {
      const saved = safeStorage.getItem('archiver_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return DEFAULT_CATEGORIES;
    } catch (e) {
      return DEFAULT_CATEGORIES;
    }
  });

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FolderCategory | null>(null);
  const [folderFormName, setFolderFormName] = useState('');
  const [folderFormLabel, setFolderFormLabel] = useState('');
  const [folderFormColor, setFolderFormColor] = useState('text-cyan-400 bg-cyan-500/10 border-cyan-500/20');

  // State for duplicate book number alerts and other visual alerts
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    docId?: string;
  }>>([]);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, docId?: string) => {
    const id = safeRandomUUID();
    setToasts(prev => [...prev, { id, type, title, message, docId }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 10000); // 10 seconds to allow clicking
  };

  // Real-time synchronization for Categories
  useEffect(() => {
    if (isOfflineMode) return;
    const unsubscribe = onSnapshot(collection(db, "categories"), (snapshot) => {
      const catList: FolderCategory[] = [];
      snapshot.forEach((docSnap) => {
        catList.push(docSnap.data() as FolderCategory);
      });
      
      if (catList.length > 0) {
        // Sort: defaults first (matching DEFAULT_CATEGORIES order if possible) or sort by isCustom
        catList.sort((a, b) => {
          if (!a.isCustom && b.isCustom) return -1;
          if (a.isCustom && !b.isCustom) return 1;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });
        setCategories(catList);
        safeStorage.setItem('archiver_categories', JSON.stringify(catList));
      } else {
        // Seed DEFAULT_CATEGORIES to Firestore if Firestore is completely empty
        DEFAULT_CATEGORIES.forEach((cat, idx) => {
          const enriched = {
            ...cat,
            isCustom: cat.type !== 'الكل' && cat.type !== 'أخرى',
            createdAt: Date.now() + idx
          };
          setDoc(doc(db, "categories", cat.type), enriched).catch(err => {
            console.error("Firestore seeding error for category:", cat.type, err);
          });
        });
      }
    }, (error) => {
      console.error("Firestore categories snapshot listener failed:", error);
    });

    return () => unsubscribe();
  }, [isOfflineMode]);

  // Load initial documents and categories from the local offline server if in offline mode
  useEffect(() => {
    if (!isOfflineMode) return;
    
    // Fetch documents from local API with cache buster
    fetch(`/api/local/documents?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          setDocuments(data);
          safeStorage.setItem('archiver_documents', JSON.stringify(data));
        }
      })
      .catch(err => console.error("Failed to load documents from local API:", err));

    // Fetch categories from local API with cache buster
    fetch(`/api/local/categories?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          setCategories(data);
          safeStorage.setItem('archiver_categories', JSON.stringify(data));
        }
      })
      .catch(err => console.error("Failed to load categories from local API:", err));
  }, [isOfflineMode]);

  // Auto-save Documents to LocalStorage on state changes for local-first/offline consistency
  useEffect(() => {
    if (documents) {
      safeStorage.setItem('archiver_documents', JSON.stringify(documents));
    }
  }, [documents]);

  useEffect(() => {
    if (categories) {
      safeStorage.setItem('archiver_categories', JSON.stringify(categories));

      // If we are in offline mode, sync categories to local filesystem database
      if (isOfflineMode) {
        fetch('/api/local/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(categories)
        }).catch(err => console.error("Failed to sync categories to local API:", err));
      }
    }
  }, [categories, isOfflineMode]);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const logAction = async (action: 'create' | 'update' | 'delete', docId: string, docNumber: string, docSubject: string, details?: string) => {
    if (!user || !userProfile) return;
    try {
      console.log(`[Audit Log] Action: ${action}, DocID: ${docId}, Number: ${docNumber}, Subject: ${docSubject}, Details: ${details}`);
      if (isOfflineMode) return;
      const logRef = doc(collection(db, 'auditLogs'));
      await setDoc(logRef, {
        id: logRef.id,
        action,
        documentId: docId,
        documentNumber: docNumber || 'بدون رقم',
        documentSubject: docSubject || 'بدون موضوع',
        userId: user.uid,
        userName: userProfile.fullName || 'مستخدم غير معروف',
        timestamp: Date.now(),
        details: details || ''
      });
    } catch (e) {
      console.error("Failed to log action:", e);
    }
  };

  const saveDocToFirestore = async (record: DocumentRecord) => {
    try {
      const enriched = {
        ...record,
        createdBy: user?.uid,
        createdByName: userProfile?.fullName || 'مستخدم غير معروف',
        createdAt: record.createdAt || Date.now()
      };
      if (!isOfflineMode) {
        await setDoc(doc(db, "documents", record.id), enriched);
      } else {
        // Save single document to local API when offline
        fetch('/api/local/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enriched)
        }).catch(err => console.error("Failed to save doc to local API:", err));
      }
      logAction('create', record.id, record.documentNumber, record.documentSubject, `تم إضافة وثيقة جديدة: ${record.fileName}`);
    } catch (e) {
      console.error("Failed to save document to Firestore:", e);
      handleFirestoreError(e, OperationType.WRITE, `documents/${record.id}`);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderFormName.trim()) {
      alert('يرجى إدخال اسم المجلد/التصنيف');
      return;
    }
    const sanitizedType = folderFormName.trim();
    const sanitizedLabel = folderFormLabel.trim() || sanitizedType;

    if (editingCategory) {
      const oldType = editingCategory.type;
      
      if (oldType !== sanitizedType && categories.some(c => c.type === sanitizedType)) {
        alert('هذا الاسم مستخدم بالفعل لمجلد آخر!');
        return;
      }

      try {
        if (oldType !== sanitizedType) {
          const updatedCat: FolderCategory = {
            type: sanitizedType,
            label: sanitizedLabel,
            color: folderFormColor,
            isCustom: editingCategory.isCustom !== undefined ? editingCategory.isCustom : true,
            createdAt: editingCategory.createdAt || Date.now()
          };
          await setDoc(doc(db, "categories", sanitizedType), updatedCat);
          await deleteDoc(doc(db, "categories", oldType));

          const affectedDocs = documents.filter(doc => (doc.documentType || 'أخرى') === oldType);
          for (const adoc of affectedDocs) {
            await setDoc(doc(db, "documents", adoc.id), {
              ...adoc,
              documentType: sanitizedType
            });
          }

          if (filterType === oldType) {
            setFilterType(sanitizedType);
          }
        } else {
          const updatedCat: FolderCategory = {
            ...editingCategory,
            label: sanitizedLabel,
            color: folderFormColor
          };
          await setDoc(doc(db, "categories", oldType), updatedCat);
        }

        setShowFolderModal(false);
        setEditingCategory(null);
        setFolderFormName('');
        setFolderFormLabel('');
      } catch (err) {
        console.error("Error saving category:", err);
        alert('حدث خطأ أثناء حفظ التعديلات');
      }
    } else {
      if (categories.some(c => c.type === sanitizedType || c.type === 'الكل')) {
        alert('هذا الاسم مستخدم بالفعل لمجلد آخر!');
        return;
      }

      try {
        const newCat: FolderCategory = {
          type: sanitizedType,
          label: sanitizedLabel,
          color: folderFormColor,
          isCustom: true,
          createdAt: Date.now()
        };
        await setDoc(doc(db, "categories", sanitizedType), newCat);
        setShowFolderModal(false);
        setFolderFormName('');
        setFolderFormLabel('');
      } catch (err) {
        console.error("Error creating category:", err);
        alert('حدث خطأ أثناء إنشاء المجلد الجديد');
      }
    }
  };

  const handleDeleteCategory = async (category: FolderCategory) => {
    if (category.type === 'الكل' || category.type === 'أخرى') {
      alert('لا يمكن حذف المجلدات الأساسية للنظام!');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من حذف المجلد "${category.type}"؟ سيتم نقل كافة الوثائق الموجودة بداخله إلى مجلد "أخرى".`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "categories", category.type));

      const affectedDocs = documents.filter(doc => (doc.documentType || 'أخرى') === category.type);
      for (const adoc of affectedDocs) {
        await setDoc(doc(db, "documents", adoc.id), {
          ...adoc,
          documentType: 'أخرى'
        });
      }

      if (filterType === category.type) {
        setFilterType('الكل');
      }

      setShowFolderModal(false);
      setEditingCategory(null);
    } catch (err) {
      console.error("Error deleting category:", err);
      alert('حدث خطأ أثناء حذف المجلد');
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Advanced Search & Integrated Archive states
  const [searchViewMode, setSearchViewMode] = useState<'table' | 'grid'>('table');
  const [filterType, setFilterType] = useState<string>('الكل');
  const [filterStatus, setFilterStatus] = useState<string>('الكل');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Safely redirect Archive requests to the newly unified, professional Search Page/Modal
  useEffect(() => {
    if (showArchiveModal) {
      setIsSearchOpen(true);
      setShowArchiveModal(false);
    }
  }, [showArchiveModal]);
  const [editingField, setEditingField] = useState<{ docId: string; field: string } | null>(null);
  const [isReadOnlyArchive, setIsReadOnlyArchive] = useState(true);
  const [readOnlyFontSize, setReadOnlyFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  
  // Excel, Print, and PDF dialog states
  const [showExcelExportModal, setShowExcelExportModal] = useState(false);
  const [excelExportBranch, setExcelExportBranch] = useState<string>('all');
  const [excelExportSplitNames, setExcelExportSplitNames] = useState(true);

  const [showPrintConfirmModal, setShowPrintConfirmModal] = useState(false);
  const [printTargetDoc, setPrintTargetDoc] = useState<DocumentRecord | null>(null);

  const [showPdfConfirmModal, setShowPdfConfirmModal] = useState(false);
  const [pdfTargetDoc, setPdfTargetDoc] = useState<DocumentRecord | null>(null);

  const [showPdfAllConfirmModal, setShowPdfAllConfirmModal] = useState(false);
  const [pdfAllOption, setPdfAllOption] = useState<'separate' | 'single'>('separate');
  const [pdfAllIncludeBarcode, setPdfAllIncludeBarcode] = useState(true);

  const [showReports, setShowReports] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const [verifiedDoc, setVerifiedDoc] = useState<any | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Camera capture states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Scanner integration states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<'idle' | 'searching' | 'connecting' | 'connected' | 'scanning_adf' | 'scanning_flatbed' | 'success' | 'error'>('idle');
  const [detectedScanners, setDetectedScanners] = useState<string[]>([
    'Canon imageFORMULA DR-C230 (High Speed ADF)',
    'Fujitsu ScanSnap iX1600',
    'HP LaserJet MFP (WIA)'
  ]);
  const [selectedScanner, setSelectedScanner] = useState<string>('Canon imageFORMULA DR-C230 (High Speed ADF)');
  const [scanSource, setScanSource] = useState<'adf' | 'flatbed'>('adf');
  const [scanColorMode, setScanColorMode] = useState<'color' | 'gray' | 'bw'>('color');
  const [scanDpi, setScanDpi] = useState<number>(300);
  const [selectedSamples, setSelectedSamples] = useState<string[]>(['admin', 'saudi', 'board']);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scannerLogs, setScannerLogs] = useState<string[]>([]);
  const [detectedScannersError, setDetectedScannersError] = useState<string | null>(null);
  const [isCheckingScanners, setIsCheckingScanners] = useState(false);
  const [scannerBaseUrl, setScannerBaseUrl] = useState<string>('');
  const [dismissConnectionGuide, setDismissConnectionGuide] = useState<boolean>(false);
  const [customBridgeUrl, setCustomBridgeUrl] = useState<string>('https://127.0.0.1:18623');
  const [useCustomBridge, setUseCustomBridge] = useState<boolean>(false);
  const [dwtErrorDetails, setDwtErrorDetails] = useState<{code: number; message: string; action: string} | null>(null);
  const [isDwtErrorModalOpen, setIsDwtErrorModalOpen] = useState(false);

  // Check URL on mount for Verification Mode & Load Dynamsoft SDK
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vdata = params.get('vdata');
    if (vdata) {
      const decoded = decodeMetadata(vdata);
      if (decoded) {
        setVerifiedDoc(decoded);
      }
    }

    // Load Dynamsoft Web TWAIN script from CDN dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/dwt@18.5.0/dist/dynamsoft.webtwain.min.js';
    script.async = true;
    script.onload = () => {
      console.log('Dynamsoft Web TWAIN SDK loaded successfully.');
    };
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {
        console.error("Failed to remove script:", e);
      }
    };
  }, []);

  // Smart Local Arabic Parsing Engine for 100% Offline Extraction
  const parseArabicDocumentOffline = (text: string, fName?: string) => {
    const cleanText = rejoinArabicLetters(text || "");
    const cleanToLastNumber = (numStr: string): string => {
      if (!numStr) return "";
      return numStr.trim().replace(/^[:：\-=\s\.]+|[:：\-=\s\.]+$/g, "");
    };

    // Smart Filename Parser for 100% Offline fallback
    const parseFromFilename = (name: string) => {
      const clean = String(name || "").replace(/\.[^/.]+$/, "").replace(/_/g, " ").replace(/-/g, " ").trim();
      let docNum = "";
      let docType = "أخرى";
      let docSub = clean;
      let issuingAuth = "جهة إصدار إدارية محلية";
      
      const numMatch = clean.match(/(?:رقم\s*|العدد\s*)?(\d+)/);
      if (numMatch) {
        docNum = numMatch[1];
      }
      
      if (!docNum) {
        const genericMatch = clean.match(/(\d+)/);
        if (genericMatch) {
          docNum = genericMatch[1];
        }
      }
      
      if (clean.includes("تقاعد") || clean.includes("احالة") || clean.includes("إحالة")) {
        docType = "تقاعد";
        docSub = clean.includes("تقاعد") ? clean : `إحالة على التقاعد - ${clean}`;
      } else if (clean.includes("عقوبة") || clean.includes("انذار") || clean.includes("إنذار") || clean.includes("توبيخ") || clean.includes("لفت نظر") || clean.includes("خصم")) {
        docType = "عقوبة";
      } else if (clean.includes("نقل") || clean.includes("تنسيب") || clean.includes("تكليف") || clean.includes("الحاق") || clean.includes("إلحاق")) {
        docType = "نقل وإلحاق";
      } else if (clean.includes("باشر") || clean.includes("مباشرة") || clean.includes("التحاق")) {
        docType = "التحاق";
      } else if (clean.includes("سحب يد") || clean.includes("كف يد") || clean.includes("سحب")) {
        docType = "سحب يد";
      } else if (clean.includes("اجازة") || clean.includes("إجازة")) {
        docType = "إجازة سنوية";
      } else if (clean.includes("وفاة") || clean.includes("وفات")) {
        docType = "وفاة";
      } else if (clean.includes("انفكاك") || clean.includes("انفك")) {
        docType = "تاريخ انفكاك";
      }

      return {
        documentNumber: docNum,
        documentType: docType,
        documentSubject: docSub,
        issuingAuthority: issuingAuth,
        destinationAuthority: "",
        documentContent: ""
      };
    };

    const filenameParsed = parseFromFilename(fName || "");

    // 1. Extract Document Number
    let documentNumber = "";
    const numRegexes = [
      /(?:العدد|الرقم|رقم|الإشارة|العدد\/|الرقم\/)\s*[:：\-=\s]*([^\s\n\/]+(?:\/[^\s\n\/]+)*)/i,
      /(?:صادر|وارد)\s*(?:رقم|العدد)\s*[:：\-=\s]*([^\s\n\/]+(?:\/[^\s\n\/]+)*)/i,
      /([a-z0-9أ-يآإأؤئ]+[\/\-][a-z0-9أ-يآإأؤئ\/\-]+)/i
    ];
    
    for (const r of numRegexes) {
      const match = cleanText.match(r);
      if (match && match[1]) {
        documentNumber = match[1].trim();
        break;
      }
    }
    documentNumber = cleanToLastNumber(documentNumber);
    if (!documentNumber) {
      const fileNumMatch = (fName || "").match(/(\d+)/);
      if (fileNumMatch) documentNumber = fileNumMatch[1];
    }
    if (!documentNumber) {
      documentNumber = filenameParsed.documentNumber || String(Math.floor(Math.random() * 900) + 100);
    }

    // 2. Extract Date
    let documentDate = "";
    const dateRegexes = [
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(\d{1,2}\s+(?:كانون|شباط|آذار|نيسان|أيار|حزيران|تموز|آب|أيلول|تشرين|رمضان|شوال|ذو|محرم|صفر|ربيع|جمادى|رجب|شعبان)\s+\d{2,4})/i,
      /(?:التاريخ|تاريخ)\s*[:：\-=\s]*([^\s\n]+(?:\s+[^\s\n]+){0,2})/i
    ];
    
    for (const r of dateRegexes) {
      const match = cleanText.match(r);
      if (match && match[1]) {
        documentDate = match[1].trim();
        break;
      }
    }
    if (!documentDate) {
      documentDate = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
    }

    // 3. Extract Issuing Authority
    let issuingAuthority = "";
    const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const authorityKeywords = ["وزارة", "جمهورية", "جامعة", "شركة", "مديرية", "هيئة", "رئاسة", "ديوان", "مجلس", "دائرة"];
    
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const line = lines[i];
      if (authorityKeywords.some(keyword => line.includes(keyword))) {
        issuingAuthority = line;
        break;
      }
    }
    if (!issuingAuthority) {
      issuingAuthority = filenameParsed.issuingAuthority || "جهة إصدار إدارية محلية";
    }

    // 4. Extract Subject
    let documentSubject = "";
    const subjectRegexes = [
      /(?:الموضوع|م\/|شأن|عنوان|المضمون)\s*[:：\-=\s]*([^\n]+)/i,
      /أمر إداري رقم\s*\(\s*\d+\s*\)\s*([^\n]+)/i,
      /قرار رقم\s*\(\s*\d+\s*\)\s*([^\n]+)/i
    ];
    for (const r of subjectRegexes) {
      const match = cleanText.match(r);
      if (match && match[1]) {
        documentSubject = match[1].trim();
        break;
      }
    }
    if (!documentSubject) {
      if (lines.length > 3) {
        documentSubject = lines[Math.min(4, lines.length - 1)];
      } else {
        documentSubject = filenameParsed.documentSubject || (fName ? fName.replace(/\.[^/.]+$/, "").replace(/_/g, " ") : "كتاب إداري غير معنون");
      }
    }

    // 4b. Extract Destination Authority
    let destinationAuthority = "";
    const destRegexes = [
      /(?:إلى|الى)\s*[\/\\]?\s*([^\n]+)/i,
      /الجهة الموجه إليها\s*[:：\-=\s]*([^\n]+)/i
    ];
    for (const r of destRegexes) {
      const match = cleanText.match(r);
      if (match && match[1]) {
        destinationAuthority = match[1].trim();
        break;
      }
    }

    // 4c. Basic Document Content (just use the cleanText minus standard headers)
    let documentContent = cleanText;
    const contentStartMatch = cleanText.match(/(?:الموضوع|م\/)[^\n]*\n([\s\S]*)/i);
    if (contentStartMatch && contentStartMatch[1]) {
      documentContent = contentStartMatch[1].trim();
    }

    // 5. Classify Document Type
    let documentType = "أخرى";
    const typeKeywords: Record<string, string[]> = {
      "تقاعد": ["تقاعد", "إحالة", "الملاك التقاعدي", "حقوق تقاعدية", "راتب تقاعدي", "السن القانوني"],
      "عقوبة": ["عقوبة", "لفت نظر", "إنذار", "توبيخ", "قطع راتب", "خصم", "تنزيل درجة", "مخالفة مسلكية", "انضباط"],
      "نقل وإلحاق": ["نقل", "تنسيب", "تكليف", "إلحاق", "نقل خدمات"],
      "التحاق": ["باشر", "مباشرة", "التحاق", "مباشرة عمل", "مباشرة الوظيفة"],
      "سحب يد": ["سحب يد", "كف يد", "كف اليد", "سحب اليد"],
      "إجازة سنوية": ["إجازة", "اجازة", "سنوية", "مرضية", "أمومة", "بدون راتب"],
      "وفاة": ["وفاة", "metowfey", "متوفى", "وفاتة", "إنهاء خدمة لوفاة"],
      "تاريخ انفكاك": ["انفكاك", "انفك", "تاريخ الانفكاك", "الانفكاك"]
    };

    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(keyword => cleanText.includes(keyword))) {
        documentType = type;
        break;
      }
    }

    // 6. Extract Penalties
    let penaltyType = "";
    let legalArticle = "";
    let penaltyReason = "";
    let penaltyDuration = "";

    if (documentType === "عقوبة") {
      const penaltyTypes = ["لفت نظر", "إنذار", "توبيخ", "قطع راتب", "خصم من الراتب", "تنزيل درجة"];
      for (const p of penaltyTypes) {
        if (cleanText.includes(p)) {
          penaltyType = p;
          break;
        }
      }
      
      const legalMatch = cleanText.match(/(?:مادة|المادة|فقرة|الفقرة|قانون)\s+(\d+|[أ-ي]+)\s*(?:من|بموجب)?\s*([^\n،,.]+)/i);
      legalArticle = legalMatch ? legalMatch[0].trim() : "قانون انضباط موظفي الدولة والقطاع العام رقم ١٤ لسنة ١٩٩١";

      const reasonMatch = cleanText.match(/(?:بسبب|نظراً لـ|لقيامه بـ|إثر المخالفة المتمثلة|لعدم|بسبب قيامه|إثر)\s+([^\n،,.]+)/i);
      penaltyReason = reasonMatch ? reasonMatch[1].trim() : "مخالفة الواجبات والتعليمات الإدارية الصادرة";

      const durationMatch = cleanText.match(/(?:لمدة|مدتها)\s+(\d+\s+(?:أيام|يوم|أسبوع|أسابيع|شهر|أشهر|سنة|سنوات))/i);
      penaltyDuration = durationMatch ? durationMatch[1].trim() : "";
    }

    // 7. Extract references
    const references: any[] = [];
    const refRegex = /(?:كتاب|القرار|الأمر)\s+(?:المرقم|رقم)\s+([^\s\n\/]+(?:\/[^\s\n\/]+)*)/gi;
    let refMatch;
    let count = 0;
    while ((refMatch = refRegex.exec(cleanText)) !== null && count < 3) {
      references.push({
        referenceNumber: cleanToLastNumber(refMatch[1]),
        referenceDate: "غير محدد",
        referenceAuthority: "جهة مشار إليها"
      });
      count++;
    }

    // 8. Other letters
    let hrLetterNumber = "";
    let hrLetterDate = "";
    const hrMatch = cleanText.match(/(?:مديرية الموارد البشرية|كتاب الموارد البشرية)\s+(?:المرقم|رقم)\s+([^\s\n\/]+(?:\/[^\s\n\/]+)*)/i);
    if (hrMatch) {
      hrLetterNumber = cleanToLastNumber(hrMatch[1]);
    }
    
    let securityLetterNumber = "";
    let securityLetterDate = "";
    const secMatch = cleanText.match(/(?:وكالة الأمن الاتحادي|كتاب الأمن الاتحادي)\s+(?:المرقم|رقم)\s+([^\s\n\/]+(?:\/[^\s\n\/]+)*)/i);
    if (secMatch) {
      securityLetterNumber = cleanToLastNumber(secMatch[1]);
    }

    return {
      documentNumber,
      documentDate,
      issuingAuthority,
      destinationAuthority,
      documentSubject,
      documentContent,
      confidenceScore: 80,
      extractedText: cleanText,
      documentType,
      references,
      penaltyType,
      legalArticle,
      penaltyReason,
      penaltyDuration,
      hrLetterNumber,
      hrLetterDate,
      securityLetterNumber,
      securityLetterDate
    };
  };

  // Trigger Scanner Probe on Modal open
  useEffect(() => {
    if (isScannerOpen) {
      detectLocalScanners();
    }
  }, [isScannerOpen]);

  // Initialize with some sample notifications or default empty state
  const selectedDoc = documents.find(doc => doc.id === selectedDocId) || null;

  // Update QR Code whenever selectedDoc changes or is modified
  useEffect(() => {
    if (selectedDoc && selectedDoc.status === 'success') {
      const verificationUrl = encodeMetadata(selectedDoc);
      QRCode.toDataURL(verificationUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#0f0f0f',
          light: '#ffffff',
        },
      })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('Failed to generate QR Code:', err));
    } else {
      setQrCodeUrl('');
    }
  }, [
    selectedDoc?.id,
    selectedDoc?.documentNumber,
    selectedDoc?.documentDate,
    selectedDoc?.issuingAuthority,
    selectedDoc?.documentSubject,
    selectedDoc?.documentType,
    selectedDoc?.penaltyType,
    selectedDoc?.legalArticle,
    selectedDoc?.penaltyReason,
    selectedDoc?.penaltyDuration,
    selectedDoc?.status
  ]);

  // Auto-select the first document when a new one is successfully added
  useEffect(() => {
    if (documents.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  // Statistics calculation
  const getStats = (): ExtractionStats => {
    const total = documents.length;
    const processing = documents.filter(d => d.status === 'processing').length;
    const success = documents.filter(d => d.status === 'success').length;
    const error = documents.filter(d => d.status === 'error').length;
    
    const successfulDocs = documents.filter(d => d.status === 'success');
    const avgConfidence = successfulDocs.length > 0
      ? Math.round(successfulDocs.reduce((acc, curr) => acc + curr.confidenceScore, 0) / successfulDocs.length)
      : 0;

    return { total, processing, success, error, avgConfidence };
  };

  const stats = getStats();

  // Handle Drag & Drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Start Camera Stream
  const startCamera = async (deviceId?: string) => {
    setIsCameraLoading(true);
    setCameraError(null);
    setCapturedPhotoUrl(null);
    setIsCameraOpen(true);

    // Stop current stream if any
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: { ideal: "environment" } }
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr: any) {
        console.warn('Camera failed with specified constraints, trying generic video constraints...', firstErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (secondErr: any) {
          throw secondErr;
        }
      }

      setCameraStream(stream);
      
      // Delay slightly to ensure video element is bound
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);

      // Enumerate other devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInps = devices.filter(d => d.kind === 'videoinput');
      setVideoDevices(videoInps);

      // Try to detect active device ID
      const activeTrack = stream.getVideoTracks()[0];
      if (activeTrack) {
        const settings = activeTrack.getSettings();
        if (settings.deviceId) {
          setSelectedVideoDeviceId(settings.deviceId);
        }
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('تم رفض إذن الوصول للكاميرا. يرجى تفعيل الإذن من إعدادات المتصفح أو فتح التطبيق في نافذة مستقلة (خارج الـ iframe).');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('لم يتم العثور على كاميرا متصلة بجهازك.');
      } else {
        setCameraError('فشل تشغيل الكاميرا (قد تكون مستخدمة في تطبيق آخر أو تواجه قيود أمان ضمن إطار المعاينة iframe). يرجى فتح التطبيق في نافذة مستقلة لتجاوز هذه القيود.');
      }
    } finally {
      setIsCameraLoading(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setCapturedPhotoUrl(null);
    setCameraError(null);
  };

  // Capture Photo
  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    // Set canvas dimensions to match the actual stream resolution
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedPhotoUrl(dataUrl);
    }
  };

  // Ingest captured image to pipeline
  const ingestCapturedImage = (dataUrl: string) => {
    setShowResults(true);
    const id = safeRandomUUID();
    const base64Data = dataUrl.split(',')[1];
    const mimeType = 'image/jpeg';
    
    // Size estimation in KB
    const sizeInKb = Math.round((base64Data.length * 3) / 4 / 1024);
    
    const now = new Date();
    const timeStr = `${now.getHours()}_${now.getMinutes()}_${now.getSeconds()}`;
    const fileName = `لقطة_كاميرا_${timeStr}.jpg`;

    const record: DocumentRecord = {
      id,
      fileName,
      fileSize: `${sizeInKb} كيلوبايت`,
      imageUrl: dataUrl,
      base64Data,
      mimeType,
      status: 'idle',
      documentNumber: '',
      documentDate: '',
      issuingAuthority: '',
      documentSubject: '',
      confidenceScore: 0,
      extractedText: '',
      documentType: 'أخرى',
      references: [],
      penaltyType: '',
      legalArticle: '',
      penaltyReason: '',
      penaltyDuration: ''
    };

    setDocuments(prev => [record, ...prev]);
    saveDocToFirestore(record);
    extractMetadata(id, base64Data, mimeType, fileName);
  };

  // Confirm and save captured photo
  const confirmCapturedPhoto = () => {
    if (capturedPhotoUrl) {
      ingestCapturedImage(capturedPhotoUrl);
      stopCamera();
    }
  };

  // Detect Local Physical Scanners (TWAIN/WIA)
  const detectLocalScanners = async () => {
    setIsCheckingScanners(true);
    setDetectedScannersError(null);
    setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] جاري محاولة الربط الحقيقي مع تعريف (Driver) جهاز Canon DR-C230...`]);
    setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] جاري فحص تطبيق Dynamic Web TWAIN والبرامج الوسيطة على المنافذ 18622، 18623، 18625، 18626...`]);
    
    try {
      // 1. Try scanning detection via native Dynamsoft Web TWAIN SDK if available
      if ((window as any).Dynamsoft) {
        setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] جاري الاستعلام عبر مكتبة Dynamsoft Web TWAIN SDK الرسمية...`]);
        try {
          const sdkScanners = await new Promise<string[]>((resolve, reject) => {
            const Dynamsoft = (window as any).Dynamsoft;
            const dwtNamespace = Dynamsoft.DWT || Dynamsoft.WebTwainEnv || Dynamsoft;
            if (!dwtNamespace) {
              reject(new Error('مكتبة Dynamsoft SDK غير متوفرة بشكل صحيح في نظام التشغيل.'));
              return;
            }
            dwtNamespace.ResourcesPath = 'https://cdn.jsdelivr.net/npm/dwt@18.5.0/dist/';
            
            const onSuccess = (dwObject: any) => {
              try {
                const count = dwObject.SourceCount;
                const list: string[] = [];
                for (let i = 0; i < count; i++) {
                  const name = dwObject.GetSourceNameItems(i);
                  if (name) list.push(name);
                }
                resolve(list);
              } catch (err) {
                reject(err);
              }
            };
            
            const onFailure = (errCode: number, errString: string) => {
              reject(new Error(`فشل الاتصال بالخدمة المحلية عبر SDK: ${errString} (كود: ${errCode})`));
            };

            if (typeof dwtNamespace.CreateWebTwainEx === 'function') {
              dwtNamespace.CreateWebTwainEx(
                { WebTwainId: 'dwt_detect_scanners' },
                onSuccess,
                (errString: string) => onFailure(-1, errString)
              );
            } else if (typeof dwtNamespace.CreateWebTwain === 'function') {
              dwtNamespace.CreateWebTwain(
                'dwt_detect_scanners',
                onSuccess,
                (errString: string) => onFailure(-1, errString)
              );
            } else if (typeof dwtNamespace.CreatePhysicalObjectAsync === 'function') {
              dwtNamespace.CreatePhysicalObjectAsync({
                OnSuccess: onSuccess,
                OnFailure: onFailure
              });
            } else {
              onFailure(-2, 'لا تتوفر دالة تهيئة مناسبة في Dynamsoft Web TWAIN.');
            }
          });

          if (sdkScanners && sdkScanners.length > 0) {
            setScannerLogs(prev => [
              ...prev,
              `[${new Date().toLocaleTimeString('ar-EG')}] تم الاتصال بنجاح عبر مكتبة SDK الرسمية.`,
              `[${new Date().toLocaleTimeString('ar-EG')}] تم العثور على أجهزة ماسح ضوئي حقيقية: [${sdkScanners.join(', ')}]`
            ]);
            setDetectedScanners(prev => {
              const uniqueNew = sdkScanners.filter(s => !prev.includes(s));
              return [...uniqueNew, ...prev];
            });
            const targetScanner = sdkScanners.find((s: string) => s.includes('DR-C230') || s.toLowerCase().includes('canon')) || sdkScanners[0];
            setSelectedScanner(targetScanner);
            setScannerBaseUrl('SDK_ACTIVE');
            setIsCheckingScanners(false);
            return;
          }
        } catch (sdkErr: any) {
          setScannerLogs(prev => [
            ...prev,
            `[${new Date().toLocaleTimeString('ar-EG')}] لم تنجح طريقة SDK المباشرة (ربما الخدمة غير مفعلة أو لم تقبل شهادة الأمان بعد): ${sdkErr.message || sdkErr}`
          ]);
          // Continue to fallback endpoints
        }
      }

      const customEndpoints = [];
      if (customBridgeUrl && customBridgeUrl.trim()) {
        const base = customBridgeUrl.trim().replace(/\/$/, '');
        customEndpoints.push(
          { url: `${base}/DWT_Control/device/scanners`, label: `رابط مخصص: ${base} (Dynamsoft)` },
          { url: `${base}/device/scanners`, label: `رابط مخصص: ${base} (Alt)` },
          { url: `${base}/api/scanners`, label: `رابط مخصص: ${base} (API)` },
          { url: `${base}/scanners`, label: `رابط مخصص: ${base}` }
        );
      }

      // Standard TWAIN/WIA Cloud Bridge Ports and Dynamsoft ports
      // We probe Dynamsoft REST API paths on localhost HTTP & HTTPS
      const endpoints = [
        ...customEndpoints,
        // Support ports 18625 / 18626 (Dynamsoft v17+)
        { url: "https://localhost.dynamsoft.com:18626/DWT_Control/device/scanners", label: "Dynamic Web TWAIN (HTTPS Local Domain 18626)" },
        { url: "https://127.0.0.1:18626/DWT_Control/device/scanners", label: "Dynamic Web TWAIN (HTTPS IP Local 18626)" },
        { url: "http://127.0.0.1:18625/DWT_Control/device/scanners", label: "Dynamic Web TWAIN (HTTP IP Local 18625)" },
        { url: "http://localhost:18625/DWT_Control/device/scanners", label: "Dynamic Web TWAIN (HTTP Localhost 18625)" },
        { url: "https://localhost.dynamsoft.com:18626/device/scanners", label: "Dynamic Web TWAIN (HTTPS Local Alternate 18626)" },
        { url: "https://127.0.0.1:18626/device/scanners", label: "Dynamic Web TWAIN (HTTPS IP Alternate 18626)" },
        { url: "http://127.0.0.1:18625/device/scanners", label: "Dynamic Web TWAIN (HTTP IP Alternate 18625)" },
        { url: "http://localhost:18625/device/scanners", label: "Dynamic Web TWAIN (HTTP Localhost Alternate 18625)" },
        
        // Support ports 18622 / 18623 (Dynamsoft older versions/custom setups as shown in user's configuration)
        { url: "https://localhost.dynamsoft.com:18623/DWT_Control/device/scanners", label: "Dynamic Web TWAIN (HTTPS Local Domain 18623)" },
        { url: "https://127.0.0.1:18623/DWT_Control/device/scanners", label: "Dynamic Web TWAIN (HTTPS IP Local 18623)" },
        { url: "http://127.0.0.1:18622/DWT_Control/device/scanners", label: "Dynamic Web TWAIN (HTTP IP Local 18622)" },
        { url: "http://localhost:18622/DWT_Control/device/scanners", label: "Dynamic Web TWAIN (HTTP Localhost 18622)" },
        { url: "https://localhost.dynamsoft.com:18623/device/scanners", label: "Dynamic Web TWAIN (HTTPS Local Alternate 18623)" },
        { url: "https://127.0.0.1:18623/device/scanners", label: "Dynamic Web TWAIN (HTTPS IP Alternate 18623)" },
        { url: "http://127.0.0.1:18622/device/scanners", label: "Dynamic Web TWAIN (HTTP IP Alternate 18622)" },
        { url: "http://localhost:18622/device/scanners", label: "Dynamic Web TWAIN (HTTP Localhost Alternate 18622)" },

        // Generic TWAIN bridge fallbacks
        { url: "http://localhost:11333/api/scanners", label: "Generic Scanner Bridge (Port 11333)" },
        { url: "http://localhost:11334/api/scanners", label: "Generic Scanner Bridge (Port 11334)" },
        { url: "http://localhost:11335/api/scanners", label: "Generic Scanner Bridge (Port 11335)" }
      ];

      let found = false;

      for (const endpoint of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);
          
          const response = await fetch(endpoint.url, { 
            signal: controller.signal,
            mode: 'cors'
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            
            // Dynamsoft or generic scanners parser
            let scannersList: string[] = [];
            
            if (Array.isArray(data)) {
              scannersList = data.map((s: any) => s.name || s.displayName || s.deviceName || (typeof s === 'string' ? s : '')).filter(Boolean);
            } else if (data && Array.isArray(data.scanners)) {
              scannersList = data.scanners.map((s: any) => s.name || s.displayName || s.deviceName || s).filter(Boolean);
            } else if (data && typeof data === 'object') {
              // Try to find any array property (e.g. data.scanners, data.devices)
              for (const key of Object.keys(data)) {
                if (Array.isArray(data[key])) {
                  scannersList = data[key].map((s: any) => s.name || s.displayName || s.deviceName || (typeof s === 'string' ? s : '')).filter(Boolean);
                  break;
                }
              }
            }

            // If we found the service, we log it!
            setScannerLogs(prev => [
              ...prev, 
              `[${new Date().toLocaleTimeString('ar-EG')}] تم الاتصال بنجاح ببرنامج الخدمة الوسيط: ${endpoint.label}`
            ]);

            // Save the base URL of this scanner endpoint so we can scan from it later
            setScannerBaseUrl(endpoint.url.replace(/\/device\/scanners$/, '').replace(/\/scanners$/, '').replace(/\/api\/scanners$/, ''));

            if (scannersList && scannersList.length > 0) {
              // Ensure we combine found scanners with old defaults as per "عدم تغيير السلاسل الموجودة في الكد النموذج"
              setDetectedScanners(prev => {
                const uniqueNew = scannersList.filter(s => !prev.includes(s));
                return [...uniqueNew, ...prev];
              });

              // Select DR-C230 if present, or any other real scanner
              const targetScanner = scannersList.find((s: string) => s.includes('DR-C230') || s.toLowerCase().includes('canon')) || scannersList[0];
              setSelectedScanner(targetScanner);

              setScannerLogs(prev => [
                ...prev,
                `[${new Date().toLocaleTimeString('ar-EG')}] تم العثور على أجهزة ماسح ضوئي حقيقية: [${scannersList.join(', ')}]`,
                `[${new Date().toLocaleTimeString('ar-EG')}] تم اختيار الجهاز النشط تلقائياً: ${targetScanner}`
              ]);
              found = true;
              break;
            } else {
              // Bridge is active but no physical device connected yet
              setScannerLogs(prev => [
                ...prev,
                `[${new Date().toLocaleTimeString('ar-EG')}] برنامج الخدمة الوسيط متصل بنجاح، ولكن لم يُعثر على أجهزة ماسح متصلة سلكياً (USB). تأكد من تشغيل وتوصيل جهاز Canon DR-C230 بالحاسبة.`
              ]);
              
              // Still mark as found because bridge is responding!
              found = true;
              break;
            }
          }
        } catch (e) { 
          // Continue trying other endpoints
          continue; 
        }
      }
      
      if (found) {
        setIsCheckingScanners(false);
        return;
      }
    } catch (e) {
      console.log("Scanner bridge check error:", e);
    }

    setTimeout(() => {
      setIsCheckingScanners(false);
      setScannerLogs(prev => [
        ...prev, 
        `[${new Date().toLocaleTimeString('ar-EG')}] لم يُكشف عن منفذ TWAIN محلي نشط (برنامج الخدمة الوسيط Dynamic Web TWAIN غير مفعل أو غير مثبت حالياً).`,
        `[${new Date().toLocaleTimeString('ar-EG')}] يرجى تنزيل وتشغيل "Dynamsoft Service" على منفذ 18625 أو 18622 للتوصيل الحقيقي والتحقق من التوصيل السلكي.`
      ]);
    }, 800);
  };

  // Open official Dynamsoft "Select Source" dialog
  const openSDKSelectSourceDialog = async () => {
    if (!(window as any).Dynamsoft) {
      alert('مكتبة Dynamsoft SDK غير محملة بعد، يرجى الانتظار أو التحقق من التثبيت.');
      return;
    }
    setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] جاري فتح نافذة اختيار الماسحات الضوئية الرسمية (Select Source)...`]);
    try {
      const Dynamsoft = (window as any).Dynamsoft;
      const dwtNamespace = Dynamsoft.DWT || Dynamsoft.WebTwainEnv || Dynamsoft;
      if (!dwtNamespace) {
        throw new Error('مكتبة Dynamsoft SDK غير متوفرة بشكل صحيح.');
      }
      dwtNamespace.ResourcesPath = 'https://cdn.jsdelivr.net/npm/dwt@18.5.0/dist/';

      const onSuccess = (dwObject: any) => {
        dwObject.SelectSource(
          () => {
            const selectedName = dwObject.CurrentSourceName;
            if (selectedName) {
              setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] تم تحديد الجهاز بنجاح: ${selectedName}`]);
              setDetectedScanners(prev => {
                if (!prev.includes(selectedName)) {
                  return [selectedName, ...prev];
                }
                return prev;
              });
              setSelectedScanner(selectedName);
              setScannerBaseUrl('SDK_ACTIVE');
            } else {
              setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] تم إلغاء اختيار الماسح أو لم يتم تحديد أي جهاز.`]);
            }
          },
          (errCode: number, errString: string) => {
            setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] فشل أو تم إلغاء اختيار الماسح: ${errString}`]);
          }
        );
      };

      const onFailure = (errCode: number, errString: string) => {
        setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] فشل تهيئة نافذة اختيار الماسحات: ${errString}`]);
        setDwtErrorDetails({ code: errCode, message: errString, action: 'select_source' });
        setIsDwtErrorModalOpen(true);
      };

      if (typeof dwtNamespace.CreateWebTwainEx === 'function') {
        dwtNamespace.CreateWebTwainEx(
          { WebTwainId: 'dwt_select_source' },
          onSuccess,
          (errString: string) => onFailure(-1, errString)
        );
      } else if (typeof dwtNamespace.CreateWebTwain === 'function') {
        dwtNamespace.CreateWebTwain(
          'dwt_select_source',
          onSuccess,
          (errString: string) => onFailure(-1, errString)
        );
      } else if (typeof dwtNamespace.CreatePhysicalObjectAsync === 'function') {
        dwtNamespace.CreatePhysicalObjectAsync({
          OnSuccess: onSuccess,
          OnFailure: onFailure
        });
      } else {
        onFailure(-2, 'لا تتوفر دالة تهيئة مناسبة في Dynamsoft Web TWAIN.');
      }
    } catch (err: any) {
      setDwtErrorDetails({ code: 0, message: err.message || err, action: 'select_source_catch' });
      setIsDwtErrorModalOpen(true);
    }
  };

  // Start Scanner Action (ADF Feeder / Flatbed Simulation & File Ingestion)
  const startScannerAction = async () => {
    if (!scannerBaseUrl) {
      setDwtErrorDetails({ 
        code: 404, 
        message: 'لا يمكن البدء بعملية السحب المباشر؛ برنامج الخدمة المحلية (Dynamsoft Service) غير متصل أو لم يُعثر على جهاز سكنر حقيقي. يرجى مراجعة إرشادات التوصيل بالأسفل والتحقق من تشغيل وربط الجهاز.', 
        action: 'start_scan_no_bridge' 
      });
      setIsDwtErrorModalOpen(true);
      return;
    }

    if (scannerBaseUrl === 'SDK_ACTIVE') {
      // REAL PHYSICAL DEVICE SCAN VIA DYNAMSOFT JS SDK
      setScannerStatus('connecting');
      setScanProgress(5);
      setScannerLogs([
        `[${new Date().toLocaleTimeString('ar-EG')}] جاري تهيئة الاتصال بالماسح المختار عبر Dynamsoft SDK: ${selectedScanner}...`,
        `[${new Date().toLocaleTimeString('ar-EG')}] جاري تشغيل وإرسال إعدادات المسح الضوئي...`
      ]);

      try {
        const Dynamsoft = (window as any).Dynamsoft;
        const dwtNamespace = Dynamsoft.DWT || Dynamsoft.WebTwainEnv || Dynamsoft;
        if (!dwtNamespace) {
          throw new Error('مكتبة Dynamsoft SDK غير متوفرة بشكل صحيح.');
        }
        dwtNamespace.ResourcesPath = 'https://cdn.jsdelivr.net/npm/dwt@18.5.0/dist/';
        
        const onSuccess = (dwObject: any) => {
            try {
              // Find scanner index
              let sourceIndex = -1;
              const count = dwObject.SourceCount;
              for (let i = 0; i < count; i++) {
                if (dwObject.GetSourceNameItems(i) === selectedScanner) {
                  sourceIndex = i;
                  break;
                }
              }

              if (sourceIndex === -1) {
                // If not found by exact name, search by partial name
                for (let i = 0; i < count; i++) {
                  if (dwObject.GetSourceNameItems(i).toLowerCase().includes(selectedScanner.toLowerCase()) || 
                      selectedScanner.toLowerCase().includes(dwObject.GetSourceNameItems(i).toLowerCase())) {
                    sourceIndex = i;
                    break;
                  }
                }
              }

              if (sourceIndex === -1 && count > 0) {
                sourceIndex = 0; // fallback to first device
              }

              if (sourceIndex !== -1) {
                dwObject.SelectSourceByIndex(sourceIndex);
              } else {
                throw new Error('الماسح الضوئي المختار غير متصل أو غير متوفر.');
              }

              dwObject.OpenSource();
              
              // Apply configurations
              dwObject.IfShowUI = false;
              dwObject.PixelType = scanColorMode === 'color' ? 2 : scanColorMode === 'gray' ? 1 : 0;
              dwObject.Resolution = scanDpi;
              dwObject.IfFeederEnabled = scanSource === 'adf';
              dwObject.IfDuplex = false;

              setScannerStatus(scanSource === 'adf' ? 'scanning_adf' : 'scanning_flatbed');
              setScanProgress(30);
              setScannerLogs(prev => [
                ...prev,
                `[${new Date().toLocaleTimeString('ar-EG')}] تم فتح قناة الاتصال بنجاح. بدء التغذية والمسح الميكانيكي...`
              ]);

              dwObject.AcquireImage(
                async () => {
                  // OnSuccess
                  const howMany = dwObject.HowManyImagesInBuffer;
                  if (howMany === 0) {
                    throw new Error('اكتملت عملية المسح ولكن لم يُعثر على أوراق مسحوبة في صينية الإدخال.');
                  }

                  setScanProgress(80);
                  setScannerLogs(prev => [
                    ...prev,
                    `[${new Date().toLocaleTimeString('ar-EG')}] اكتمل المسح بنجاح! تم التقاط (${howMany}) صفحات. جاري التحويل والمعالجة...`
                  ]);

                  const scannedDocs: DocumentRecord[] = [];
                  let processed = 0;

                  const convertPage = (i: number) => {
                    dwObject.GetImageAsBlob(
                      i,
                      3, // PNG format
                      async (blob: Blob) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64data = (reader.result as string).split(',')[1];
                          const imageUrl = URL.createObjectURL(blob);
                          const id = safeRandomUUID();
                          
                          const record: DocumentRecord = {
                            id,
                            fileName: `مسح_سكنر_حقيقي_${i + 1}_${selectedScanner.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                            fileSize: `${Math.round(blob.size / 1024)} KB`,
                            imageUrl,
                            base64Data: base64data,
                            mimeType: 'image/png',
                            status: 'idle',
                            documentNumber: '',
                            documentDate: '',
                            issuingAuthority: '',
                            documentSubject: '',
                            confidenceScore: 0,
                            extractedText: '',
                            documentType: 'أخرى',
                            references: [],
                            penaltyType: '',
                            legalArticle: '',
                            penaltyReason: '',
                            penaltyDuration: ''
                          };
                          
                          scannedDocs.push(record);
                          processed++;

                          if (processed === howMany) {
                            setScanProgress(100);
                            setShowResults(true);
                            setDocuments(prev => [...scannedDocs, ...prev]);
                            scannedDocs.forEach(doc => {
                              saveDocToFirestore(doc);
                              extractMetadata(doc.id, doc.base64Data, doc.mimeType, doc.fileName);
                            });

                            setScannerStatus('success');
                            setTimeout(() => {
                              setIsScannerOpen(false);
                              setScannerStatus('idle');
                            }, 1200);
                          } else {
                            convertPage(i + 1);
                          }
                        };
                        reader.readAsDataURL(blob);
                      },
                      (errCode: number, errString: string) => {
                        setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] خطأ أثناء تحويل الصفحة ${i + 1}: ${errString}`]);
                        processed++;
                        if (processed === howMany) {
                          if (scannedDocs.length > 0) {
                            setScanProgress(100);
                            setShowResults(true);
                            setDocuments(prev => [...scannedDocs, ...prev]);
                            scannedDocs.forEach(doc => {
                              saveDocToFirestore(doc);
                              extractMetadata(doc.id, doc.base64Data, doc.mimeType, doc.fileName);
                            });
                            setScannerStatus('success');
                          } else {
                            setScannerStatus('idle');
                            alert('فشل استخراج الصفحات الممسوحة ضوئياً.');
                          }
                        } else {
                          convertPage(i + 1);
                        }
                      }
                    );
                  };

                  convertPage(0);
                },
                (errCode: number, errString: string) => {
                  setScannerStatus('idle');
                  setScannerLogs(prev => [
                    ...prev,
                    `[${new Date().toLocaleTimeString('ar-EG')}] فشل المسح الضوئي من الجهاز: ${errString} (كود: ${errCode})`
                  ]);
                  alert(`فشل المسح الضوئي: ${errString}`);
                }
              );
            } catch (innerErr: any) {
              setScannerStatus('idle');
              setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] خطأ: ${innerErr.message || innerErr}`]);
              setDwtErrorDetails({ code: 0, message: innerErr.message || innerErr, action: 'start_scan_inner' });
              setIsDwtErrorModalOpen(true);
            }
        };

        const onFailure = (errCode: number, errString: string) => {
          setScannerStatus('idle');
          setScannerLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] فشل تشغيل مكتبة TWAIN: ${errString}`]);
          setDwtErrorDetails({ code: errCode, message: errString, action: 'start_scan_onfailure' });
          setIsDwtErrorModalOpen(true);
        };

        if (typeof dwtNamespace.CreateWebTwainEx === 'function') {
          dwtNamespace.CreateWebTwainEx(
            { WebTwainId: 'dwt_scan_action' },
            onSuccess,
            (errString: string) => onFailure(-1, errString)
          );
        } else if (typeof dwtNamespace.CreateWebTwain === 'function') {
          dwtNamespace.CreateWebTwain(
            'dwt_scan_action',
            onSuccess,
            (errString: string) => onFailure(-1, errString)
          );
        } else if (typeof dwtNamespace.CreatePhysicalObjectAsync === 'function') {
          dwtNamespace.CreatePhysicalObjectAsync({
            OnSuccess: onSuccess,
            OnFailure: onFailure
          });
        } else {
          onFailure(-2, 'لا تتوفر دالة تهيئة مناسبة في Dynamsoft Web TWAIN.');
        }
      } catch (err: any) {
        setScannerStatus('idle');
        setDwtErrorDetails({ code: 0, message: err.message || err, action: 'start_scan_outer' });
        setIsDwtErrorModalOpen(true);
      }
    } else {
      // REAL PHYSICAL DEVICE SCAN VIA DYNAMSOFT API
      setScannerStatus('connecting');
      setScanProgress(5);
      setScannerLogs([
        `[${new Date().toLocaleTimeString('ar-EG')}] جاري الاتصال بالماسح الضوئي الحقيقي: ${selectedScanner}...`,
        `[${new Date().toLocaleTimeString('ar-EG')}] إرسال أمر البدء إلى الخدمة المحلية لبرنامج Dynamsoft Service...`
      ]);

      try {
        const createJobResponse = await fetch(`${scannerBaseUrl}/device/scanners/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            license: "TRIAL",
            device: selectedScanner,
            config: {
              IfShowUI: false,
              PixelType: scanColorMode === 'color' ? 2 : scanColorMode === 'gray' ? 1 : 0,
              Resolution: scanDpi,
              IfFeederEnabled: scanSource === 'adf',
              IfDuplex: false
            }
          })
        });

        if (!createJobResponse.ok) {
          throw new Error(`فشل بدء العملية: ${createJobResponse.statusText}`);
        }

        const jobData = await createJobResponse.json();
        const jobId = jobData.jobid || jobData.jobuid || jobData.key || jobData;

        setScannerStatus(scanSource === 'adf' ? 'scanning_adf' : 'scanning_flatbed');
        setScanProgress(30);
        setScannerLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString('ar-EG')}] تم إنشاء مهمة السحب بنجاح. معرف المهمة: ${jobId}`,
          `[${new Date().toLocaleTimeString('ar-EG')}] جاري سحب الأوراق عبر ملقم التغذية الميكانيكي...`
        ]);

        // Poll for scanned pages
        let pageIndex = 0;
        let hasMorePages = true;
        const scannedDocs: DocumentRecord[] = [];

        while (hasMorePages) {
          try {
            // Wait brief moment before next page download
            await new Promise(resolve => setTimeout(resolve, 800));

            const pageResponse = await fetch(`${scannerBaseUrl}/device/scanners/jobs/${jobId}/next-page`);
            
            if (pageResponse.status === 200) {
              const blob = await pageResponse.blob();
              const imageUrl = URL.createObjectURL(blob);
              
              // Read blob to base64
              const reader = new FileReader();
              const base64Data = await new Promise<string>((resolve, reject) => {
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                  const base64String = (reader.result as string).split(',')[1];
                  resolve(base64String);
                };
                reader.onerror = reject;
              });

              pageIndex++;
              setScanProgress(Math.min(30 + pageIndex * 20, 95));
              
              const id = safeRandomUUID();
              const record: DocumentRecord = {
                id,
                fileName: `مسح_سكنر_حقيقي_${pageIndex}_${selectedScanner.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                fileSize: `${Math.round(blob.size / 1024)} KB`,
                imageUrl,
                base64Data,
                mimeType: 'image/png',
                status: 'idle',
                documentNumber: '',
                documentDate: '',
                issuingAuthority: '',
                documentSubject: '',
                confidenceScore: 0,
                extractedText: '',
                documentType: 'أخرى',
                references: [],
                penaltyType: '',
                legalArticle: '',
                penaltyReason: '',
                penaltyDuration: ''
              };

              scannedDocs.push(record);
              setScannerLogs(prev => [
                ...prev,
                `[${new Date().toLocaleTimeString('ar-EG')}] تم استقبال وحفظ الصفحة رقم (${pageIndex}) من جهاز Canon DR-C230 الحقيقي بنجاح.`
              ]);
            } else if (pageResponse.status === 204 || pageResponse.status === 404) {
              // No more pages or scan job finished
              hasMorePages = false;
            } else {
              // Other status code, assume end or minor error
              hasMorePages = false;
            }
          } catch (e) {
            console.error("Error reading scanned page:", e);
            hasMorePages = false;
          }
        }

        // If pages were successfully scanned from real physical device
        if (scannedDocs.length > 0) {
          setScanProgress(100);
          setScannerLogs(prev => [
            ...prev,
            `[${new Date().toLocaleTimeString('ar-EG')}] اكتملت عملية السحب الضوئي الحقيقي بنجاح! تم التقاط (${scannedDocs.length}) صفحة.`,
            `[${new Date().toLocaleTimeString('ar-EG')}] جاري معالجة المستندات وحفظ البيانات وتمريرها لمحرك الذكاء الاصطناعي...`
          ]);

          setTimeout(() => {
            setShowResults(true);
            setDocuments(prev => [...scannedDocs, ...prev]);
            scannedDocs.forEach(doc => {
              saveDocToFirestore(doc);
              extractMetadata(doc.id, doc.base64Data, doc.mimeType, doc.fileName);
            });

            setScannerStatus('success');
            setTimeout(() => {
              setIsScannerOpen(false);
              setScannerStatus('idle');
            }, 1200);
          }, 800);

        } else {
          setScannerLogs(prev => [
            ...prev,
            `[${new Date().toLocaleTimeString('ar-EG')}] لم يُعثر على أوراق في ملقم التغذية للماسح الضوئي الحقيقي (أو تم إلغاء العملية).`,
            `[${new Date().toLocaleTimeString('ar-EG')}] يرجى وضع الأوراق في ملقم ADF وإعادة المحاولة.`
          ]);
          setScannerStatus('idle');
        }

      } catch (err: any) {
        console.error("Real scanner error:", err);
        setScannerLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString('ar-EG')}] فشل بدء سحب الأوراق: ${err.message || err}`
        ]);
        setScannerStatus('idle');
        alert(`فشل بدء السحب الضوئي: ${err.message || err}`);
      }
    }
  };

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Core file processing pipeline
  const processFiles = async (files: FileList) => {
    setShowResults(true);
    const validExtensions = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
    const newRecords: DocumentRecord[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (!extension || !validExtensions.includes(extension)) {
        alert(`الملف "${file.name}" غير مدعوم. يرجى تحميل صور بصيغة PNG أو JPG أو JPEG أو WEBP.`);
        continue;
      }

      try {
        const base64Data = await fileToBase64(file);
        const imageUrl = URL.createObjectURL(file);
        const id = safeRandomUUID();

        const record: DocumentRecord = {
          id,
          fileName: file.name,
          fileSize: `${Math.round(file.size / 1024)} كيلوبايت`,
          imageUrl,
          base64Data,
          mimeType: file.type || 'image/jpeg',
          status: 'idle',
          documentNumber: '',
          documentDate: '',
          issuingAuthority: '',
          documentSubject: '',
          confidenceScore: 0,
          extractedText: '',
          documentType: 'أخرى',
          references: [],
          penaltyType: '',
          legalArticle: '',
          penaltyReason: '',
          penaltyDuration: ''
        };

        newRecords.push(record);
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }

    if (newRecords.length > 0) {
      setDocuments(prev => [...newRecords, ...prev]);
      // Save to Firestore and trigger extraction for each new document
      newRecords.forEach(doc => {
        saveDocToFirestore(doc);
        extractMetadata(doc.id, doc.base64Data, doc.mimeType, doc.fileName);
      });
    }
  };

  // Extract metadata via server API
  const extractMetadata = async (id: string, base64Data: string, mimeType: string, fileName?: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === id) {
        return { ...doc, status: 'processing', error: undefined };
      }
      return doc;
    }));

    if (!isOfflineMode) {
      try {
        updateDoc(doc(db, "documents", id), { status: 'processing', error: null }).catch(err => {
          console.error("Failed to update status to processing in Firestore:", err);
          handleFirestoreError(err, OperationType.UPDATE, `documents/${id}`);
        });
      } catch (e) {
        console.error(e);
        handleFirestoreError(e, OperationType.UPDATE, `documents/${id}`);
      }
    }

    if (isOfflineMode) {
      try {
        setDocuments(prev => prev.map(doc => {
          if (doc.id === id) {
            return { ...doc, ocrProgress: 'بدء تهيئة محرك القراءة الآلية (OCR)...' };
          }
          return doc;
        }));

        const dataUrl = base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${base64Data}`;
        
        console.log("Starting client-side Tesseract.js OCR for offline mode using persistent worker...");
        
        // Setup the dynamic logger callback for our shared worker
        currentOcrLoggerCallback = (m: any) => {
          console.log("OCR Progress:", m);
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            setDocuments(prev => prev.map(doc => {
              if (doc.id === id) {
                return { ...doc, ocrProgress: `جاري قراءة واستخلاص النص: ${pct}%` };
              }
              return doc;
            }));
          } else if (m.status === 'loading language traineddata') {
            setDocuments(prev => prev.map(doc => {
              if (doc.id === id) {
                return { ...doc, ocrProgress: 'جاري تحميل حزمة اللغة العربية (أول مرة)...' };
              }
              return doc;
            }));
          } else if (m.status === 'loading tesseract core') {
            setDocuments(prev => prev.map(doc => {
              if (doc.id === id) {
                return { ...doc, ocrProgress: 'جاري تهيئة محرك القراءة الأساسي...' };
              }
              return doc;
            }));
          }
        };

        const worker = await getSharedTesseractWorker();

        // Wrap the OCR process in a promise that rejects after 20 seconds to prevent any infinite hangs
        const ocrPromise = worker.recognize(dataUrl, 'ara+eng');
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("OCR_TIMEOUT")), 20000);
        });

        let ocrResult: any;
        try {
          ocrResult = await Promise.race([ocrPromise, timeoutPromise]);
        } catch (err: any) {
          console.error("Tesseract OCR execution failed or timed out:", err);
          
          // Self-healing: terminate the locked/stuck worker so a fresh one can be created next time
          if (cachedTesseractWorker) {
            try {
              console.log("Terminating stuck Tesseract worker to free memory and prevent future hangs...");
              await cachedTesseractWorker.terminate();
            } catch (terminateErr) {
              console.error("Failed to terminate worker:", terminateErr);
            }
            cachedTesseractWorker = null;
          }
          
          throw new Error(err.message === "OCR_TIMEOUT" ? "OCR_TIMEOUT" : "OCR_FAILED");
        }

        const rawText = ocrResult.data.text || "";
        const text = rejoinArabicLetters(rawText);
        console.log("OCR Extracted & Cleaned Arabic Text:", text);

        let finalUpdates: any = {};

        if (useOllama) {
          let data: any = null;
          let ollamaErr: any = null;

          // 1. Try connecting directly to local Ollama from the browser (since the browser runs on the user's local PC, it has direct access to localhost!)
          try {
            console.log("Attempting direct browser-to-local-Ollama extraction at:", ollamaUrl);
            const targetUrl = (ollamaUrl || 'http://localhost:11434').replace(/\/$/, "");
            
            const systemPrompt = `أنت خبير محترف ومسؤول أرشيف عراقي وعربي، مهمتك هي التفريغ النصي الحرفي (Transcription) واستخراج البيانات من الصور أو النصوص بدقة متناهية.
ممنوع منعاً باتاً تأليف، أو تخمين، أو إضافة أي كلمة غير موجودة في الصورة أو النص الأصلي. يجب استخراج البيانات بصيغة JSON حصراً مطابقة تماماً للمواصفات التالية:
{
  "documentNumber": "رقم الكتاب الأصلي بالكامل وبدقة فائقة كما هو مكتوب بالوثيقة دون أي اختصار أو حذف لأي جزء أو رمز مائل (مثال: م.أ/123/456)",
  "documentDate": "تاريخ صدور الكتاب الرئيسي بالضبط كما هو مكتوب بالوثيقة دون أي تغيير",
  "issuingAuthority": "الجهة التي أصدرت الكتاب الرسمية المذكورة في ترويسة أو متن الكتاب بالضبط",
  "destinationAuthority": "الجهة الموجه إليها الكتاب (المرسَل إليه) بالضبط كما هو مكتوب",
  "documentSubject": "موضوع الكتاب بكلمات واضحة ودقيقة جداً مطابقة للموضوع الأصلي",
  "documentContent": "التفريغ النصي الحرفي الكامل لمحتوى الكتاب كما هو بالتمام والكمال (كلمة بكلمة من البداية للنهاية). يجب أن يكون النص مطابقاً بنسبة 100% للمستند الأصلي دون أي زيادة، أو نقصان، أو تلخيص، أو تحليل، أو صياغة من عندك.",
  "confidenceScore": 95,
  "documentType": "نوع الوثيقة من: 'تقاعد', 'عقوبة', 'نقل وإلحاق', 'التحاق', 'سحب يد', 'إجازة سنوية', 'وفاة', 'تاريخ انفكاك', 'أخرى'",
  "references": [
    {
      "referenceNumber": "رقم الكتاب/المرجع المذكور في النص بالكامل وبدقة فائقة كما هو مكتوب بالوثيقة بالتمام والكمال",
      "referenceDate": "تاريخ هذا الكتاب المرجعي بالضبط كما هو مكتوب",
      "referenceAuthority": "جهة إصدار هذا الكتاب المرجعي بالضبط كما هو مكتوب"
    }
  ],
  "penaltyType": "نوع العقوبة إن وجدت",
  "legalArticle": "المادة القانونية المستند عليها إن وجدت",
  "penaltyReason": "سبب العقوبة إن وجد",
  "penaltyDuration": "مدة العقوبة إن وجدت",
  "hrLetterNumber": "رقم كتاب الموارد البشرية بالكامل كما هو مكتوب بالوثيقة إن وجد",
  "hrLetterDate": "تاريخ كتاب الموارد البشرية إن وجد",
  "securityLetterNumber": "رقم كتاب وكالة الأمن الاتحادي بالكامل كما هو مكتوب بالوثيقة إن وجد",
  "securityLetterDate": "تاريخ كتاب وكالة الأمن الاتحادي إن وجد",
  "extractedText": "محتوى إضافي لتأكيد صحة النص إذا لزم الأمر، أو اتركه فارغاً"
}
تعليمات صارمة جداً لمنع التزييف أو تخيل نصوص غير موجودة:
1. يُمنع منعاً باتاً اختراع، أو تخمين، أو إضافة أي معلومات، أو نصوص، أو أرقام، أو جهات، أو تواريخ غير موجودة بالوثيقة الأصلية المرفقة بالمرة.
2. لا تقم أبداً بدمج نصوص من وثائق أخرى أو استخدام نصوص وهمية من الذاكرة الخارجية. استخرج فقط النص الحقيقي المكتوب والمطابق للمستند المرفق.
3. يجب كتابة النص الكامل للكتاب في حقل (documentContent) بشكل حرفي مطابق للوثيقة تماماً، دون تلخيص أو شرح أو إضافة أي كلام من عندك.
4. الأرقام والتواريخ يجب أن تنقل نسخاً ولصقاً كما هي مكتوبة في المستند دون أي تغيير.
5. أجب فقط بنص JSON صالح، دون أي كلمات قبل أو بعد القوسين {} ودون استخدام علامات Markdown البرمجية.
6. إذا كانت الصورة غير واضحة أو لا يمكنك قراءة جزء معين، اتركه فارغاً ولا تخمن أو تؤلف أي كلمة من عندك نهائياً.
7. يجب الاعتماد بشكل رئيسي وأساسي على الصورة المرفقة للوثيقة. النص المستخلص من القارئ الضوئي هو للاسترشاد فقط، تجاهله تماماً إذا كان يتعارض مع ما تراه في الصورة.`;

            const promptContent = `اسم الملف الأصلي: ${fileName}
النص المستخلص من القارئ الضوئي (OCR) والذي قد يحتوي على حروف متقطعة أو أخطاء:
${text}`;

            const rawBase64 = base64Data && base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
            
            const isMultimodalModel = (modelName: string): boolean => {
              const name = String(modelName || "").toLowerCase();
              return name.includes("llava") || 
                     name.includes("vl") || 
                     name.includes("minicpm") || 
                     name.includes("moondream") || 
                     name.includes("vision") || 
                     name.includes("bakllava");
            };

            const isMultimodal = isMultimodalModel(ollamaModel);

            const attemptOllamaReq = async (useImage: boolean, timeout: number) => {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeout);
              try {
                const res = await fetch(`${targetUrl}/api/generate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: ollamaModel || "qwen2.5:7b",
                    prompt: `${systemPrompt}\n\nالبيانات المطلوب تحليلها:\n${promptContent}`,
                    stream: false,
                    format: "json",
                    images: useImage && rawBase64 ? [rawBase64] : [],
                    options: {
                      temperature: 0.0,
                      top_p: 0.1,
                      top_k: 10,
                      seed: 42,
                      num_ctx: 8192,
                      num_predict: 4096
                    }
                  }),
                  signal: controller.signal
                });
                clearTimeout(timeoutId);
                return res;
              } catch (err) {
                clearTimeout(timeoutId);
                throw err;
              }
            };

            let localOllamaResponse;
            try {
              if (isMultimodal && rawBase64) {
                console.log("Model is multimodal, trying with image. Timeout: 180s");
                localOllamaResponse = await attemptOllamaReq(true, 180000); // 180s timeout
                if (!localOllamaResponse.ok) {
                  throw new Error("Multimodal rejected");
                }
              } else {
                console.log("Model is text-only, skipping image. Timeout: 180s");
                localOllamaResponse = await attemptOllamaReq(false, 180000); // 180s timeout
              }
            } catch (err1) {
              console.log("Ollama first attempt failed, retrying text-only...", err1);
              localOllamaResponse = await attemptOllamaReq(false, 180000); // 180s timeout fallback
            }

            if (localOllamaResponse.ok) {
              const resJson = await localOllamaResponse.json();
              const responseText = resJson.response || "";
              let cleanText = responseText.trim();
              
              if (cleanText.startsWith("```")) {
                cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
              }
              cleanText = cleanText.trim();

              try {
                data = JSON.parse(cleanText);
                console.log("Direct client-side Ollama extraction succeeded!", data);
              } catch (parseE) {
                try {
                  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    data = JSON.parse(jsonMatch[0]);
                  }
                } catch (fallbackParseE) {
                  console.error("Failed to parse JSON even with regex fallback", fallbackParseE);
                  // We still have cleanText from Ollama, maybe we can extract the document content using regex manually so the text is not completely lost.
                  data = {
                    documentContent: cleanText,
                    extractedText: cleanText,
                    documentSubject: "تعذر استخراج البيانات بدقة (خطأ في تنسيق JSON)"
                  };
                }
              }
            } else {
              throw new Error(`Local Ollama returned status ${localOllamaResponse.status}`);
            }
          } catch (err: any) {
            ollamaErr = err;
            console.log("Direct client-side Ollama failed or blocked by CORS. Falling back to Server Proxy (/api/extract):", err.message || err);
          }

          // 2. Fallback to Server Proxy if client-side direct request failed (or if offline server is running)
          if (!data) {
            try {
              const response = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageBase64: base64Data,
                  mimeType,
                  fileName,
                  useOllama: true,
                  ollamaUrl,
                  ollamaModel,
                  extractedTextFallback: text
                })
              });

              if (response.ok) {
                data = await response.json();
              } else {
                throw new Error("Failed server-side proxy parser");
              }
            } catch (serverErr: any) {
              console.error("Server-side Ollama proxy failed:", serverErr.message || serverErr);
              // Fallback to local offline regex parser
              showToast('warning', 'Ollama غير متاح', 'لم يتم الاتصال بـ Ollama محلياً أو سحابياً. تم استخدام المحلل التلقائي المحلي البديل.');
            }
          }

          if (data) {
            if (data._ollamaFailed) {
              console.warn("Ollama fallback occurred:", data._ollamaErrorMsg);
              showToast('error', 'Ollama غير متاح - فشل الاستخراج', `فشل الاتصال بـ Ollama. السبب: ${data._ollamaErrorMsg}. تم استخراج النص بواسطة القارئ الضوئي البديل فقط. الرجاء التحقق من تفعيل OLLAMA_ORIGINS="*" ومن صحة الرابط.`);
            }
            finalUpdates = {
              documentNumber: data.documentNumber || '',
              documentDate: data.documentDate || '',
              issuingAuthority: data.issuingAuthority || '',
              destinationAuthority: data.destinationAuthority || '',
              documentSubject: data.documentSubject || '',
              documentContent: data.documentContent || '',
              confidenceScore: data.confidenceScore || 85,
              extractedText: data.extractedText || text,
              documentType: data.documentType || 'أخرى',
              references: data.references || [],
              penaltyType: data.penaltyType || '',
              legalArticle: data.legalArticle || '',
              penaltyReason: data.penaltyReason || '',
              penaltyDuration: data.penaltyDuration || ''
            };
          } else {
            // High-quality local heuristic parser fallback
            const parsed = parseArabicDocumentOffline(text, fileName);
            finalUpdates = {
              documentNumber: parsed.documentNumber || '',
              documentDate: parsed.documentDate || '',
              issuingAuthority: parsed.issuingAuthority || '',
              destinationAuthority: parsed.destinationAuthority || '',
              documentSubject: parsed.documentSubject || '',
              documentContent: parsed.documentContent || '',
              confidenceScore: 80,
              extractedText: text,
              documentType: parsed.documentType || 'أخرى',
              references: parsed.references || [],
              penaltyType: parsed.penaltyType || '',
              legalArticle: parsed.legalArticle || '',
              penaltyReason: parsed.penaltyReason || '',
              penaltyDuration: parsed.penaltyDuration || ''
            };
          }
        } else {
          const parsed = parseArabicDocumentOffline(text, fileName);
          finalUpdates = {
            documentNumber: parsed.documentNumber || '',
            documentDate: parsed.documentDate || '',
            issuingAuthority: parsed.issuingAuthority || '',
            destinationAuthority: parsed.destinationAuthority || '',
            documentSubject: parsed.documentSubject || '',
            documentContent: parsed.documentContent || '',
            confidenceScore: 80,
            extractedText: text,
            documentType: parsed.documentType || 'أخرى',
            references: parsed.references || [],
            penaltyType: parsed.penaltyType || '',
            legalArticle: parsed.legalArticle || '',
            penaltyReason: parsed.penaltyReason || '',
            penaltyDuration: parsed.penaltyDuration || ''
          };
        }

        const updates = {
          ...finalUpdates,
          status: 'success' as const,
          ocrProgress: undefined
        };

        const activeDoc = documents.find(d => d.id === id);
        const mergedDoc = {
          ...(activeDoc || {}),
          id,
          fileName,
          mimeType,
          base64Data,
          imageUrl: activeDoc?.imageUrl || `data:${mimeType};base64,${base64Data}`,
          ...updates
        };

        // Save metadata changes to local server
        fetch('/api/local/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mergedDoc)
        }).catch(err => console.error("Failed to save OCR results to local API:", err));

        setDocuments(prev => prev.map(doc => {
          if (doc.id === id) {
            return {
              ...doc,
              ...updates
            };
          }
          return doc;
        }));

        const extractedNum = (updates.documentNumber || '').trim();
        if (extractedNum) {
          const duplicateDoc = documents.find(d => d.id !== id && d.documentNumber && d.documentNumber.trim() === extractedNum);
          if (duplicateDoc) {
            showToast(
              'warning',
              'تنبيه: رقم كتاب مكرر في الأرشيف',
              `المستند الذي تم استخلاصه يحمل رقم الكتاب (${extractedNum}) وهو مكرر ومسجل مسبقاً بعنوان "${duplicateDoc.documentSubject || duplicateDoc.fileName}" لتجنب التكرار.`,
              duplicateDoc.id
            );
          }
        }

        return; // Complete offline flow!
      } catch (ocrError: any) {
        console.error("Client-side Tesseract.js OCR failed:", ocrError);
        // Fallback to normal server extract call which handles offline filename parsing
      }
    }

    try {
      const activeDoc = documents.find(d => d.id === id);
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          imageBase64: base64Data, 
          mimeType, 
          fileName,
          useOllama,
          ollamaUrl,
          ollamaModel,
          extractedTextFallback: activeDoc?.extractedText || ''
        })
      });

      if (!response.ok) {
        let errMsg = 'فشل الاتصال بالخادم لاستخراج البيانات.';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
          } else {
            const rawText = await response.text();
            if (rawText && rawText.length < 300 && !rawText.includes('<!DOCTYPE') && !rawText.includes('<html')) {
              errMsg = rawText;
            } else {
              errMsg = `فشل الخادم مع رمز الاستجابة (${response.status}). قد يكون هناك ضغط عالٍ مؤقت على الخادم.`;
            }
          }
        } catch (e) {
          errMsg = `حدث خطأ في الاتصال بالخادم (${response.status}).`;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();

      if (data._ollamaFailed) {
        console.warn("Ollama fallback occurred on server:", data._ollamaErrorMsg);
        showToast('error', 'Ollama غير متاح - فشل الاستخراج', `فشل الاتصال بـ Ollama. السبب: ${data._ollamaErrorMsg}. تم استخراج النص بواسطة القارئ الضوئي البديل فقط. الرجاء التحقق من تفعيل OLLAMA_ORIGINS="*" ومن صحة الرابط.`);
      }

      const updates = {
        status: 'success' as const,
        documentNumber: data.documentNumber || '',
        documentDate: data.documentDate || '',
        issuingAuthority: data.issuingAuthority || '',
        destinationAuthority: data.destinationAuthority || '',
        documentSubject: data.documentSubject || '',
        documentContent: data.documentContent || '',
        confidenceScore: data.confidenceScore || 90,
        extractedText: data.extractedText || '',
        documentType: data.documentType || 'أخرى',
        references: data.references || [],
        penaltyType: data.penaltyType || '',
        legalArticle: data.legalArticle || '',
        penaltyReason: data.penaltyReason || '',
        penaltyDuration: data.penaltyDuration || ''
      };

      setDocuments(prev => prev.map(doc => {
        if (doc.id === id) {
          return {
            ...doc,
            ...updates
          };
        }
        return doc;
      }));

      // Check for duplicate documentNumber to avoid duplicates in archive
      const extractedNum = (updates.documentNumber || '').trim();
      if (extractedNum) {
        const duplicateDoc = documents.find(d => d.id !== id && d.documentNumber && d.documentNumber.trim() === extractedNum);
        if (duplicateDoc) {
          showToast(
            'warning',
            'تنبيه: رقم كتاب مكرر في الأرشيف',
            `المستند الذي تم استخلاصه يحمل رقم الكتاب (${extractedNum}) وهو مكرر ومسجل مسبقاً بعنوان "${duplicateDoc.documentSubject || duplicateDoc.fileName}" لتجنب التكرار.`,
            duplicateDoc.id
          );
        }
      }

      if (!isOfflineMode) {
        try {
          updateDoc(doc(db, "documents", id), updates).catch(err => {
            console.error("Failed to update extracted metadata in Firestore:", err);
            handleFirestoreError(err, OperationType.UPDATE, `documents/${id}`);
          });
        } catch (e) {
          console.error(e);
          handleFirestoreError(e, OperationType.UPDATE, `documents/${id}`);
        }
      } else {
        const activeDoc = documents.find(d => d.id === id);
        if (activeDoc) {
          fetch('/api/local/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...activeDoc,
              ...updates
            })
          }).catch(err => console.error("Failed to save fallback extraction results to local API:", err));
        }
      }
    } catch (err: any) {
      console.error('Metadata extraction failed:', err);
      const errorMsg = err.message || 'حدث خطأ غير متوقع أثناء المعالجة.';
      
      setDocuments(prev => prev.map(doc => {
        if (doc.id === id) {
          return { ...doc, status: 'error', error: errorMsg };
        }
        return doc;
      }));

      if (!isOfflineMode) {
        try {
          updateDoc(doc(db, "documents", id), {
            status: 'error',
            error: errorMsg
          }).catch(err => {
            console.error("Failed to update error status in Firestore:", err);
            handleFirestoreError(err, OperationType.UPDATE, `documents/${id}`);
          });
        } catch (e) {
          console.error(e);
          handleFirestoreError(e, OperationType.UPDATE, `documents/${id}`);
        }
      } else {
        const activeDoc = documents.find(d => d.id === id);
        if (activeDoc) {
          fetch('/api/local/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...activeDoc,
              status: 'error',
              error: errorMsg
            })
          }).catch(err => console.error("Failed to save error status to local API:", err));
        }
      }
    }
  };

  // Demo Document Generator
  const loadDemoDocument = (type: 'admin' | 'saudi' | 'board') => {
    try {
      const demo = generateSampleDocument(type);
      const id = safeRandomUUID();
      // Since it's canvas base64, we can set imageUrl as base64 itself
      const imageUrl = `data:${demo.mimeType};base64,${demo.base64}`;

      const record: DocumentRecord = {
        id,
        fileName: demo.fileName,
        fileSize: demo.fileSize,
        imageUrl,
        base64Data: demo.base64,
        mimeType: demo.mimeType,
        status: 'idle',
        documentNumber: '',
        documentDate: '',
        issuingAuthority: '',
        documentSubject: '',
        confidenceScore: 0,
        extractedText: '',
        documentType: 'أخرى',
        references: [],
        penaltyType: '',
        legalArticle: '',
        penaltyReason: '',
        penaltyDuration: ''
      };

      setDocuments(prev => [record, ...prev]);
      setSelectedDocId(id);
      saveDocToFirestore(record);
      extractMetadata(id, demo.base64, demo.mimeType, demo.fileName);
    } catch (err) {
      console.error('Failed to generate demo:', err);
    }
  };

  // Field change handler
  const handleUpdateField = (docId: string, field: keyof DocumentRecord, value: any) => {
    const updatedDoc = documents.find(d => d.id === docId);
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        return { 
          ...doc, 
          [field]: value,
          lastModifiedBy: user?.uid,
          lastModifiedByName: userProfile?.fullName || 'مستخدم غير معروف'
        };
      }
      return doc;
    }));

    if (field === 'documentNumber' && value && typeof value === 'string') {
      const sanitizedVal = value.trim();
      if (sanitizedVal) {
        const duplicateDoc = documents.find(d => d.id !== docId && d.documentNumber && d.documentNumber.trim() === sanitizedVal);
        if (duplicateDoc) {
          showToast(
            'warning',
            'تنبيه: رقم كتاب مكرر بالأرشيف',
            `تنبيه: الرقم (${sanitizedVal}) مستخدم بالفعل في مستند آخر بعنوان "${duplicateDoc.documentSubject || duplicateDoc.fileName}" لتجنب التكرار والازدواجية.`,
            duplicateDoc.id
          );
        }
      }
    }

    if (!isOfflineMode) {
      try {
        updateDoc(doc(db, "documents", docId), { 
          [field]: value,
          lastModifiedBy: user?.uid,
          lastModifiedByName: userProfile?.fullName || 'مستخدم غير معروف'
        }).then(() => {
          if (updatedDoc) {
             logAction('update', docId, updatedDoc.documentNumber, updatedDoc.documentSubject, `تم تعديل الحقل: ${String(field)}`);
          }
        }).catch(err => {
          console.error("Failed to update field in Firestore:", err);
          handleFirestoreError(err, OperationType.UPDATE, `documents/${docId}`);
        });
      } catch (e) {
        console.error("Firestore update error:", e);
        handleFirestoreError(e, OperationType.UPDATE, `documents/${docId}`);
      }
    } else {
      if (updatedDoc) {
        logAction('update', docId, updatedDoc.documentNumber, updatedDoc.documentSubject, `تم تعديل الحقل محلياً: ${String(field)}`);
        
        // Save single document update to local API when offline
        const enrichedDoc = {
          ...updatedDoc,
          [field]: value,
          lastModifiedBy: user?.uid,
          lastModifiedByName: userProfile?.fullName || 'مستخدم غير معروف',
          updatedAt: Date.now()
        };
        fetch('/api/local/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enrichedDoc)
        }).catch(err => console.error("Failed to update local document field:", err));
      }
    }
  };

  // Row operations
  const handleDeleteDoc = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const docToDelete = documents.find(d => d.id === id);
    setDocuments(prev => prev.filter(doc => doc.id !== id));
    if (selectedDocId === id) {
      setSelectedDocId(null);
    }

    // Always delete from local server API to ensure offline database integrity
    fetch(`/api/local/documents/${id}`, {
      method: 'DELETE'
    }).catch(err => console.error("Failed to delete local document from server:", err));

    if (docToDelete) {
      if (!isOfflineMode) {
        try {
          deleteDoc(doc(db, "documents", id)).then(() => {
             logAction('delete', id, docToDelete.documentNumber, docToDelete.documentSubject, `تم حذف المستند: ${docToDelete.fileName}`);
          }).catch(err => {
            console.error("Failed to delete document from Firestore:", err);
            handleFirestoreError(err, OperationType.DELETE, `documents/${id}`);
          });
        } catch (e) {
          console.error("Firestore delete error:", e);
          handleFirestoreError(e, OperationType.DELETE, `documents/${id}`);
        }
      } else {
        logAction('delete', id, docToDelete.documentNumber, docToDelete.documentSubject, `تم حذف المستند محلياً: ${docToDelete.fileName}`);
      }
    }
  };

  const handleClearAll = () => {
    if (confirm('هل أنت متأكد من مسح جميع الملفات والبيانات المستخلصة؟')) {
      const currentDocs = [...documents];
      setDocuments([]);
      setSelectedDocId(null);

      // Always clear local server database as well
      fetch('/api/local/documents/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([])
      }).catch(err => console.error("Failed to clear local server documents:", err));

      if (!isOfflineMode) {
        try {
          currentDocs.forEach(d => {
            deleteDoc(doc(db, "documents", d.id)).catch(err => {
              console.error("Failed to clear document in Firestore:", d.id, err);
              handleFirestoreError(err, OperationType.DELETE, `documents/${d.id}`);
            });
          });
        } catch (e) {
          console.error("Firestore clear error:", e);
          handleFirestoreError(e, OperationType.DELETE, `documents`);
        }
      }
    }
  };

  // Export to Excel using XLSX with advanced options (filtering & names sequencing)
  const handleExportToExcel = () => {
    if (documents.length === 0) {
      alert('لا توجد بيانات لتصديرها.');
      return;
    }

    // Filter by branch/type if not 'all'
    const filteredDocs = excelExportBranch === 'all'
      ? documents
      : documents.filter(doc => doc.documentType === excelExportBranch);

    if (filteredDocs.length === 0) {
      alert('لا توجد كتب مطابقة للفرع المحدد لتصديرها.');
      return;
    }

    const excelRows: any[] = [];
    let bookSequence = 1;

    filteredDocs.forEach((doc) => {
      const docType = doc.documentType || 'أخرى';
      const docNum = doc.documentNumber || 'غير مستخلص';
      const docDate = doc.documentDate || 'غير مستخلص';
      const authority = doc.issuingAuthority || 'غير مستخلص';
      const subject = doc.documentSubject || 'غير مستخلص';
      const penaltyType = doc.documentType === 'عقوبة' ? (doc.penaltyType || 'غير مستخلص') : 'غير قابل للتطبيق';
      const legalArticle = doc.documentType === 'عقوبة' ? (doc.legalArticle || 'غير مستخلص') : 'غير قابل للتطبيق';
      const penaltyReason = doc.documentType === 'عقوبة' ? (doc.penaltyReason || 'غير مستخلص') : 'غير قابل للتطبيق';
      const penaltyDuration = doc.documentType === 'عقوبة' ? (doc.penaltyDuration || 'غير مستخلص') : 'غير قابل للتطبيق';
      const refs = (doc.references || []).map(r => `[رقم: ${r.referenceNumber || ''} | تاريخ: ${r.referenceDate || ''} | جهة: ${r.referenceAuthority || ''}]`).join(' ، ') || 'لا يوجد';
      const confidence = doc.status === 'success' ? `${doc.confidenceScore}%` : 'معلق';
      const statusText = doc.status === 'success' ? 'تم الاستخلاص بنجاح' : doc.status === 'processing' ? 'جاري المعالجة' : doc.status === 'error' ? 'خطأ في الاستخراج' : 'قيد الانتظار';
      const fullText = doc.extractedText || 'لا يوجد';

      // Split names from the field
      const names = doc.employeeNames
        ? doc.employeeNames.split(/[\n,;،]+/).map(n => n.trim()).filter(n => n.length > 0)
        : [];

      if (excelExportSplitNames && names.length > 0) {
        // Create a row for each name inside this book
        names.forEach((name, nameIdx) => {
          excelRows.push({
            'تسلسل الكتاب': bookSequence,
            'تسلسل الاسم بالكتاب': nameIdx + 1,
            'الاسم الوارد بالكتاب': name,
            'نوع الوثيقة': docType,
            'رقم الكتاب': docNum,
            'التاريخ': docDate,
            'جهة الإصدار': authority,
            'موضوع الكتاب / العنوان': subject,
            'نوع العقوبة': penaltyType,
            'المادة القانونية': legalArticle,
            'سبب العقوبة': penaltyReason,
            'مدة العقوبة': penaltyDuration,
            'الكتب والمراجع الإدارية المشار إليها': refs,
            'نسبة ثقة القراءة (%)': confidence,
            'حالة المعالجة': statusText,
            'النص الكامل المستخرج': fullText
          });
        });
      } else {
        // Single row for the book
        excelRows.push({
          'تسلسل الكتاب': bookSequence,
          'تسلسل الاسم بالكتاب': '—',
          'الاسم الوارد بالكتاب': names.length > 0 ? names.join(' ، ') : 'لا يوجد أسماء مسجلة',
          'نوع الوثيقة': docType,
          'رقم الكتاب': docNum,
          'التاريخ': docDate,
          'جهة الإصدار': authority,
          'موضوع الكتاب / العنوان': subject,
          'نوع العقوبة': penaltyType,
          'المادة القانونية': legalArticle,
          'سبب العقوبة': penaltyReason,
          'مدة العقوبة': penaltyDuration,
          'الكتب والمراجع الإدارية المشار إليها': refs,
          'نسبة ثقة القراءة (%)': confidence,
          'حالة المعالجة': statusText,
          'النص الكامل المستخرج': fullText
        });
      }
      bookSequence++;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Apply RTL worksheet properties
    worksheet['!views'] = [{ RTL: true }];

    // Auto-adjust column widths
    const colWidths = [
      { wch: 12 },  // تسلسل الكتاب
      { wch: 18 },  // تسلسل الاسم بالكتاب
      { wch: 28 },  // الاسم الوارد بالكتاب
      { wch: 14 },  // نوع الوثيقة
      { wch: 18 },  // رقم الكتاب
      { wch: 18 },  // التاريخ
      { wch: 25 },  // جهة الإصدار
      { wch: 35 },  // موضوع الكتاب / العنوان
      { wch: 18 },  // نوع العقوبة
      { wch: 22 },  // المادة القانونية
      { wch: 22 },  // سبب العقوبة
      { wch: 18 },  // مدة العقوبة
      { wch: 40 },  // الكتب والمراجع الإدارية المشار إليها
      { wch: 18 },  // نسبة ثقة القراءة (%)
      { wch: 18 },  // حالة المعالجة
      { wch: 50 }   // النص الكامل المستخرج
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'البيانات المستخلصة');

    // Create dynamic file name
    const dateStr = new Date().toISOString().slice(0, 10);
    const branchName = excelExportBranch === 'all' ? 'كافة_الفروع' : excelExportBranch.replace(/\s+/g, '_');
    XLSX.writeFile(workbook, `مستخلص_بيانات_${branchName}_${dateStr}.xlsx`);
    setShowExcelExportModal(false);
  };

  const handleExportToPDF = async (doc: DocumentRecord, includeBarcode: boolean = true) => {
    try {
      if (doc.mimeType === 'application/pdf') {
        alert('عذراً، تصدير ملفات PDF المدخلة مسبقاً غير مدعوم حالياً. يتم دعم الصور فقط.');
        return;
      }
      
      const pdf = new jsPDF();
      await appendDocToPdf(pdf, doc, includeBarcode);
      
      // Save the PDF
      const docDate = doc.documentDate ? `_${doc.documentDate.replace(/\//g, '-')}` : '';
      pdf.save(`${doc.documentNumber || 'بدون_رقم'}${docDate}.pdf`);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert(`حدث خطأ أثناء تصدير PDF. تأكد من أن الصورة صالحة. التفاصيل: ${error.message || error}`);
    }
  };

  // Helper to append a single document page to a jsPDF instance
  const appendDocToPdf = async (pdf: jsPDF, doc: DocumentRecord, includeBarcode: boolean, isSubsequentPage: boolean = false) => {
    const dataUrl = doc.base64Data 
      ? `data:${doc.mimeType || 'image/jpeg'};base64,${doc.base64Data}` 
      : doc.imageUrl;
      
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = dataUrl;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('فشل تحميل الصورة.'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    
    const cleanDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    if (isSubsequentPage) {
      pdf.addPage();
    }

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgRatio = img.width / img.height;
    const pdfRatio = pdfWidth / pdfHeight;
    
    let finalWidth = pdfWidth;
    let finalHeight = pdfHeight;
    
    if (imgRatio > pdfRatio) {
      finalHeight = pdfWidth / imgRatio;
    } else {
      finalWidth = pdfHeight * imgRatio;
    }
    
    const x = (pdfWidth - finalWidth) / 2;
    const y = (pdfHeight - finalHeight) / 2;
    
    pdf.addImage(cleanDataUrl, 'JPEG', x, y, finalWidth, finalHeight);

    if (includeBarcode) {
      const qrData = encodeMetadata(doc);
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 100, margin: 1 });
      const qrSize = 30; // 30x30 mm
      const qrX = 10;
      const qrY = pdfHeight - qrSize - 10;
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    }
  };

  const handleExportAllToPDFCombined = async (option: 'separate' | 'single', includeBarcode: boolean) => {
    const successDocs = documents.filter(doc => doc.status === 'success');
    if (successDocs.length === 0) {
      alert('لا توجد وثائق مستخلصة بنجاح لتصديرها.');
      return;
    }

    if (option === 'separate') {
      // Process sequentially to download individual files
      for (const doc of successDocs) {
        await handleExportToPDF(doc, includeBarcode);
      }
    } else {
      // Create a single compiled PDF containing all pages
      try {
        const pdf = new jsPDF();
        for (let i = 0; i < successDocs.length; i++) {
          await appendDocToPdf(pdf, successDocs[i], includeBarcode, i > 0);
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        pdf.save(`مجمع_كافة_الكتب_المؤرشفة_${dateStr}.pdf`);
      } catch (error: any) {
        console.error('Error generating combined PDF:', error);
        alert(`حدث خطأ أثناء تصدير الملف المدمج: ${error.message || error}`);
      }
    }
    setShowPdfAllConfirmModal(false);
  };

  const handleExportAllToPDF = () => {
    setShowPdfAllConfirmModal(true);
  };

  const handlePrint = async (doc: DocumentRecord, includeBarcode: boolean) => {
    try {
      const dataUrl = doc.base64Data 
        ? `data:${doc.mimeType || 'image/jpeg'};base64,${doc.base64Data}` 
        : doc.imageUrl;
        
      let qrDataUrl = '';
      if (includeBarcode) {
        const qrData = encodeMetadata(doc);
        qrDataUrl = await QRCode.toDataURL(qrData, { width: 120, margin: 1 });
      }
        
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html dir="rtl">
            <head>
              <title>طباعة الوثيقة - ${doc.documentNumber || 'بدون رقم'}</title>
              <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
                .container { position: relative; max-width: 100%; max-height: 100vh; display: inline-block; }
                .doc-img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                .qr-img { position: absolute; bottom: 20px; left: 20px; width: 90px; height: 90px; border: 1px solid #ddd; background: #fff; padding: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                @media print {
                  @page { margin: 0; }
                  body { margin: 0; }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <img src="${dataUrl}" class="doc-img" onload="window.print(); window.close();" />
                ${includeBarcode ? `<img src="${qrDataUrl}" class="qr-img" />` : ''}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        alert('يرجى السماح بالنوافذ المنبثقة للطباعة.');
      }
    } catch (error) {
      console.error('Error printing:', error);
      alert('حدث خطأ أثناء محاولة الطباعة.');
    }
  };

  // Filter documents based on search
  const filteredDocuments = documents.filter(doc => {
    const query = searchQuery.toLowerCase();
    const matchesReferences = (doc.references || []).some(
      r =>
        r.referenceNumber.toLowerCase().includes(query) ||
        r.referenceDate.toLowerCase().includes(query) ||
        r.referenceAuthority.toLowerCase().includes(query)
    );
    return (
      doc.fileName.toLowerCase().includes(query) ||
      doc.documentNumber.toLowerCase().includes(query) ||
      doc.documentDate.toLowerCase().includes(query) ||
      doc.issuingAuthority.toLowerCase().includes(query) ||
      doc.documentSubject.toLowerCase().includes(query) ||
      (doc.documentType || '').toLowerCase().includes(query) ||
      (doc.penaltyType || '').toLowerCase().includes(query) ||
      (doc.legalArticle || '').toLowerCase().includes(query) ||
      (doc.penaltyReason || '').toLowerCase().includes(query) ||
      (doc.penaltyDuration || '').toLowerCase().includes(query) ||
      doc.extractedText.toLowerCase().includes(query) ||
      matchesReferences
    );
  });

  // Apply advanced filters (Type, Status, and Date) to search results
  const displayedDocs = filteredDocuments.filter(doc => {
    const matchesType = filterType === 'الكل' || (doc.documentType || 'أخرى') === filterType;
    const matchesStatus = filterStatus === 'الكل' || doc.status === filterStatus;
    
    let matchesDate = true;
    if (filterStartDate && doc.documentDate) {
      matchesDate = matchesDate && (new Date(doc.documentDate) >= new Date(filterStartDate));
    }
    if (filterEndDate && doc.documentDate) {
      matchesDate = matchesDate && (new Date(doc.documentDate) <= new Date(filterEndDate));
    }
    
    return matchesType && matchesStatus && matchesDate;
  });

  if (verifiedDoc) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#050505] text-[#e5e5e5] font-sans antialiased pb-12 flex flex-col justify-between">
        {/* Verification Header */}
        <header className="bg-gradient-to-b from-[#0a0a0a] to-[#040404] border-b border-[#1c1c1c] py-6 shadow-xl sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right">
              <div className="p-1.5 bg-gradient-to-b from-[#141414] to-[#0b0b0b] rounded-md border border-[#2d2d2d] flex items-center justify-center shadow-inner relative group shrink-0">
                <div className="absolute inset-0 bg-[#d4af37]/5 rounded-md blur-sm transition-all group-hover:bg-[#d4af37]/10"></div>
                <IraqiMinistryLogo className="w-14 h-14 filter drop-shadow-[0_0_10px_rgba(212,175,55,0.25)] relative z-10" />
              </div>
              <div>
                <h1 className="text-xl font-cairo font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ffffff] via-[#f3df95] to-[#d4af37] tracking-wide">
                  بوابة التحقق الرقمي من الوثائق الرسمية
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-2 flex-wrap">
                  <span className="text-[10px] font-cairo font-extrabold text-[#d4af37] bg-[#d4af3710] px-2.5 py-0.5 rounded-sm border border-[#d4af3720] shadow-sm uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1 h-1 bg-[#d4af37] rounded-full animate-pulse"></span>
                    جمهورية العراق
                  </span>
                  <span className="text-[10px] font-cairo font-semibold text-[#888] bg-[#ffffff05] px-2 py-0.5 rounded-sm border border-[#ffffff10]">
                    وزارة الداخلية
                  </span>
                  <span className="text-[10px] font-cairo font-extrabold text-[#e5e5e5] bg-[#d4af3715] px-2.5 py-0.5 rounded border border-[#d4af3725] shadow-sm uppercase tracking-wider">
                    اللواء الثامن شرطة الطاقة
                  </span>
                  <span className="hidden lg:inline text-[10px] text-[#555] select-none">•</span>
                  <span className="text-xs font-cairo font-medium text-[#aaa] leading-relaxed">
                    منظومة تصديق آمنة ومستقلة بالكامل للوثائق والكتب الرسمية
                  </span>
                </div>
              </div>
            </div>
            <div className="text-xs font-cairo font-bold bg-[#d4af3715] border border-[#d4af3733] text-[#d4af37] px-4 py-2 rounded-sm flex items-center gap-2 select-none shadow-md">
              <span className="w-2 h-2 bg-[#d4af37] rounded-full animate-ping"></span>
              <span>مصدق رقمي آمن</span>
            </div>
          </div>
        </header>

        {/* Verification Card Content */}
        <main className="max-w-3xl mx-auto px-4 mt-8 flex-grow w-full">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f0f0f] border border-[#d4af3733] rounded-sm p-6 sm:p-8 shadow-xl relative overflow-hidden"
          >
            {/* Holographic glowing borders/decorations for high-security aesthetic */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/3 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/3 rounded-full blur-2xl pointer-events-none"></div>

            {/* Status Indicator Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#1a1a1a] pb-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                  <FileCheck2 className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">وثيقة معتمدة ومطابقة رقمياً</h2>
                  <p className="text-xs text-emerald-500 font-medium mt-0.5">تم التحقق من صحة ومطابقة كافة البيانات المذكورة في نص الوثيقة</p>
                </div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-sm font-bold text-xs flex items-center gap-1 select-none">
                <Check className="w-4 h-4" />
                <span>تحقق إلكتروني ناجح</span>
              </div>
            </div>

            {/* Main Fields Table Grid */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#050505] p-4 rounded-sm border border-[#1a1a1a]">
                  <span className="text-[10px] text-[#666] block font-serif uppercase tracking-wider mb-1">رقم الكتاب / القرار</span>
                  <span className="text-sm font-mono font-bold text-white">{verifiedDoc.documentNumber || '—'}</span>
                </div>
                <div className="bg-[#050505] p-4 rounded-sm border border-[#1a1a1a]">
                  <span className="text-[10px] text-[#666] block font-serif uppercase tracking-wider mb-1">تاريخ الإصدار</span>
                  <span className="text-sm font-serif font-bold text-[#d4af37]">{verifiedDoc.documentDate || '—'}</span>
                </div>
              </div>

              <div className="bg-[#050505] p-4 rounded-sm border border-[#1a1a1a]">
                <span className="text-[10px] text-[#666] block font-serif uppercase tracking-wider mb-1">جهة إصدار الكتاب</span>
                <span className="text-sm font-bold text-white font-serif">{verifiedDoc.issuingAuthority || '—'}</span>
              </div>

              <div className="bg-[#050505] p-4 rounded-sm border border-[#1a1a1a]">
                <span className="text-[10px] text-[#666] block font-serif uppercase tracking-wider mb-1">موضوع الكتاب / المضمون المعتمد</span>
                <span className="text-sm font-serif leading-relaxed text-gray-200 block">{verifiedDoc.documentSubject || '—'}</span>
              </div>

              <div className="bg-[#050505] p-4 rounded-sm border border-[#1a1a1a]">
                <span className="text-[10px] text-[#666] block font-serif uppercase tracking-wider mb-1">نوع المعاملة الإدارية</span>
                <span className="inline-block bg-[#d4af3710] text-[#d4af37] border border-[#d4af3730] px-3 py-1 rounded-sm text-xs font-bold font-serif">{verifiedDoc.documentType || 'أخرى'}</span>
              </div>

              {/* Penalty details overlay in case it's عقوبة */}
              {verifiedDoc.documentType === 'عقوبة' && (
                <div className="p-4 bg-[#1c180e] border border-[#d4af3722] rounded-sm space-y-3">
                  <span className="text-xs font-bold text-[#d4af37] block font-serif border-b border-[#d4af3715] pb-1.5 mb-2">الجزاءات والعقوبات الإدارية المصدقة</span>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[#666] block mb-0.5">نوع العقوبة المفروضة:</span>
                      <span className="font-bold text-white">{verifiedDoc.penaltyType || 'غير محدد'}</span>
                    </div>
                    <div>
                      <span className="text-[#666] block mb-0.5">المستند القانوني:</span>
                      <span className="font-bold text-[#d4af37]">{verifiedDoc.legalArticle || 'غير محدد'}</span>
                    </div>
                    <div>
                      <span className="text-[#666] block mb-0.5">سبب العقوبة / المخالفة:</span>
                      <span className="font-bold text-white">{verifiedDoc.penaltyReason || 'غير محدد'}</span>
                    </div>
                    <div>
                      <span className="text-[#666] block mb-0.5">مدة وتأثير العقوبة:</span>
                      <span className="font-bold text-white">{verifiedDoc.penaltyDuration || 'غير محدد'}</span>
                    </div>
                  </div>
                </div>
              )}

              {verifiedDoc.extractedText && (
                <div className="bg-[#050505] p-4 rounded-sm border border-[#1a1a1a]">
                  <span className="text-[10px] text-[#666] block font-serif uppercase tracking-wider mb-1">نص مقتبس من أصل الوثيقة</span>
                  <p className="text-[11px] font-mono leading-relaxed text-[#888] whitespace-pre-wrap max-h-[140px] overflow-y-auto bg-[#0a0a0a] p-3 rounded border border-[#161616]">
                    {verifiedDoc.extractedText}
                  </p>
                </div>
              )}
            </div>

            {/* Signature Block & timestamp */}
            <div className="mt-8 pt-6 border-t border-[#1a1a1a] flex flex-col sm:flex-row justify-between items-center text-xs gap-4 text-[#666]">
              <div className="text-center sm:text-right">
                <p>تاريخ وتوقيت التحقق الفعلي:</p>
                <p className="font-mono text-white mt-1">{new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'medium' })}</p>
              </div>
              <div className="text-center sm:text-left">
                <p>مرجع التحقق الرقمي (UUID):</p>
                <p className="font-mono text-[#d4af37] mt-1 text-[11px]">VERIFY-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
              </div>
            </div>
          </motion.div>

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => {
                window.print();
              }}
              className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-white text-xs font-bold px-5 py-2.5 rounded-sm transition-all cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>طباعة تقرير التحقق المعتمد</span>
            </button>
            <button
              onClick={() => {
                // Return to main app by clearing URL search parameters
                window.location.href = window.location.origin + window.location.pathname;
              }}
              className="flex items-center gap-2 bg-[#d4af37] hover:bg-[#b8962d] text-black text-xs font-bold px-5 py-2.5 rounded-sm transition-all cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>الذهاب لتطبيق الأرشفة الرئيسي</span>
            </button>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-[10px] text-[#555] tracking-wider border-t border-[#111] pt-6 max-w-3xl mx-auto w-full px-4">
          بوابة تصديق الوثائق والكتب الرسمية المؤمنة رقمياً. جميع البيانات مشفرة محلياً في الرمز ومحمية بموجب معايير التواقيع الرقمية.
        </footer>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#050505] text-[#e5e5e5] font-sans antialiased pb-12">
      {/* Sleek, Professional Header */}
      <header id="header-section" className="bg-gradient-to-b from-[#0a0a0a] to-[#040404] border-b border-[#1c1c1c] sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-5">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right w-full">
            <div className="p-1.5 bg-gradient-to-b from-[#141414] to-[#0b0b0b] rounded-md border border-[#2d2d2d] flex items-center justify-center shadow-inner relative group shrink-0">
              <div className="absolute inset-0 bg-[#d4af37]/5 rounded-md blur-sm transition-all group-hover:bg-[#d4af37]/10"></div>
              <IraqiMinistryLogo className="w-16 h-16 filter drop-shadow-[0_0_12px_rgba(212,175,55,0.3)] relative z-10" />
            </div>
            <div className="flex-grow">
              <h1 className="text-2xl font-cairo font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ffffff] via-[#f3df95] to-[#d4af37] tracking-wide">
                برنامج الأرشفة الإلكترونية الذكية
              </h1>
              <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-2 flex-wrap">
                <span className="text-[10px] font-cairo font-extrabold text-[#d4af37] bg-[#d4af3710] px-2.5 py-0.5 rounded-sm border border-[#d4af3720] shadow-sm uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1 h-1 bg-[#d4af37] rounded-full animate-pulse"></span>
                  جمهورية العراق
                </span>
                <span className="text-[10px] font-cairo font-semibold text-[#888] bg-[#ffffff05] px-2 py-0.5 rounded-sm border border-[#ffffff10]">
                  وزارة الداخلية
                </span>
                <span className="text-xs font-cairo font-bold text-[#e5e5e5] bg-[#d4af3715] px-2.5 py-0.5 rounded border border-[#d4af3725] shadow-sm uppercase tracking-wider">
                  اللواء الثامن شرطة الطاقة
                </span>
                <span className="hidden lg:inline text-[10px] text-[#555] select-none">•</span>
                <span className="text-xs font-cairo font-medium text-[#aaa] leading-relaxed">
                  منظومة أرشفة ذكية وإدارة وتصديق الوثائق والكتب الرسمية بالكامل
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Compact Actions Toolbar Ribbon */}
        <div className="bg-[#080808] border-t border-[#1c1c1c] py-2 relative z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
            
            {/* Primary Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={triggerFileInput}
                className="flex items-center gap-1.5 bg-[#d4af37] hover:bg-[#b8962d] text-black px-2.5 py-1.5 rounded-sm text-[11px] font-bold transition-all cursor-pointer shadow-sm group"
                title="سحب / إضافة وثيقة جديدة"
              >
                <Upload className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                <span>إضافة وثيقة</span>
              </button>

              <button
                onClick={() => startCamera()}
                className="flex items-center gap-1.5 bg-[#141414] hover:bg-[#222] border border-[#d4af3733] hover:border-[#d4af37] text-[#d4af37] hover:text-white px-2.5 py-1.5 rounded-sm text-[11px] font-bold transition-all cursor-pointer shadow-sm group"
                title="تصوير وثيقة مباشرة من كاميرا الجهاز"
              >
                <Camera className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>تصوير وثيقة</span>
              </button>

              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-1.5 bg-[#141414] hover:bg-[#222] border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 hover:text-white px-2.5 py-1.5 rounded-sm text-[11px] font-bold transition-all cursor-pointer shadow-sm group"
                title="مسح المستندات والكتب ضوئياً عبر ماسح ضوئي محلي أو ملقم آلي"
              >
                <Printer className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform text-cyan-400" />
                <span>سحب بالسكنر (Scanner)</span>
              </button>
              
              <div className="h-4 w-px bg-[#333] mx-1"></div>

              <button
                onClick={() => setShowArchiveModal(true)}
                className="flex items-center gap-1.5 bg-[#141414] hover:bg-[#222] border border-[#222] hover:border-[#333] text-[#ccc] hover:text-white px-2.5 py-1.5 rounded-sm text-[11px] font-semibold transition-all cursor-pointer group"
                title="أرشيف المستندات والكتب المؤرشفة"
              >
                <Archive className="w-3.5 h-3.5 text-[#888] group-hover:text-[#d4af37] transition-colors" />
                <span>أرشيف المستندات</span>
              </button>
              
              <div className="h-4 w-px bg-[#333] mx-1"></div>

              <button
                onClick={() => setShowReports(true)}
                className="flex items-center gap-1.5 bg-[#141414] hover:bg-[#222] border border-[#222] hover:border-[#333] text-[#ccc] hover:text-white px-2.5 py-1.5 rounded-sm text-[11px] font-semibold transition-all cursor-pointer group"
                title="التقارير والإحصائيات"
              >
                <FileText className="w-3.5 h-3.5 text-[#888] group-hover:text-[#d4af37] transition-colors" />
                <span>التقارير</span>
              </button>

              <div className="h-4 w-px bg-[#333] mx-1"></div>

 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 

              <div className="h-4 w-px bg-[#333] mx-1"></div>

              {/* Ollama Settings Button */}
              <button
                onClick={() => setShowOllamaSettingsModal(true)}
                className="flex items-center gap-1.5 bg-[#141414] hover:bg-[#222] border border-[#d4af3733] hover:border-[#d4af37] text-[#d4af37] hover:text-white px-2.5 py-1.5 rounded-sm text-[11px] font-bold transition-all cursor-pointer group shadow-sm"
                title="إعدادات الذكاء الاصطناعي Ollama"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37] group-hover:scale-110 transition-transform" />
                <span>إعدادات Ollama</span>
              </button>

              <div className="h-4 w-px bg-[#333] mx-1"></div>
              
              <button
                onClick={onLogout}
                className="flex items-center justify-center bg-[#141414] hover:bg-red-950/30 border border-[#222] hover:border-red-900/50 text-[#888] hover:text-red-400 w-7 h-7 rounded-sm transition-all cursor-pointer group"
                title="تسجيل الخروج"
              >
                <LogOut className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              </button>

              {isAdminUser && (
                <>
                  <div className="h-4 w-px bg-[#333] mx-1"></div>
                  <button
                    onClick={onOpenAdmin}
                    className="flex items-center gap-1.5 bg-[#141414] hover:bg-[#222] border border-[#222] hover:border-[#333] text-[#ccc] hover:text-white px-2.5 py-1.5 rounded-sm text-[11px] font-semibold transition-all cursor-pointer group"
                    title="لوحة تحكم المشرف"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#888] group-hover:text-[#d4af37] transition-colors" />
                    <span>لوحة التحكم</span>
                  </button>
                </>
              )}
              
              {/* Export Actions */}
              {documents.length > 0 && (
                <>
                  <div className="h-4 w-px bg-[#333] mx-1"></div>
                  <button
                    onClick={() => setShowPdfAllConfirmModal(true)}
                    className="flex items-center gap-1.5 bg-red-955/20 hover:bg-red-900/40 border border-red-900/30 text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded-sm text-[11px] font-semibold transition-all cursor-pointer group"
                    title="تصدير الكل PDF"
                  >
                    <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    <span className="hidden md:inline">PDF</span>
                  </button>
                  <button
                    onClick={() => setShowExcelExportModal(true)}
                    className="flex items-center gap-1.5 bg-[#141414] hover:bg-emerald-900/20 border border-[#222] hover:border-emerald-900/30 text-emerald-400 hover:text-emerald-300 px-2.5 py-1.5 rounded-sm text-[11px] font-semibold transition-all cursor-pointer group"
                    title="تصدير إكسل"
                  >
                    <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform text-emerald-500" />
                    <span className="hidden md:inline">إكسل</span>
                  </button>
                </>
              )}
            </div>
            
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Statistics Bento Row */}
        {documents.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
            id="stats-bento"
          >
            <div className="bg-[#0f0f0f] p-4 rounded-sm border border-[#1a1a1a]">
              <span className="text-xs text-[#888] font-medium block">إجمالي المستندات</span>
              <div className="text-2xl font-mono font-bold text-white mt-1">{stats.total}</div>
            </div>
            <div className="bg-[#0f0f0f] p-4 rounded-sm border border-[#1a1a1a]">
              <span className="text-xs text-[#d4af37] font-medium block">مستخلص بنجاح</span>
              <div className="text-2xl font-mono font-bold text-[#d4af37] mt-1">{stats.success}</div>
            </div>
            <div className="bg-[#0f0f0f] p-4 rounded-sm border border-[#1a1a1a]">
              <span className="text-xs text-amber-400 font-medium block">جاري المعالجة</span>
              <div className="text-2xl font-mono font-bold text-amber-500 mt-1 flex items-center gap-1">
                {stats.processing > 0 && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
                {stats.processing}
              </div>
            </div>
            <div className="bg-[#0f0f0f] p-4 rounded-sm border border-[#1a1a1a]">
              <span className="text-xs text-red-400 font-medium block">أخطاء القراءة</span>
              <div className="text-2xl font-mono font-bold text-red-500 mt-1">{stats.error}</div>
            </div>
            <div className="bg-[#0f0f0f] p-4 rounded-sm border border-[#1a1a1a] col-span-2 md:col-span-1">
              <span className="text-xs text-[#aaa] font-medium block">متوسط دقة الـ AI</span>
              <div className="text-2xl font-mono font-bold text-[#d4af37] mt-1">{stats.avgConfidence}%</div>
            </div>
          </motion.div>
        )}

        {/* Drag & Drop Upload Zone */}
        <div
          id="dropzone-container"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-sm p-8 mb-6 text-center transition-all duration-300 overflow-hidden ${
            isDragging 
              ? 'border-[#d4af37] bg-[#d4af3708] scale-[0.99]' 
              : 'border-[#333] bg-[#0a0a0a] hover:border-[#d4af37] hover:bg-[#0f0f0f]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="image/png, image/jpeg, image/jpg, image/webp"
            className="hidden"
          />

          <div className="max-w-xl mx-auto flex flex-col items-center">
            <div className={`p-4 rounded-full border mb-4 transition-all duration-300 ${isDragging ? 'bg-[#d4af37] text-black border-[#d4af37] scale-110' : 'bg-[#0f0f0f] text-[#d4af37] border-[#1a1a1a]'}`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'animate-bounce' : ''}`} />
            </div>
            <h3 className="text-lg font-serif italic text-[#aaa]">اسحب صورة الكتاب أو الوثيقة الرسمية هنا</h3>
            <p className="text-xs text-[#666] uppercase tracking-widest mt-1.5">أو انقر لتصفح ملفات جهازك يدوياً</p>
            <p className="text-[10px] text-[#555] tracking-wider mt-1">يدعم صور الأوراق الرسمية والقرارات والخطابات بجميع صيغ الصور الشائعة</p>

            <div className="flex flex-col sm:flex-row gap-3 mt-5 w-full justify-center">
              <button
                id="btn-upload-browse"
                type="button"
                onClick={triggerFileInput}
                className="inline-flex items-center justify-center gap-2 bg-[#d4af37] hover:bg-[#b8962d] text-black text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-sm transition-all cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>اختيار ملف من الجهاز</span>
              </button>

              <button
                type="button"
                onClick={() => startCamera()}
                className="inline-flex items-center justify-center gap-2 bg-[#121212] hover:bg-[#1a1a1a] text-[#d4af37] border border-[#d4af37]/30 hover:border-[#d4af37] text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-sm transition-all cursor-pointer shadow-md"
              >
                <Camera className="w-4 h-4" />
                <span>التقاط صورة بالكاميرا</span>
              </button>
            </div>


          </div>
        </div>

        {/* Missing API Key Warning Banner */}
        {documents.some(d => d.status === 'error' && d.error?.includes('GEMINI_API_KEY')) && (
          <div className="bg-[#1c180e] border border-[#d4af3730] rounded-sm p-4 mb-6 flex gap-3 items-start text-[#e5c158]">
            <Info className="w-5 h-5 text-[#d4af37] shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold block text-sm mb-1 text-[#d4af37]">تنبيه: مفتاح الـ API غير مهيأ بعد!</span>
              يبدو أن مفتاح <code className="bg-[#2a2312] px-1 py-0.5 rounded font-mono font-bold text-[#d4af37]">GEMINI_API_KEY</code> لم يتم إضافته أو أنه خاطئ.
              لتشغيل مستخلص الذكاء الاصطناعي بنجاح:
              <ol className="list-decimal mr-4 mt-1.5 space-y-1 text-slate-300">
                <li>افتح قائمة <b>Secrets</b> من الشريط الجانبي في لوحة تحكم <b>Google AI Studio</b>.</li>
                <li>قم بإضافة سر جديد باسم <code className="font-mono bg-[#2a2312] px-1 py-0.5 rounded font-bold text-[#d4af37]">GEMINI_API_KEY</code> وضع مفتاح واجهة برمجة تطبيقات Gemini الخاص بك كقيمة له.</li>
                <li>ثم أعد محاولة الاستخلاص وسيتم المعالجة فوراً.</li>
              </ol>
            </div>
          </div>
        )}

        {/* Home View / Pristine Welcome & Navigation */}
        {documents.length === 0 && (
          <div id="empty-state-view" className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-sm p-16 text-center max-w-xl mx-auto my-12">
            <div className="w-16 h-16 bg-[#0a0a0a] text-[#d4af37] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#222]">
              <FileText className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-serif italic text-white">قائمة المستندات فارغة</h4>
            <p className="text-xs text-[#888] mt-2 leading-relaxed">
              قم بسحب وإفلات صور الكتب الرسمية أو اختر ملفات من جهازك لتبدأ عملية استخلاص الرقم وتاريخ الكتاب وجهة الإصدار فوراً وحفظها في جدول منظم للتصدير.
            </p>
          </div>
        )}

        {/* Archive / Records Modal - Unified and moved to the Search/Archive Hub below */}
        <AnimatePresence>
          {false && showArchiveModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md text-right"
              dir="rtl"
            >
              <motion.div
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
                className="bg-[#0c0c0c] border border-[#222] rounded-sm w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right"
              >
                {/* Modal Header */}
                <div className="flex justify-between items-center p-4 border-b border-[#222] bg-[#050505]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#d4af37]/10 rounded-sm">
                      <Archive className="w-5 h-5 text-[#d4af37]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-cairo font-black text-white">أرشيف المستندات والوثائق الرسمية الكامل</h2>
                      <p className="text-[#888] text-[10px] mt-0.5">تصفح، تعديل، طباعة وتصدير الكتب والقرارات المؤرشفة في المنظومة</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowArchiveModal(false)}
                    className="p-1.5 text-[#888] hover:text-white bg-[#1a1a1a] hover:bg-[#222] rounded-sm transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Workspace Content (Scrollable Split Grid) */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#080808]">
                  
                  {/* Main Workspace View: Left Table + Right Viewer Split */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-right">
            
            {/* LEFT SIDE: Documents list and table (cols-7) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              {/* Bulk Operations bar (Search moved to header) */}
              <div className="bg-[#0f0f0f] p-3 rounded-sm border border-[#1a1a1a] flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="text-xs text-[#888]">
                  <span className="font-bold text-white">إدارة السجلات</span> - {documents.length > 0 ? "اختر مستنداً لعرضه أو تعديله" : "لا توجد مستندات"}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => { setShowResults(false); setSearchQuery(''); }}
                    className="flex items-center gap-1.5 text-[#888] hover:text-white px-2.5 py-1.5 rounded-sm text-xs font-semibold border border-[#333] hover:border-[#555] transition-all cursor-pointer bg-[#141414]"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>إخفاء السجلات</span>
                  </button>
                  <div className="h-4 w-px bg-[#333] mx-1"></div>
                  <span className="text-xs text-[#888] ml-1">
                    عرض {filteredDocuments.length} من {documents.length} كتاب
                  </span>
                  <button
                    id="btn-clear-all"
                    onClick={handleClearAll}
                    className="flex items-center gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-sm text-xs font-semibold border border-transparent transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>مسح الكل</span>
                  </button>
                </div>
              </div>

              {/* List of Document Rows */}
              <div className="bg-[#0f0f0f] rounded-sm border border-[#1a1a1a] shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-[#0a0a0a] text-[#888] text-xs font-serif border-b border-[#222]">
                        <th className="py-3 px-4 w-12 text-center">م</th>
                        <th className="py-3 px-3">الوثيقة</th>
                        <th className="py-3 px-3">رقم الكتاب</th>
                        <th className="py-3 px-3">تاريخ الكتاب</th>
                        <th className="py-3 px-3">جهة الإصدار</th>
                        <th className="py-3 px-3 text-center">نسبة الثقة</th>
                        <th className="py-3 px-4 w-16 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]">
                      <AnimatePresence initial={false}>
                        {filteredDocuments.map((doc, idx) => {
                          const isSelected = doc.id === selectedDocId;
                          return (
                            <motion.tr
                              key={doc.id}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              onClick={() => setSelectedDocId(doc.id)}
                              className={`text-xs cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'bg-[#d4af3710] hover:bg-[#d4af3718] font-medium border-r-2 border-r-[#d4af37]' 
                                  : 'hover:bg-[#161616] text-[#e5e5e5]'
                              }`}
                            >
                              <td className="py-3 px-4 text-center font-mono text-[#666] font-normal">
                                {idx + 1}
                              </td>
                              
                              <td className="py-3 px-3 max-w-[140px] truncate">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-sm border border-[#222] overflow-hidden shrink-0 bg-[#0a0a0a] flex items-center justify-center">
                                    <img src={doc.base64Data ? `data:${doc.mimeType || 'image/jpeg'};base64,${doc.base64Data}` : doc.imageUrl} alt="preview" className="w-full h-full object-cover" />
                                  </div>
                                  <div className="truncate">
                                    <div className="font-bold text-[#e5e5e5] truncate" title={doc.fileName}>
                                      {doc.fileName}
                                    </div>
                                    <div className="text-[10px] text-[#666] mt-0.5">{doc.fileSize}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                {doc.status === 'processing' ? (
                                  <div className="h-5 w-16 bg-[#1a1a1a] rounded animate-pulse"></div>
                                ) : doc.status === 'error' ? (
                                  <span className="text-red-400 font-medium">خطأ</span>
                                ) : (
                                  <input
                                    type="text"
                                    value={doc.documentNumber}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleUpdateField(doc.id, 'documentNumber', e.target.value)}
                                    className="w-full py-1 px-1.5 border border-transparent hover:border-[#333] focus:border-[#d4af37] focus:bg-[#050505] rounded-sm focus:outline-none bg-transparent text-[#e5e5e5] transition-all font-mono"
                                    placeholder="أدخل الرقم..."
                                  />
                                )}
                              </td>

                              <td className="py-3 px-3">
                                {doc.status === 'processing' ? (
                                  <div className="h-5 w-20 bg-[#1a1a1a] rounded animate-pulse"></div>
                                ) : doc.status === 'error' ? (
                                  <span className="text-red-400 font-medium">خطأ</span>
                                ) : (
                                  <input
                                    type="text"
                                    value={doc.documentDate}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleUpdateField(doc.id, 'documentDate', e.target.value)}
                                    className="w-full py-1 px-1.5 border border-transparent hover:border-[#333] focus:border-[#d4af37] focus:bg-[#050505] rounded-sm focus:outline-none bg-transparent text-[#e5e5e5] transition-all font-serif"
                                    placeholder="أدخل التاريخ..."
                                  />
                                )}
                              </td>

                              <td className="py-3 px-3">
                                {doc.status === 'processing' ? (
                                  <div className="h-5 w-24 bg-[#1a1a1a] rounded animate-pulse"></div>
                                ) : doc.status === 'error' ? (
                                  <span className="text-red-400 font-medium">خطأ</span>
                                ) : (
                                  <input
                                    type="text"
                                    value={doc.issuingAuthority}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleUpdateField(doc.id, 'issuingAuthority', e.target.value)}
                                    className="w-full py-1 px-1.5 border border-transparent hover:border-[#333] focus:border-[#d4af37] focus:bg-[#050505] rounded-sm focus:outline-none bg-transparent text-[#e5e5e5] transition-all font-serif"
                                    placeholder="أدخل الجهة..."
                                  />
                                )}
                              </td>

                              <td className="py-3 px-3 text-center">
                                {doc.status === 'processing' ? (
                                  <div className="inline-flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-sm font-bold scale-90 animate-pulse border border-amber-500/20">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>جاري القراءة</span>
                                  </div>
                                ) : doc.status === 'error' ? (
                                  <div className="inline-flex items-center gap-1 text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-sm font-bold scale-90 border border-red-500/20">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>فشل</span>
                                  </div>
                                ) : (
                                  <span className={`inline-block px-2.5 py-0.5 rounded-sm text-[10px] font-bold ${
                                    doc.confidenceScore >= 85 
                                      ? 'bg-[#d4af3715] text-[#d4af37] border border-[#d4af3730]' 
                                      : doc.confidenceScore >= 60 
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  }`}>
                                    {doc.confidenceScore}%
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      extractMetadata(doc.id, doc.base64Data, doc.mimeType, doc.fileName);
                                    }}
                                    title="إعادة معالجة"
                                    className="p-1 text-[#666] hover:text-[#d4af37] hover:bg-[#1a1a1a] rounded-sm transition-all cursor-pointer"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteDoc(doc.id, e)}
                                    title="حذف السطر"
                                    className="p-1 text-[#666] hover:text-red-400 hover:bg-[#1a1a1a] rounded-sm transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: Interactive Side-by-Side Image and Field Inspector (cols-5) */}
            {selectedDocId && (
              <div className="lg:col-span-5">
                <AnimatePresence mode="wait">
                {selectedDoc ? (
                  <motion.div
                    key={selectedDoc.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-sm shadow-lg overflow-hidden"
                  >
                    {/* Header Panel */}
                    <div className="p-4 border-b border-[#1a1a1a] bg-[#0a0a0a] flex justify-between items-center flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#d4af37]" />
                        <div className="flex flex-col">
                          <h4 className="text-xs font-serif italic font-bold text-white truncate max-w-[200px]" title={selectedDoc.fileName}>
                            معاينة: {selectedDoc.fileName}
                          </h4>
                          {selectedDoc.lastModifiedByName && (
                            <span className="text-[10px] text-[#888] mt-0.5" title={`تمت الإضافة بواسطة: ${selectedDoc.createdByName || 'غير معروف'}`}>
                              تعديل: {selectedDoc.lastModifiedByName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedDoc.status === 'success' && (
                          <>
                            <button
                              onClick={() => {
                                setPrintTargetDoc(selectedDoc);
                                setShowPrintConfirmModal(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-black bg-[#d4af37] hover:bg-[#b8962d] rounded-sm cursor-pointer shadow-sm transition-colors"
                              title="طباعة صورة الوثيقة"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>طباعة</span>
                            </button>
                            <button
                              onClick={() => {
                                setPdfTargetDoc(selectedDoc);
                                setShowPdfConfirmModal(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-700 hover:bg-red-600 rounded-sm cursor-pointer shadow-sm transition-colors"
                              title="تصدير الوثيقة كملف PDF مع رمز التحقق"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>تصدير PDF</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setSelectedDocId(null);
                          }}
                          className="lg:hidden p-1.5 text-[#888] hover:text-[#e5e5e5] bg-[#161616] rounded-sm cursor-pointer"
                          title="العودة للقائمة"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Original Document Scanned Image Preview Panel */}
                    <div className="p-4 bg-[#050505] border-b border-[#1a1a1a] flex flex-col justify-center items-center h-[650px] relative overflow-hidden group">
                      <DocumentAnnotator
                        doc={selectedDoc}
                        onUpdateDoc={(updatedFields) => {
                          Object.entries(updatedFields).forEach(([field, value]) => {
                            handleUpdateField(selectedDoc.id, field as keyof DocumentRecord, value);
                          });
                        }}
                        containerClassName="w-full h-full flex items-center justify-center relative select-none"
                        imageClassName="max-h-[480px] max-w-full object-contain rounded-sm shadow-xs transition-transform duration-300"
                        maxHeightClass="max-h-[480px]"
                      />
                      
                      {/* Interactive Processing Overlay */}
                      {selectedDoc.status === 'processing' && (
                        <div className="absolute inset-0 bg-[#050505]/90 backdrop-blur-xs flex flex-col items-center justify-center text-white p-6">
                          <Loader2 className="w-10 h-10 animate-spin text-[#d4af37] mb-3" />
                          <p className="text-xs font-bold">{selectedDoc.ocrProgress || "جاري تحليل الوثيقة واستخراج البيانات..."}</p>
                          <p className="text-[10px] text-[#888] mt-1">تستغرق هذه العملية عادةً بضع ثوانٍ</p>
                        </div>
                      )}

                      {/* Error State Overlay */}
                      {selectedDoc.status === 'error' && (
                        <div className="absolute inset-0 bg-[#1c1212] p-6 flex flex-col items-center justify-center text-center text-red-200 overflow-y-auto border border-red-500/20">
                          <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
                          <h5 className="text-xs font-bold">فشلت معالجة هذا الملف</h5>
                          <p className="text-[10px] text-red-300 mt-2 max-w-xs break-words leading-relaxed bg-[#2d1a1a] p-2 rounded-sm border border-red-500/30">
                            {selectedDoc.error || 'حدث خطأ غير معروف أثناء الاستخراج.'}
                          </p>
                          <button
                            onClick={() => extractMetadata(selectedDoc.id, selectedDoc.base64Data, selectedDoc.mimeType, selectedDoc.fileName)}
                            className="mt-3 bg-red-800 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-sm text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>إعادة المحاولة</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Extraction Details Editable Form */}
                    <div className="p-5 space-y-4">
                      
                      {/* Doc Subject/Title (highly descriptive) */}
                      <div>
                        <label className="text-[10px] font-sans font-black text-[#d4af37] block mb-2 tracking-wider">موضوع الكتاب الرئيسي / ملخص المضمون (تصميم حر غير محدود الارتفاع والمساحة):</label>
                        <div className="relative">
                          <textarea
                            value={selectedDoc.documentSubject || ''}
                            disabled={selectedDoc.status === 'processing'}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${Math.max(el.scrollHeight, 550)}px`;
                              }
                            }}
                            onChange={(e) => {
                              handleUpdateField(selectedDoc.id, 'documentSubject', e.target.value);
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.max(e.target.scrollHeight, 550)}px`;
                            }}
                            className="w-full text-sm font-sans font-medium bg-transparent border-0 border-r-2 border-[#d4af37]/40 focus:border-[#d4af37] py-3 px-4 text-[#e5e5e5] focus:outline-none focus:ring-0 disabled:opacity-50 transition-all resize-none overflow-hidden min-h-[550px] leading-relaxed shadow-none"
                            placeholder="اكتب تفاصيل وموضوع الكتاب بحرية كاملة دون قيود للارتفاع..."
                          />
                        </div>
                      </div>

                      {/* Employee Names */}
                      <div>
                        <label className="text-[10px] font-serif font-bold text-[#888] block mb-1 flex items-center gap-1">
                          <Users className="w-3 h-3 text-[#d4af37]" />
                          <span>الأسماء الواردة في الكتاب (اسم في كل سطر أو مفصولة بفواصل)</span>
                        </label>
                        <textarea
                          value={selectedDoc.employeeNames || ''}
                          disabled={selectedDoc.status === 'processing'}
                          onChange={(e) => handleUpdateField(selectedDoc.id, 'employeeNames', e.target.value)}
                          className="w-full text-xs bg-[#050505] border border-[#222] rounded-sm py-2 px-3 text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] disabled:opacity-50 transition-all font-sans min-h-[75px]"
                          placeholder="أدخل الأسماء الموجودة بالكتاب، اسم في كل سطر أو مفصولة بفاصلة لترقيمها عند تصدير إكسل..."
                        />
                      </div>

                      {/* Doc Number, Date, Authority Row */}
                      <div className="grid grid-cols-2 gap-4">
                        
                        {/* Doc Number */}
                        <div>
                          <label className="text-[10px] font-serif font-bold text-[#888] block mb-1 flex items-center gap-1">
                            <Hash className="w-3 h-3 text-[#d4af37]" />
                            <span>رقم الكتاب / القرار</span>
                          </label>
                          <input
                            type="text"
                            value={selectedDoc.documentNumber}
                            disabled={selectedDoc.status === 'processing'}
                            onChange={(e) => handleUpdateField(selectedDoc.id, 'documentNumber', e.target.value)}
                            className="w-full text-xs bg-[#050505] border border-[#222] rounded-sm py-2 px-3 text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] disabled:opacity-50 transition-all font-mono"
                            placeholder="مثال: ص/١٢/ب"
                          />
                        </div>

                        {/* Doc Date */}
                        <div>
                          <label className="text-[10px] font-serif font-bold text-[#888] block mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#d4af37]" />
                            <span>التاريخ</span>
                          </label>
                          <input
                            type="text"
                            value={selectedDoc.documentDate}
                            disabled={selectedDoc.status === 'processing'}
                            onChange={(e) => handleUpdateField(selectedDoc.id, 'documentDate', e.target.value)}
                            className="w-full text-xs bg-[#050505] border border-[#222] rounded-sm py-2 px-3 text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] disabled:opacity-50 transition-all font-serif"
                            placeholder="تاريخ هجري أو ميلادي..."
                          />
                        </div>

                      </div>

                      {/* Issuing Authority */}
                      <div>
                        <label className="text-[10px] font-serif font-bold text-[#888] block mb-1 flex items-center gap-1">
                          <Building className="w-3 h-3 text-[#d4af37]" />
                          <span>جهة إصدار الكتاب</span>
                        </label>
                        <input
                          type="text"
                          value={selectedDoc.issuingAuthority}
                          disabled={selectedDoc.status === 'processing'}
                          onChange={(e) => handleUpdateField(selectedDoc.id, 'issuingAuthority', e.target.value)}
                          className="w-full text-xs bg-[#050505] border border-[#222] rounded-sm py-2 px-3 text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] disabled:opacity-50 transition-all font-serif"
                          placeholder="الوزارة، الدائرة الإدارية، الشركة الصادرة..."
                        />
                      </div>

                      {/* Document Type Selection */}
                      <div>
                        <label className="text-[10px] font-serif font-bold text-[#888] block mb-1">نوع الوثيقة</label>
                        <select
                          value={selectedDoc.documentType || 'أخرى'}
                          disabled={selectedDoc.status === 'processing'}
                          onChange={(e) => handleUpdateField(selectedDoc.id, 'documentType', e.target.value)}
                          className="w-full text-xs font-serif font-medium bg-[#050505] border border-[#222] rounded-sm py-2 px-3 text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] disabled:opacity-50 transition-all cursor-pointer"
                        >
                          {categories.filter(c => c.type !== 'الكل').map((cat) => (
                            <option key={cat.type} value={cat.type}>{cat.type}</option>
                          ))}
                        </select>
                      </div>

                      {/* Penalty Details Section (if type is عقوبة) */}
                      {selectedDoc.documentType === 'عقوبة' && (
                        <div className="p-3 bg-[#0a0a0a] border border-[#d4af37]/20 rounded-sm space-y-3 mt-1">
                          <div className="flex items-center gap-1.5 border-b border-[#1a1a1a] pb-1.5 mb-2">
                            <span className="w-1.5 h-3 bg-[#d4af37]"></span>
                            <span className="text-[10px] font-bold text-[#d4af37] tracking-wider font-serif">تفاصيل العقوبة الإدارية</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-serif font-bold text-[#888] block mb-1">نوع العقوبة</label>
                              <input
                                type="text"
                                value={selectedDoc.penaltyType || ''}
                                disabled={selectedDoc.status === 'processing'}
                                onChange={(e) => handleUpdateField(selectedDoc.id, 'penaltyType', e.target.value)}
                                className="w-full text-xs font-serif font-medium bg-[#050505] border border-[#222] rounded-sm py-2 px-3 text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] disabled:opacity-50 transition-all"
                                placeholder="توبيخ، إنذار..."
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-serif font-bold text-[#888] block mb-1">المادة القانونية</label>
                              <input
                                type="text"
                                value={selectedDoc.legalArticle || ''}
                                disabled={selectedDoc.status === 'processing'}
                                onChange={(e) => handleUpdateField(selectedDoc.id, 'legalArticle', e.target.value)}
                                className="w-full text-xs font-serif font-medium bg-[#050505] border border-[#222] rounded-sm py-2 px-3 text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] disabled:opacity-50 transition-all"
                                placeholder="المادة القانونية المستند عليها"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-serif font-bold text-[#888] block mb-1">سبب العقوبة</label>
                              <input
                                type="text"
                                value={selectedDoc.penaltyReason || ''}
                                disabled={selectedDoc.status === 'processing'}
                                onChange={(e) => handleUpdateField(selectedDoc.id, 'penaltyReason', e.target.value)}
                                className="w-full text-xs font-serif font-medium bg-[#050505] border border-[#222] rounded-sm py-2 px-3 text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] disabled:opacity-50 transition-all"
                                placeholder="المخالفة أو السبب"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-serif font-bold text-[#888] block mb-1">مدة العقوبة</label>
                              <input
                                type="text"
                                value={selectedDoc.penaltyDuration || ''}
                                disabled={selectedDoc.status === 'processing'}
                                onChange={(e) => handleUpdateField(selectedDoc.id, 'penaltyDuration', e.target.value)}
                                className="w-full text-xs font-serif font-medium bg-[#050505] border border-[#222] rounded-sm py-2 px-3 text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] disabled:opacity-50 transition-all"
                                placeholder="خمسة أيام، سنة..."
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* References Section */}
                      <div className="pt-3 border-t border-[#1a1a1a]">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-serif font-bold text-[#888] block">الكتب والمراجع الإدارية المشار إليها داخل النص</label>
                          <button
                            type="button"
                            disabled={selectedDoc.status === 'processing'}
                            onClick={() => {
                              const currentRefs = selectedDoc.references || [];
                              const updatedRefs = [...currentRefs, { referenceNumber: '', referenceDate: '', referenceAuthority: '' }];
                              handleUpdateField(selectedDoc.id, 'references', updatedRefs);
                            }}
                            className="text-[10px] text-[#d4af37] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            + إضافة مرجع
                          </button>
                        </div>

                        {(!selectedDoc.references || selectedDoc.references.length === 0) ? (
                          <div className="text-[10px] text-[#555] bg-[#050505] p-3 rounded-sm border border-[#161616] text-center">
                            لا توجد كتب أو إشارات مرجعية مستخلصة حالياً.
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                            {selectedDoc.references.map((ref, rIdx) => (
                              <div key={rIdx} className="bg-[#050505] border border-[#1c1c1c] p-2.5 rounded-sm relative group/ref">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedRefs = (selectedDoc.references || []).filter((_, i) => i !== rIdx);
                                    handleUpdateField(selectedDoc.id, 'references', updatedRefs);
                                  }}
                                  className="absolute top-2 left-2 text-[#555] hover:text-red-400 opacity-0 group-hover/ref:opacity-100 transition-all cursor-pointer"
                                  title="حذف المرجع"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[8px] text-[#666] block mb-0.5">الرقم الأخير</label>
                                    <input
                                      type="text"
                                      value={ref.referenceNumber}
                                      onChange={(e) => {
                                        const updatedRefs = [...(selectedDoc.references || [])];
                                        updatedRefs[rIdx] = { ...updatedRefs[rIdx], referenceNumber: e.target.value };
                                        handleUpdateField(selectedDoc.id, 'references', updatedRefs);
                                      }}
                                      className="w-full text-[10px] bg-[#0a0a0a] border border-[#222] rounded-xs py-1 px-1.5 text-white focus:outline-none focus:border-[#d4af37]"
                                      placeholder="الرقم"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[8px] text-[#666] block mb-0.5">التاريخ</label>
                                    <input
                                      type="text"
                                      value={ref.referenceDate}
                                      onChange={(e) => {
                                        const updatedRefs = [...(selectedDoc.references || [])];
                                        updatedRefs[rIdx] = { ...updatedRefs[rIdx], referenceDate: e.target.value };
                                        handleUpdateField(selectedDoc.id, 'references', updatedRefs);
                                      }}
                                      className="w-full text-[10px] bg-[#0a0a0a] border border-[#222] rounded-xs py-1 px-1.5 text-white focus:outline-none focus:border-[#d4af37]"
                                      placeholder="التاريخ"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[8px] text-[#666] block mb-0.5">الجهة</label>
                                    <input
                                      type="text"
                                      value={ref.referenceAuthority}
                                      onChange={(e) => {
                                        const updatedRefs = [...(selectedDoc.references || [])];
                                        updatedRefs[rIdx] = { ...updatedRefs[rIdx], referenceAuthority: e.target.value };
                                        handleUpdateField(selectedDoc.id, 'references', updatedRefs);
                                      }}
                                      className="w-full text-[10px] bg-[#0a0a0a] border border-[#222] rounded-xs py-1 px-1.5 text-white focus:outline-none focus:border-[#d4af37]"
                                      placeholder="الجهة"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* OCR Full Extracted Text Area */}
                      {selectedDoc.extractedText && (
                        <div>
                          <label className="text-[10px] font-serif font-bold text-[#888] block mb-1">
                            النص الكامل المستخرج كمرجع للنسخ والبحث:
                          </label>
                          <div className="w-full bg-transparent border-none text-[#ccc] p-1 text-[11px] font-mono leading-relaxed whitespace-pre-wrap selection:bg-[#d4af37]/30">
                            {selectedDoc.extractedText}
                          </div>
                        </div>
                      )}

                      {/* QR Code Verification Section */}
                      {selectedDoc.status === 'success' && qrCodeUrl && (
                        <div className="pt-3 border-t border-[#1a1a1a] space-y-2">
                          <label className="text-[10px] font-serif font-bold text-[#888] block">
                            تأصيل رقمي ومطابقة الـ QR Code للتحقق السريع:
                          </label>
                          <div className="bg-[#050505] border border-[#d4af3711] rounded-sm p-3.5 flex flex-col sm:flex-row items-center gap-4">
                            <div className="bg-white p-1.5 rounded-xs shrink-0 flex items-center justify-center shadow-md border border-[#222]">
                              <img src={qrCodeUrl} alt="Document QR Verification Code" className="w-28 h-28" />
                            </div>
                            <div className="flex-1 text-right space-y-2.5 w-full">
                              <p className="text-[11px] text-[#aaa] leading-relaxed">
                                امسح هذا الرمز بكاميرا الهاتف المحمول للانتقال الفوري إلى صفحة التحقق الرقمية الآمنة، للتأكد من مطابقة وصحة البيانات المستخلصة.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-32 text-[#444] flex flex-col items-center justify-center">
                    <FileText className="w-12 h-12 text-[#222] mb-3" />
                    <p className="text-xs">يرجى تحديد أي وثيقة من القائمة أو جدول الأرشيف الجانبي لتفعيل المفتش الذكي والتعديل والطباعة والتصدير.</p>
                  </div>
                )}
                </AnimatePresence>
              </div>
            )}

          </div>
          </div>
          </motion.div>
          </motion.div>
          )}
        </AnimatePresence>


                {/* Search Modal Overlay - Centered search box and isolated containers */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md text-right font-cairo"
              dir="rtl"
            >
              <motion.div
                initial={{ scale: 0.98, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.98, opacity: 0, y: 15 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="bg-[#090b0e] border border-gray-800/60 rounded-2xl w-full max-w-[98%] xl:max-w-[1550px] h-[95vh] flex flex-row shadow-2xl overflow-hidden relative"
              >
                {/* 1. Folders Sidebar */}
                <div className="w-72 bg-[#0a0c0f] border-l border-gray-800/40 flex flex-col shrink-0 hidden md:flex text-right" dir="rtl">
                  <div className="p-5 border-b border-gray-800/30 flex items-center gap-3 bg-[#0d0f13]/20">
                    <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
                      <Archive className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-white tracking-wide font-cairo">الخزينة والأرشفة</h3>
                      <p className="text-[10px] text-gray-500 font-cairo">تصنيفات ومجلدات اللواء الثامن</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
                    <div className="flex items-center justify-between px-2 mb-2">
                      <span className="text-[10px] font-bold text-gray-600 tracking-wider font-cairo">المجلدات والتبويبات</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(null);
                          setFolderFormName('');
                          setFolderFormLabel('');
                          setFolderFormColor('text-cyan-400 bg-cyan-500/10 border-cyan-500/20');
                          setShowFolderModal(true);
                        }}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer font-cairo transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        <span>إضافة مجلد</span>
                      </button>
                    </div>
                    
                    {categories.map((item) => {
                      const count = item.type === 'الكل' 
                        ? documents.length 
                        : documents.filter(d => (d.documentType || 'أخرى') === item.type).length;
                      const isSelected = filterType === item.type;
                      
                      return (
                        <div
                          key={item.type}
                          onClick={() => setFilterType(item.type)}
                          className={`w-full text-right p-3 rounded-xl flex items-center justify-between transition-all duration-200 cursor-pointer border group/item ${
                            isSelected
                              ? 'bg-cyan-950/20 border-cyan-500/30 text-white shadow-md shadow-cyan-500/5 font-black'
                              : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-900/40 hover:border-gray-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-1.5 rounded-lg border shrink-0 ${item.color}`}>
                              {isSelected ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                            </div>
                            <div className="truncate text-right">
                              <span className="text-xs font-bold block font-cairo">{item.type}</span>
                              <span className="text-[9px] text-gray-500 block truncate font-cairo">{item.label}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.type !== 'الكل' && item.type !== 'أخرى' && (
                              <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCategory(item);
                                    setFolderFormName(item.type);
                                    setFolderFormLabel(item.label);
                                    setFolderFormColor(item.color || 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20');
                                    setShowFolderModal(true);
                                  }}
                                  className="p-1 text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                                  title="تعديل المجلد"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                {item.isCustom && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCategory(item);
                                    }}
                                    className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    title="حذف المجلد"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                              isSelected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-800 text-gray-500'
                            }`}>
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-4 border-t border-gray-800/40 bg-[#07090c] text-[10px] text-gray-500 space-y-2 shrink-0">
                    <div className="flex justify-between items-center">
                      <span className="font-cairo">جاهز ومطابق:</span>
                      <span className="text-emerald-400 font-bold font-mono">{documents.filter(d => d.status === 'success').length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-cairo">تحت المعالجة والتحليل:</span>
                      <span className="text-amber-500 font-bold font-mono animate-pulse">{documents.filter(d => d.status === 'processing').length}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Main content area */}
                <div className="flex-1 flex flex-col bg-[#07080a] overflow-hidden">
                  
                  {/* Floating Search Bar container */}
                  <div className="p-5 border-b border-gray-800/30 bg-[#0d0f13]/40 backdrop-blur-sm shrink-0">
                    <div className="relative group max-w-3xl mx-auto w-full">
                      <div className="relative bg-[#0c0d10] border border-gray-800/80 hover:border-gray-700/80 focus-within:border-[#06b6d4]/50 rounded-2xl p-1 shadow-lg shadow-black/40 hover:shadow-[#06b6d4]/5 transition-all duration-300 flex items-center pr-3 pl-2 py-1">
                        <Search className="w-4 h-4 text-gray-500 shrink-0 mx-2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="البحث الشامل برقم الكتاب، موضوعه، تاريخه، الجهة الصادرة، النص، أو المراجع..."
                          className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none py-2 font-cairo"
                          autoFocus
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Header statistics and controllers */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-b border-gray-800/30 bg-[#0d0f13]/60 backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-3">
                      {/* Mobile folder select */}
                      <div className="md:hidden">
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="bg-gray-950 border border-gray-800 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none font-cairo"
                        >
                          {categories.map((cat) => (
                            <option key={cat.type} value={cat.type}>{cat.type}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="text-right">
                        <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 font-cairo justify-end">
                          <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-mono">{displayedDocs.length} من {documents.length}</span>
                          <span>أرشيف الكتب الرسمية</span>
                        </h2>
                        <p className="text-[10px] text-gray-500 mt-0.5 font-cairo">تصفح وفهرسة كافة وثائق اللواء الثامن</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
                      {/* Date Range filters */}
                      <div className="flex items-center gap-2 bg-gray-950 p-1.5 rounded-lg border border-gray-800/80 font-cairo">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500">من:</span>
                          <input 
                            type="date" 
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="bg-transparent text-[10px] text-gray-300 focus:outline-none focus:text-cyan-400 [&::-webkit-calendar-picker-indicator]:invert-[0.6] cursor-pointer" 
                          />
                        </div>
                        <div className="w-px h-3 bg-gray-800"></div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500">إلى:</span>
                          <input 
                            type="date" 
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="bg-transparent text-[10px] text-gray-300 focus:outline-none focus:text-cyan-400 [&::-webkit-calendar-picker-indicator]:invert-[0.6] cursor-pointer" 
                          />
                        </div>
                        {(filterStartDate || filterEndDate) && (
                          <button 
                            onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} 
                            className="text-gray-500 hover:text-red-400 mr-1 transition-colors"
                            title="مسح فلتر التاريخ"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Status filters */}
                      <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-lg border border-gray-800/80">
                        {[
                          { key: 'الكل', label: 'الكل' },
                          { key: 'success', label: 'جاهز' },
                          { key: 'processing', label: 'معالجة' },
                          { key: 'error', label: 'خطأ' }
                        ].map((st) => {
                          const isSelected = filterStatus === st.key;
                          return (
                            <button
                              key={st.key}
                              onClick={() => setFilterStatus(st.key)}
                              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer font-cairo ${
                                isSelected
                                  ? 'bg-[#111827] text-cyan-400 font-black'
                                  : 'text-gray-500 hover:text-gray-300'
                              }`}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Layout switcher */}
                      <div className="flex items-center bg-gray-950 p-1 rounded-lg border border-gray-800/80 shrink-0">
                        <button
                          onClick={() => setSearchViewMode('table')}
                          className={`p-1 rounded-md transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold ${
                            searchViewMode === 'table'
                              ? 'bg-[#111827] text-cyan-400'
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                          title="عرض جدول إداري"
                        >
                          <TableProperties className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSearchViewMode('grid')}
                          className={`p-1 rounded-md transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold ${
                            searchViewMode === 'grid'
                              ? 'bg-[#111827] text-cyan-400'
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                          title="عرض بطاقات"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Bulk actions */}
                      {documents.length > 0 && (
                        <button
                          onClick={handleClearAll}
                          className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/5 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-red-500/10 hover:border-red-500/20 transition-all cursor-pointer shrink-0 font-cairo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>تفريغ الأرشيف</span>
                        </button>
                      )}
                      
                      <button
                        onClick={() => setIsSearchOpen(false)}
                        className="p-1.5 text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="إغلاق"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                {/* Split layout inside Search Modal */}
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-[#080808]">
                  
                  {/* Left Pane: Documents Explorer List / Table */}
                  <div className={`w-full ${selectedDocId ? 'lg:w-[45%] border-l border-[#1c1c1c]' : 'lg:w-full'} flex flex-col bg-[#060606] overflow-hidden ${selectedDocId ? 'hidden lg:flex' : 'flex'}`}>
                    
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      {displayedDocs.length === 0 ? (
                        <div className="text-center py-24 text-[#444] flex flex-col items-center justify-center">
                          <Archive className="w-12 h-12 text-[#161616] mb-3" />
                          <p className="text-xs">لا توجد كتب أو مستندات تطابق شروط التصفية والبحث الحالية.</p>
                          {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="mt-3 text-xs text-[#d4af37] hover:underline cursor-pointer">
                              تصفير حقل البحث
                            </button>
                          )}
                        </div>
                      ) : searchViewMode === 'table' ? (
                        /* Professional Table View */
                        <div className="bg-[#0c0c0c] rounded-sm border border-[#1a1a1a] shadow-md overflow-x-hidden w-full">
                          <table className="w-full text-right border-collapse table-auto">
                            <thead>
                              <tr className="bg-[#050505] text-[#777] text-[9px] font-bold border-b border-[#1c1c1c] uppercase tracking-wider">
                                <th className="py-2 px-1 w-8 text-center">م</th>
                                <th className="py-2 px-1.5 text-right">موضوع وملخص الكتاب</th>
                                <th className="py-2 px-1.5 text-right">رقم الكتاب</th>
                                <th className="py-2 px-1.5 text-right">التاريخ</th>
                                <th className="py-2 px-1.5 text-right">جهة الإصدار</th>
                                <th className="py-2 px-1 text-center">الثقة</th>
                                <th className="py-2 px-1 text-center w-10">إجراء</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#161616] text-[10px]">
                              {displayedDocs.map((doc, idx) => {
                                const isSelected = doc.id === selectedDocId;
                                return (
                                  <tr
                                    key={doc.id}
                                    onClick={() => setSelectedDocId(doc.id)}
                                    className={`group cursor-pointer transition-all ${
                                      isSelected
                                        ? 'bg-[#d4af37]/10 text-white font-medium border-l-2 border-l-[#d4af37]'
                                        : 'hover:bg-[#111] text-[#aaa]'
                                    }`}
                                  >
                                    <td className="py-2 px-1 text-center font-mono text-[#555] group-hover:text-white">
                                      {idx + 1}
                                    </td>
                                    <td className="py-2 px-1.5">
                                      <div className="flex flex-col gap-0.5 max-w-[130px] sm:max-w-[160px] xl:max-w-[200px]">
                                        <span className="text-white truncate font-bold text-[11px]" title={doc.documentSubject || doc.fileName}>
                                          {doc.documentSubject || doc.fileName}
                                        </span>
                                        <span className="text-[8px] text-[#555] font-mono truncate">{doc.fileName}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-1.5 font-mono text-[10px] truncate max-w-[70px]" title={doc.documentNumber || ''}>
                                      {doc.documentNumber || (
                                        <span className="text-amber-500/60 text-[8px] italic">قيد الاستخلاص</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-1.5 font-serif text-[10px] truncate max-w-[75px]" title={doc.documentDate || ''}>
                                      {doc.documentDate || (
                                        <span className="text-amber-500/60 text-[8px] italic">قيد الاستخلاص</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-1.5 truncate max-w-[90px] text-[10px]" title={doc.issuingAuthority}>
                                      {doc.issuingAuthority || (
                                        <span className="text-[#444]">-</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-1 text-center font-mono">
                                      {doc.status === 'success' ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <span className="text-[10px] text-[#d4af37]">%{Math.round(doc.confidenceScore * 100)}</span>
                                        </div>
                                      ) : doc.status === 'processing' ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-amber-500 mx-auto" />
                                      ) : (
                                        <span className="text-red-500 font-mono">-%</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-1 text-center">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('هل أنت متأكد من حذف هذا المستند من الأرشيف نهائياً؟')) {
                                            handleDeleteDoc(doc.id, e);
                                          }
                                        }}
                                        className="p-1 text-[#444] hover:text-red-400 hover:bg-red-500/10 rounded-sm transition-all cursor-pointer"
                                        title="حذف نهائي"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        /* Card Grid View */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {displayedDocs.map((doc, idx) => {
                            const isSelected = doc.id === selectedDocId;
                            return (
                              <div
                                key={doc.id}
                                onClick={() => setSelectedDocId(doc.id)}
                                className={`p-4 rounded-sm border cursor-pointer text-right transition-all duration-200 relative overflow-hidden group ${
                                  isSelected 
                                    ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-white shadow-lg ring-1 ring-[#d4af37]/20' 
                                    : 'bg-[#0c0c0c] border-[#181818] hover:border-[#333] text-[#aaa]'
                                }`}
                              >
                                <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-br from-[#d4af37]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex justify-between items-center gap-2 mb-2">
                                  <span className="text-[9px] font-mono text-[#555]">#{idx + 1}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] bg-[#1a1a1a] px-2 py-0.5 rounded-sm text-[#888] font-serif border border-[#222]">
                                      {doc.documentType || 'أخرى'}
                                    </span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm ${
                                      doc.status === 'success' 
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                        : doc.status === 'processing'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                      {doc.status === 'success' ? 'جاهز' : doc.status === 'processing' ? 'جاري التحليل' : 'خطأ'}
                                    </span>
                                  </div>
                                </div>

                                <h4 className="text-xs font-bold text-white truncate max-w-full group-hover:text-[#d4af37] transition-colors" title={doc.documentSubject || doc.fileName}>
                                  {doc.documentSubject || doc.fileName}
                                </h4>

                                <div className="grid grid-cols-2 gap-1.5 mt-3 text-[10px] text-[#666] border-t border-[#161616] pt-2.5">
                                  <div>الرقم: <span className="font-mono text-[#aaa]">{doc.documentNumber || 'غير متوفر'}</span></div>
                                  <div>التاريخ: <span className="font-mono text-[#aaa]">{doc.documentDate || 'غير متوفر'}</span></div>
                                  <div className="col-span-2 truncate">الجهة: <span className="text-[#aaa]">{doc.issuingAuthority || 'غير متوفر'}</span></div>
                                </div>

                                <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#141414] text-[9px] text-[#444]">
                                  <span>الثقة: <strong className="text-[#888]">%{Math.round(doc.confidenceScore * 100)}</strong></span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('هل أنت متأكد من حذف هذا المستند؟')) {
                                        handleDeleteDoc(doc.id, e);
                                      }
                                    }}
                                    className="text-red-500/40 hover:text-red-400 p-1 rounded-sm hover:bg-red-500/5 transition-all"
                                  >
                                    حذف
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Pane: Selected Document Full Details Inspector & Verification Hub */}
                  {selectedDocId && (
                    <div className="w-full lg:w-[55%] overflow-y-auto p-6 md:p-8 bg-[#0c0c0c] border-r border-[#1a1a1a] custom-scrollbar block">
                      {selectedDoc ? (
                        <div className="space-y-6">
                          
                          {/* Detail Header & Action Hub */}
                          <div className="pb-5 border-b border-[#1c1c1c] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-3 w-full flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedDocId(null)}
                              className="lg:hidden p-2 text-[#888] hover:text-white bg-[#111] hover:bg-[#1c1c1c] border border-[#222] rounded-sm cursor-pointer flex items-center gap-1 font-cairo font-bold text-[11px] transition-all shrink-0"
                              title="العودة إلى جدول البحث"
                            >
                              <ChevronLeft className="w-4 h-4 rotate-180 text-[#d4af37]" />
                              <span>العودة للجدول</span>
                            </button>
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <span className="text-[10px] text-[#888] font-mono tracking-wider block">اسم الملف للوثيقة المفتوحة:</span>
                              <span className="text-sm font-bold text-[#d4af37] bg-black/40 border border-[#1a1a1a] rounded-sm px-3.5 py-2 font-mono block break-all whitespace-pre-wrap leading-relaxed shadow-inner" title={selectedDoc.fileName}>
                                {selectedDoc.fileName}
                              </span>
                            </div>
                          </div>
                        </div>

                          {/* Mode toggle bar */}
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0d0d0d] border border-[#1a1a1a] p-3 rounded-sm mb-4">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-[#d4af37]" />
                              <span className="text-xs font-bold text-white font-cairo">وضع المراجعة الحالي:</span>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => setIsReadOnlyArchive(true)}
                                className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                                  isReadOnlyArchive 
                                    ? 'bg-[#d4af37]/10 border-[#d4af37]/30 text-[#d4af37]' 
                                    : 'bg-[#121212] border-[#222] text-[#888] hover:text-white'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>نمط القراءة فقط (مريح للعين)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsReadOnlyArchive(false)}
                                className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                                  !isReadOnlyArchive 
                                    ? 'bg-[#d4af37]/20 border-[#d4af37]/40 text-[#d4af37]' 
                                    : 'bg-[#121212] border-[#222] text-[#888] hover:text-white'
                                }`}
                              >
                                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                                <span>تعديل البيانات والمدخلات</span>
                              </button>
                            </div>
                          </div>

                          {isReadOnlyArchive ? (
                              /* --- READ ONLY REVIEW MODE --- */
                              <div className="space-y-6">
                                {/* Font Size Controller */}
                                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#12110c]/40 border border-[#262218]/20 rounded-sm text-xs">
                                  <div className="flex items-center gap-1.5 text-[#888]">
                                    <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                                    <span className="font-cairo">تعديل حجم خط القراءة لراحة العين:</span>
                                  </div>
                                  <div className="flex gap-1">
                                    {(['sm', 'base', 'lg', 'xl'] as const).map((sz) => (
                                      <button
                                        key={sz}
                                        type="button"
                                        onClick={() => setReadOnlyFontSize(sz)}
                                        className={`px-2.5 py-1 rounded-xs font-bold text-[10px] transition-all cursor-pointer ${
                                          readOnlyFontSize === sz
                                            ? 'bg-[#d4af37] text-black shadow-md'
                                            : 'bg-[#1a1a1a] text-[#888] hover:text-white'
                                        }`}
                                      >
                                        {sz === 'sm' ? 'صغير' : sz === 'base' ? 'افتراضي' : sz === 'lg' ? 'كبير' : 'كبير جداً'}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Official Metadata Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="bg-[#0a0a0a] border border-[#161616] rounded-sm p-4 flex flex-col justify-between space-y-1.5">
                                    <span className="text-[10px] text-[#888] font-black uppercase tracking-wider block">رقم الكتاب / القرار الإداري:</span>
                                    <span className="text-xs md:text-sm font-mono font-bold text-white bg-[#121212] border border-[#1e1e1e] px-2.5 py-2 rounded-xs inline-block text-right">
                                      {selectedDoc.documentNumber || 'غير مستخلص'}
                                    </span>
                                  </div>
                                  <div className="bg-[#0a0a0a] border border-[#161616] rounded-sm p-4 flex flex-col justify-between space-y-1.5">
                                    <span className="text-[10px] text-[#888] font-black uppercase tracking-wider block">تاريخ صدور الكتاب:</span>
                                    <span className="text-xs md:text-sm font-serif font-bold text-white bg-[#121212] border border-[#1e1e1e] px-2.5 py-2 rounded-xs inline-block text-right">
                                      {selectedDoc.documentDate || 'غير مستخلص'}
                                    </span>
                                  </div>
                                  <div className="bg-[#0a0a0a] border border-[#161616] rounded-sm p-4 flex flex-col justify-between space-y-1.5">
                                    <span className="text-[10px] text-[#888] font-black uppercase tracking-wider block">جهة الإصدار الرسمية:</span>
                                    <span className="text-xs md:text-sm font-bold text-[#e5e5e5] bg-[#121212] border border-[#1e1e1e] px-2.5 py-2 rounded-xs inline-block text-right">
                                      {selectedDoc.issuingAuthority || 'غير مستخلص'}
                                    </span>
                                  </div>
                                  <div className="bg-[#0a0a0a] border border-[#161616] rounded-sm p-4 flex flex-col justify-between space-y-1.5">
                                    <span className="text-[10px] text-[#888] font-black uppercase tracking-wider block">الجهة الموجه إليها الكتاب:</span>
                                    <span className="text-xs md:text-sm font-bold text-[#e5e5e5] bg-[#121212] border border-[#1e1e1e] px-2.5 py-2 rounded-xs inline-block text-right">
                                      {selectedDoc.destinationAuthority || 'غير مستخلص'}
                                    </span>
                                  </div>
                                  <div className="bg-[#0a0a0a] border border-[#161616] rounded-sm p-4 flex flex-col justify-between space-y-1.5 sm:col-span-2">
                                    <span className="text-[10px] text-[#888] font-black uppercase tracking-wider block">تصنيف الوثيقة الإدارية:</span>
                                    <span className="text-xs md:text-sm font-bold text-[#d4af37] bg-[#12110c] border border-[#d4af37]/20 px-2.5 py-2 rounded-xs inline-block text-right">
                                      {selectedDoc.documentType || 'أخرى'}
                                    </span>
                                  </div>
                                </div>

                                {/* Names Section */}
                                <div className="bg-[#0b0c0d] border border-[#1a1c1e] rounded-sm p-4">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] text-[#888] font-black uppercase tracking-wider flex items-center gap-1.5 font-cairo">
                                      <Users className="w-3.5 h-3.5 text-[#d4af37]" />
                                      الأسماء والمنتسبين المذكورين بالكتاب:
                                    </span>
                                    {selectedDoc.employeeNames && (
                                      <span className="text-[9px] bg-[#1a1c1e] text-[#aaa] border border-[#26292c] px-2 py-0.5 rounded-sm font-mono">
                                        إجمالي الأسماء: {selectedDoc.employeeNames.split(/[\n,;،]+/).map(n => n.trim()).filter(n => n.length > 0).length}
                                      </span>
                                    )}
                                  </div>
                                  {selectedDoc.employeeNames ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {selectedDoc.employeeNames.split(/[\n,;،]+/).map(n => n.trim()).filter(n => n.length > 0).map((name, nameIdx) => (
                                        <div 
                                          key={nameIdx} 
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141619] border border-[#1c1f24] rounded-sm text-xs font-medium text-[#d1d5db]"
                                        >
                                          <span className="text-[9px] font-mono text-[#d4af37] bg-black/40 w-4 h-4 rounded-full flex items-center justify-center border border-[#d4af37]/20">
                                            {nameIdx + 1}
                                          </span>
                                          <span>{name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-[#555] italic text-center py-2">لا توجد أسماء مسجلة حالياً في هذا الكتاب.</p>
                                  )}
                                </div>

                                {/* Custom Penalty Fields */}
                                {selectedDoc.documentType === 'عقوبة' && (
                                  <div className="bg-[#1b1212] border border-[#4a1f1f]/35 rounded-sm p-4 space-y-3">
                                    <div className="flex items-center gap-1.5 border-b border-[#4a1f1f]/20 pb-2">
                                      <AlertCircle className="w-4 h-4 text-red-400" />
                                      <span className="text-xs font-bold text-red-200 font-cairo">تفاصيل العقوبة الإدارية المسجلة:</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div className="p-2 bg-black/30 rounded-xs">
                                        <span className="text-[8px] text-[#888] block">نوع العقوبة:</span>
                                        <span className="text-xs font-bold text-red-300">{selectedDoc.penaltyType || 'غير مستخلص'}</span>
                                      </div>
                                      <div className="p-2 bg-black/30 rounded-xs">
                                        <span className="text-[8px] text-[#888] block">المادة القانونية:</span>
                                        <span className="text-xs font-mono text-red-300">{selectedDoc.legalArticle || 'غير مستخلص'}</span>
                                      </div>
                                      <div className="p-2 bg-black/30 rounded-xs">
                                        <span className="text-[8px] text-[#888] block">سبب العقوبة:</span>
                                        <span className="text-xs text-red-300">{selectedDoc.penaltyReason || 'غير مستخلص'}</span>
                                      </div>
                                      <div className="p-2 bg-black/30 rounded-xs">
                                        <span className="text-[8px] text-[#888] block">مدة العقوبة:</span>
                                        <span className="text-xs font-bold text-red-300">{selectedDoc.penaltyDuration || 'غير مستخلص'}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* References List (Sub-documents mentioned in the text) */}
                                <div className="bg-[#0a0a0a] border border-[#161616] rounded-sm p-4 space-y-3.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#888] font-black uppercase tracking-wider block">الكتب والمستندات الفرعية المذكورة في هذا الكتاب (الإشارات المرجعية):</span>
                                    {selectedDoc.references && selectedDoc.references.length > 0 && (
                                      <span className="text-[9px] bg-amber-500/10 text-[#d4af37] border border-amber-500/20 px-2 py-0.5 rounded-sm">
                                        عدد الكتب المستخلصة: {selectedDoc.references.length}
                                      </span>
                                    )}
                                  </div>
                                  {(!selectedDoc.references || selectedDoc.references.length === 0) ? (
                                    <p className="text-xs text-[#444] italic py-2">لا توجد كتب مرجعية أو إشارات فرعية مسجلة حالياً في هذا الكتاب.</p>
                                  ) : (
                                    <div className="space-y-4">
                                      {selectedDoc.references.map((ref, rIdx) => (
                                        <div key={rIdx} className="bg-[#0e0e10] border border-[#1a1c20] p-4 rounded-sm space-y-3 hover:border-amber-500/20 transition-all">
                                          <div className="flex items-center gap-2 border-b border-[#1a1c20] pb-2">
                                            <span className="text-[9px] bg-amber-500/10 text-[#d4af37] border border-amber-500/20 w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold">
                                              {rIdx + 1}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-300 font-cairo">تفاصيل المستند / المرجع الفرعي المذكور:</span>
                                          </div>
                                          
                                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {/* Sub-doc Number */}
                                            <div className="space-y-1">
                                              <span className="text-[9px] text-[#666] block font-bold">رقم الكتاب الفرعي / المرجع:</span>
                                              <span className="text-xs font-bold text-white block bg-[#050505] border border-[#161616] px-3 py-2 rounded-sm font-mono text-right">
                                                {ref.referenceNumber || 'غير متوفر'}
                                              </span>
                                            </div>
                                            {/* Sub-doc Date */}
                                            <div className="space-y-1">
                                              <span className="text-[9px] text-[#666] block font-bold">تاريخ الكتاب الفرعي:</span>
                                              <span className="text-xs font-bold text-white block bg-[#050505] border border-[#161616] px-3 py-2 rounded-sm font-serif text-right">
                                                {ref.referenceDate || 'غير متوفر'}
                                              </span>
                                            </div>
                                            {/* Sub-doc Issuing Authority */}
                                            <div className="space-y-1">
                                              <span className="text-[9px] text-[#666] block font-bold">جهة إصدار الكتاب الفرعي:</span>
                                              <span className="text-xs font-bold text-amber-400 block bg-[#050505] border border-[#161616] px-3 py-2 rounded-sm text-right">
                                                {ref.referenceAuthority || 'غير متوفر'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Full Text Content Display (Always at the very bottom of read-only mode) */}
                                <div className="bg-[#12110c] border border-[#2b2516]/40 rounded-sm p-5 md:p-6 shadow-sm relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-[#d4af37]/5 to-transparent pointer-events-none"></div>
                                  <div className="flex items-center gap-2 mb-3 border-b border-[#2b2516]/20 pb-2">
                                    <Sparkles className="w-4 h-4 text-[#d4af37]" />
                                    <span className="text-[10px] text-[#d4af37] font-black uppercase tracking-wider block">النص الكامل والأصلي لمحتوى الكتاب الإداري:</span>
                                  </div>
                                  <p className={`text-white whitespace-pre-wrap leading-relaxed ${
                                    readOnlyFontSize === 'sm' ? 'text-xs md:text-sm' :
                                    readOnlyFontSize === 'base' ? 'text-sm md:text-base' :
                                    readOnlyFontSize === 'lg' ? 'text-base md:text-lg' : 'text-lg md:text-xl'
                                  }`}>
                                    {selectedDoc.documentContent || selectedDoc.documentSubject || 'لا يوجد مضمون مكتوب لهذا الكتاب'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              /* --- EDITABLE MODE --- */
                              <>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  
                                    <div className="col-span-1 md:col-span-2 space-y-1.5">
                                      <span className="text-[10px] text-[#d4af37] block font-black uppercase tracking-wider">الأسماء الواردة في الكتاب (اسم في كل سطر أو مفصولة بفواصل):</span>
                                      <textarea 
                                        value={selectedDoc.employeeNames || ''}
                                        disabled={selectedDoc.status === 'processing'}
                                        onChange={(e) => handleUpdateField(selectedDoc.id, 'employeeNames', e.target.value)}
                                        className="w-full bg-[#0d0d0d] border border-[#222] focus:border-[#d4af37] text-xs text-white px-3 py-2 rounded-sm focus:outline-none transition-all min-h-[70px] font-sans"
                                        placeholder="أدخل الأسماء الموجودة بالكتاب، اسم في كل سطر أو مفصولة بفاصلة لترقيمها عند تصدير إكسل..."
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <span className="text-[10px] text-[#888] block font-black uppercase tracking-wider">رقم الكتاب / القرار:</span>
                                      <input 
                                        type="text"
                                        value={selectedDoc.documentNumber || ''}
                                        disabled={selectedDoc.status === 'processing'}
                                        onChange={(e) => handleUpdateField(selectedDoc.id, 'documentNumber', e.target.value)}
                                        className="w-full bg-transparent border-b border-[#222] focus:border-[#d4af37] text-xs text-white font-mono px-2 py-2 focus:outline-none transition-all"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <span className="text-[10px] text-[#888] block font-black uppercase tracking-wider">تاريخ الكتاب:</span>
                                      <input 
                                        type="text"
                                        value={selectedDoc.documentDate || ''}
                                        disabled={selectedDoc.status === 'processing'}
                                        onChange={(e) => handleUpdateField(selectedDoc.id, 'documentDate', e.target.value)}
                                        className="w-full bg-transparent border-b border-[#222] focus:border-[#d4af37] text-xs text-white font-serif px-2 py-2 focus:outline-none transition-all"
                                      />
                                    </div>
                                    <div className="space-y-1.5 col-span-1 md:col-span-2">
                                      <span className="text-[10px] text-[#888] block font-black uppercase tracking-wider">جهة الإصدار الرسمية:</span>
                                      <input 
                                        type="text"
                                        value={selectedDoc.issuingAuthority || ''}
                                        disabled={selectedDoc.status === 'processing'}
                                        onChange={(e) => handleUpdateField(selectedDoc.id, 'issuingAuthority', e.target.value)}
                                        className="w-full bg-transparent border-b border-[#222] focus:border-[#d4af37] text-xs text-white px-2 py-2 focus:outline-none transition-all"
                                      />
                                    </div>
                                    <div className="space-y-1.5 col-span-1 md:col-span-2">
                                      <span className="text-[10px] text-[#888] block font-black uppercase tracking-wider">الجهة الموجه إليها الكتاب:</span>
                                      <input 
                                        type="text"
                                        value={selectedDoc.destinationAuthority || ''}
                                        disabled={selectedDoc.status === 'processing'}
                                        onChange={(e) => handleUpdateField(selectedDoc.id, 'destinationAuthority', e.target.value)}
                                        className="w-full bg-transparent border-b border-[#222] focus:border-[#d4af37] text-xs text-white px-2 py-2 focus:outline-none transition-all"
                                      />
                                    </div>
                                    <div className="space-y-1.5 col-span-1 md:col-span-2">
                                      <span className="text-[10px] text-[#888] block font-black uppercase tracking-wider">نوع الوثيقة الإدارية:</span>
                                      <select 
                                        value={selectedDoc.documentType || 'أخرى'}
                                        disabled={selectedDoc.status === 'processing'}
                                        onChange={(e) => handleUpdateField(selectedDoc.id, 'documentType', e.target.value)}
                                        className="w-full bg-transparent border-b border-[#222] focus:border-[#d4af37] text-xs text-white px-2 py-2 focus:outline-none cursor-pointer transition-all"
                                      >
                                        {categories.filter(c => c.type !== 'الكل').map((cat) => (
                                          <option key={cat.type} value={cat.type}>{cat.type}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                {/* Custom Fields depending on selection */}
                                {selectedDoc.documentType === 'عقوبة' && (
                              <div className="pt-5 border-t border-[#1c1c1c] space-y-3.5">
                                <span className="text-[10px] font-black text-[#d4af37] block uppercase tracking-wider">تفاصيل عقوبة كتاب الأمر الإداري:</span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[9px] text-[#666] block mb-1 font-bold">نوع العقوبة</label>
                                    <input 
                                      type="text"
                                      value={selectedDoc.penaltyType || ''}
                                      onChange={(e) => handleUpdateField(selectedDoc.id, 'penaltyType', e.target.value)}
                                      className="w-full bg-transparent border-b border-[#222] focus:border-[#d4af37] text-xs text-white py-2 focus:outline-none transition-all"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-[#666] block mb-1 font-bold">المادة القانونية</label>
                                    <input 
                                      type="text"
                                      value={selectedDoc.legalArticle || ''}
                                      onChange={(e) => handleUpdateField(selectedDoc.id, 'legalArticle', e.target.value)}
                                      className="w-full bg-transparent border-b border-[#222] focus:border-[#d4af37] text-xs text-white py-2 focus:outline-none transition-all"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-[#666] block mb-1 font-bold">سبب العقوبة</label>
                                    <input 
                                      type="text"
                                      value={selectedDoc.penaltyReason || ''}
                                      onChange={(e) => handleUpdateField(selectedDoc.id, 'penaltyReason', e.target.value)}
                                      className="w-full bg-transparent border-b border-[#222] focus:border-[#d4af37] text-xs text-white py-2 focus:outline-none transition-all"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-[#666] block mb-1 font-bold">المدة الزمنية</label>
                                    <input 
                                      type="text"
                                      value={selectedDoc.penaltyDuration || ''}
                                      onChange={(e) => handleUpdateField(selectedDoc.id, 'penaltyDuration', e.target.value)}
                                      className="w-full bg-transparent border-b border-[#222] focus:border-[#d4af37] text-xs text-white py-2 focus:outline-none transition-all"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* References lists */}
                            <div className="pt-5 border-t border-[#1c1c1c] space-y-3.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-[#888] font-black uppercase tracking-wider">الكتب والمراجع المستخلصة:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentRefs = selectedDoc.references || [];
                                    const updatedRefs = [...currentRefs, { referenceNumber: '', referenceDate: '', referenceAuthority: '' }];
                                    handleUpdateField(selectedDoc.id, 'references', updatedRefs);
                                  }}
                                  className="text-[10px] text-[#d4af37] hover:underline font-bold cursor-pointer"
                                >
                                  + إضافة مرجع إداري جديد
                                </button>
                              </div>

                              {(!selectedDoc.references || selectedDoc.references.length === 0) ? (
                                <span className="text-[10px] text-[#444] block text-center py-4 bg-black/20 border border-dashed border-[#1c1c1c] rounded-xs">لا توجد إشارات مرجعية مسجلة حالياً.</span>
                              ) : (
                                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                                  {selectedDoc.references.map((ref, rIdx) => (
                                    <div key={rIdx} className="bg-black/30 border border-[#1c1c1c] p-3 rounded-xs relative group/ref transition-all">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedRefs = (selectedDoc.references || []).filter((_, i) => i !== rIdx);
                                          handleUpdateField(selectedDoc.id, 'references', updatedRefs);
                                        }}
                                        className="absolute left-2 top-2 text-[#444] hover:text-red-400 opacity-0 group-hover/ref:opacity-100 transition-all cursor-pointer p-1 rounded-sm bg-black/60"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                        <div>
                                          <label className="text-[8px] text-[#666] block mb-1 font-bold">الرقم المرجعي</label>
                                          <input 
                                            type="text"
                                            value={ref.referenceNumber}
                                            onChange={(e) => {
                                              const updatedRefs = [...(selectedDoc.references || [])];
                                              updatedRefs[rIdx] = { ...updatedRefs[rIdx], referenceNumber: e.target.value };
                                              handleUpdateField(selectedDoc.id, 'references', updatedRefs);
                                            }}
                                            className="w-full text-xs bg-transparent border-b border-[#222] focus:border-[#d4af37] px-2 py-1 text-white focus:outline-none"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[8px] text-[#666] block mb-1 font-bold">التاريخ المرجعي</label>
                                          <input 
                                            type="text"
                                            value={ref.referenceDate}
                                            onChange={(e) => {
                                              const updatedRefs = [...(selectedDoc.references || [])];
                                              updatedRefs[rIdx] = { ...updatedRefs[rIdx], referenceDate: e.target.value };
                                              handleUpdateField(selectedDoc.id, 'references', updatedRefs);
                                            }}
                                            className="w-full text-xs bg-transparent border-b border-[#222] focus:border-[#d4af37] px-2 py-1 text-white focus:outline-none"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[8px] text-[#666] block mb-1 font-bold">الجهة المرجعية</label>
                                          <input 
                                            type="text"
                                            value={ref.referenceAuthority}
                                            onChange={(e) => {
                                              const updatedRefs = [...(selectedDoc.references || [])];
                                              updatedRefs[rIdx] = { ...updatedRefs[rIdx], referenceAuthority: e.target.value };
                                              handleUpdateField(selectedDoc.id, 'references', updatedRefs);
                                            }}
                                            className="w-full text-xs bg-transparent border-b border-[#222] focus:border-[#d4af37] px-2 py-1 text-white focus:outline-none"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                                  
                                  {/* Full Text Content Editing (Always at the very bottom of editable mode) */}
                                  <div className="pt-5 border-t border-[#1c1c1c] space-y-1.5">
                                    <span className="text-[10px] text-[#d4af37] block font-black uppercase tracking-wider">تفاصيل وثيقة الأرشفة / مضمون الكتاب (تصميم حر بدون حدود أو صناديق مقيدة):</span>
                                    <textarea 
                                      value={selectedDoc.documentContent || selectedDoc.documentSubject || ''}
                                      disabled={selectedDoc.status === 'processing'}
                                      ref={(el) => {
                                        if (el) {
                                          el.style.height = 'auto';
                                          el.style.height = `${Math.max(el.scrollHeight, 550)}px`;
                                        }
                                      }}
                                      onChange={(e) => {
                                        handleUpdateField(selectedDoc.id, 'documentContent', e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = `${Math.max(e.target.scrollHeight, 550)}px`;
                                      }}
                                      className="w-full text-sm bg-transparent border-0 border-r-2 border-[#d4af37]/40 focus:border-[#d4af37] py-3 px-4 text-white leading-relaxed focus:outline-none focus:ring-0 resize-none overflow-hidden transition-all min-h-[550px] shadow-none"
                                      placeholder="اكتب مضمون وتفاصيل الكتاب بحرية كاملة دون حدود للارتفاع أو خلفية مقيدة..."
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Digital sealing / verification QR Code */}
                            {selectedDoc.status === 'success' && qrCodeUrl && (
                              <div className="pt-5 border-t border-[#1c1c1c] flex flex-col sm:flex-row items-center gap-4">
                                <div className="bg-white p-2 rounded-xs shrink-0 border border-[#1c1c1c]">
                                  <img src={qrCodeUrl} alt="Verification QR" className="w-24 h-24" />
                                </div>
                                <div className="flex-1 space-y-2 text-right">
                                  <span className="text-[11px] font-black text-[#d4af37] block">المطابقة والتصديق الرقمي المباشر</span>
                                  <p className="text-[10px] text-[#666] leading-relaxed">
                                    امسح رمز الـ QR بكاميرا هاتفك للتحقق السريع ومطابقة البيانات الأصلية عبر بوابة التحقق الرقمي الآمنة للمنظومة.
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const verificationUrl = encodeMetadata(selectedDoc);
                                        navigator.clipboard.writeText(verificationUrl);
                                        setCopyFeedback(true);
                                        setTimeout(() => setCopyFeedback(false), 2000);
                                      }}
                                      className="bg-[#0c0c0c] hover:bg-[#161616] text-[#d4af37] border border-[#1c1c1c] text-[10px] px-3 py-1.5 rounded-sm cursor-pointer flex items-center gap-1.5 transition-all"
                                    >
                                      {copyFeedback ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                      <span>{copyFeedback ? 'تم النسخ!' : 'نسخ رابط التصديق'}</span>
                                    </button>
                                    <a
                                      href={encodeMetadata(selectedDoc)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-[#d4af3710] text-[#d4af37] border border-[#d4af3722] text-[10px] px-3 py-1.5 rounded-sm flex items-center gap-1.5 hover:bg-[#d4af371c] transition-all"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>بوابة التحقق الآمنة</span>
                                    </a>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Footer status indicator */}
                            <div className="flex justify-between items-center text-[10px] text-[#555] pt-2 border-t border-[#121212]">
                              <span>معرف الوثيقة الفريد: <span className="font-mono text-[#777]">{selectedDoc.id.substring(0, 8)}</span></span>
                              <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xs font-bold border border-emerald-500/20 text-[9px] tracking-wider">جاهز ومطابق</span>
                            </div>

                          </div>
                        ) : (
                      <div className="text-center py-32 text-[#444] flex flex-col items-center justify-center">
                        <FileText className="w-12 h-12 text-[#222] mb-3" />
                        <p className="text-xs">يرجى تحديد أي وثيقة من القائمة أو جدول الأرشيف الجانبي لتفعيل المفتش الذكي والتعديل والطباعة والتصدير.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-[#1a1a1a] bg-[#050505] flex justify-between items-center text-[10px] text-[#666]">
                  <span>إجمالي المستندات المؤرشفة: <strong className="text-white">{documents.length}</strong> وثيقة رسمية</span>
                  <button
                    onClick={() => setIsSearchOpen(false)}
                    className="px-5 py-2 bg-[#d4af37] hover:bg-[#b8962d] text-black text-xs font-bold rounded-sm cursor-pointer transition-colors"
                  >
                    إغلاق الأرشيف والبحث
                  </button>
                </div>
              </div> {/* Closes 2. Main content area */}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


        {/* Folder Creator / Editor Modal */}
        <AnimatePresence>
          {showFolderModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-[#0c0d10] border border-gray-800/80 rounded-2xl w-full max-w-md shadow-2xl p-6 text-right font-cairo overflow-hidden relative"
                dir="rtl"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-cyan-500/5 to-transparent pointer-events-none"></div>
                <div className="flex items-center justify-between border-b border-gray-800/40 pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white font-cairo">
                        {editingCategory ? 'تعديل بيانات المجلد' : 'إنشاء مجلد مخصص جديد'}
                      </h3>
                      <p className="text-[10px] text-gray-500 font-cairo mt-0.5">
                        {editingCategory ? 'تعديل تصنيفات وفهرسة المجلد الحالي' : 'إضافة تبويب جديد لتصنيف وأرشفة كتب اللواء'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowFolderModal(false);
                      setEditingCategory(null);
                    }}
                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-900 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveCategory} className="space-y-4">
                  {/* Category Code/Type */}
                  <div>
                    <label className="text-[11px] text-gray-400 font-bold block mb-1.5 font-cairo">اسم المجلد / الكلمة المفتاحية (مثال: سري، محاضر، أوامر):</label>
                    <input
                      type="text"
                      value={folderFormName}
                      onChange={(e) => setFolderFormName(e.target.value)}
                      placeholder="أدخل اسماً فريداً باللغة العربية..."
                      disabled={editingCategory ? !editingCategory.isCustom : false}
                      className="w-full text-xs bg-[#060709] border border-gray-800 focus:border-cyan-500/60 rounded-xl py-3 px-4 text-white focus:outline-none transition-all font-cairo disabled:opacity-50"
                    />
                    {editingCategory && !editingCategory.isCustom && (
                      <span className="text-[9px] text-amber-500/80 block mt-1 font-cairo">هذا مجلد أساسي للنظام؛ يمكن فقط تعديل الوصف واللون المخصصين له.</span>
                    )}
                  </div>

                  {/* Category Label */}
                  <div>
                    <label className="text-[11px] text-gray-400 font-bold block mb-1.5 font-cairo">وصف المجلد / الشرح (توضيح طبيعة الملفات المؤرشفة):</label>
                    <input
                      type="text"
                      value={folderFormLabel}
                      onChange={(e) => setFolderFormLabel(e.target.value)}
                      placeholder="مثال: كافة مراسلات اللواء السرية والوارد الصادر..."
                      className="w-full text-xs bg-[#060709] border border-gray-800 focus:border-cyan-500/60 rounded-xl py-3 px-4 text-white focus:outline-none transition-all font-cairo"
                    />
                  </div>

                  {/* Category Color Picker */}
                  <div>
                    <label className="text-[11px] text-gray-400 font-bold block mb-2 font-cairo">اختر اللون المميز للمجلد:</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { name: 'سماوي', val: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
                        { name: 'كحلي', val: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
                        { name: 'أحمر', val: 'text-red-400 bg-red-500/10 border-red-500/20' },
                        { name: 'بنفسجي', val: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
                        { name: 'أخضر', val: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                        { name: 'ذهبي', val: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                        { name: 'أزرق', val: 'text-blue-400 bg-blue-500/10 border-blue-400/20' },
                        { name: 'فضي', val: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
                        { name: 'برتقالي', val: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
                        { name: 'رمادي', val: 'text-gray-400 bg-gray-500/10 border-gray-500/20' }
                      ].map((col) => {
                        const isSelected = folderFormColor === col.val;
                        const textCol = col.val.split(' ')[0];
                        const bgCol = col.val.split(' ')[1];
                        return (
                          <button
                            type="button"
                            key={col.val}
                            onClick={() => setFolderFormColor(col.val)}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${bgCol} ${
                              isSelected ? 'border-white/50 scale-105 shadow-md' : 'border-transparent hover:border-gray-700'
                            }`}
                            title={col.name}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full ${textCol.replace('text-', 'bg-')} inline-block`} />
                            <span className="text-[8px] text-gray-400 block font-cairo truncate w-full text-center">{col.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-800/40 mt-5">
                    <button
                      type="submit"
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-black py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer font-cairo text-center shadow-lg shadow-cyan-500/10"
                    >
                      {editingCategory ? 'حفظ التعديلات' : 'إنشاء المجلد الجديد'}
                    </button>
                    {editingCategory && editingCategory.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(editingCategory)}
                        className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer font-cairo"
                      >
                        حذف المجلد
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowFolderModal(false);
                        setEditingCategory(null);
                      }}
                      className="bg-gray-900 hover:bg-gray-800 text-gray-300 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer font-cairo"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* Excel Export Advanced Modal */}
        <AnimatePresence>
          {showExcelExportModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-sm w-full max-w-md shadow-2xl p-6"
                dir="rtl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-500/10 rounded-sm">
                    <Download className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-cairo">تصدير مخصص إلى إكسل (Excel)</h3>
                    <p className="text-xs text-[#888] mt-0.5">قم بتكوين خيارات تصفية وترتيب البيانات المصدرة</p>
                  </div>
                </div>

                <div className="space-y-4 my-6">
                  {/* Branch filter selection */}
                  <div>
                    <label className="text-xs text-[#aaa] font-bold block mb-1.5">تحديد فرع التصدير:</label>
                    <select
                      value={excelExportBranch}
                      onChange={(e) => setExcelExportBranch(e.target.value)}
                      className="w-full bg-[#161616] border border-[#262626] rounded-sm text-sm text-white px-3 py-2 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="all">كافة الفروع والكتب</option>
                      {categories.filter(c => c.type !== 'الكل').map((cat) => (
                        <option key={cat.type} value={cat.type}>{cat.type}</option>
                      ))}
                    </select>
                  </div>

                  {/* Split names hierarchy */}
                  <div>
                    <label className="text-xs text-[#aaa] font-bold block mb-1.5">هيكلية الأسماء المصدرة:</label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2.5 p-2.5 bg-[#141414] border border-[#1f1f1f] rounded-sm cursor-pointer hover:border-[#333] transition-colors">
                        <input
                          type="radio"
                          name="excelSplit"
                          checked={excelExportSplitNames === true}
                          onChange={() => setExcelExportSplitNames(true)}
                          className="mt-0.5 accent-emerald-500"
                        />
                        <div>
                          <span className="text-xs text-white font-bold block">توزيع الأسماء لأسطر متعددة (تفصيلي)</span>
                          <span className="text-[10px] text-[#888] block mt-0.5">
                            يقوم بإنشاء سطر مستقل لكل اسم مع تسلسل خاص بالاسم وتسلسل منفصل للكتاب.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 p-2.5 bg-[#141414] border border-[#1f1f1f] rounded-sm cursor-pointer hover:border-[#333] transition-colors">
                        <input
                          type="radio"
                          name="excelSplit"
                          checked={excelExportSplitNames === false}
                          onChange={() => setExcelExportSplitNames(false)}
                          className="mt-0.5 accent-emerald-500"
                        />
                        <div>
                          <span className="text-xs text-white font-bold block">تصدر سطر واحد لكل كتاب</span>
                          <span className="text-[10px] text-[#888] block mt-0.5">
                            يتم إدراج كافة أسماء المنتسبين مدمجة داخل حقل واحد في سطر الكتاب.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-[#1a1a1a]">
                  <button
                    onClick={() => setShowExcelExportModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleExportToExcel}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-sm cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير الآن</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Print Confirmation Modal */}
        <AnimatePresence>
          {showPrintConfirmModal && printTargetDoc && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-sm w-full max-w-sm shadow-2xl p-6"
                dir="rtl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-[#d4af37]/10 rounded-sm">
                    <Printer className="w-5 h-5 text-[#d4af37]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-cairo">خيارات طباعة الوثيقة</h3>
                    <p className="text-xs text-[#888] mt-0.5">تحديد إعدادات رمز التحقق والباركود للطباعة</p>
                  </div>
                </div>

                <p className="text-xs text-white leading-relaxed my-5 p-3 bg-black/40 border border-[#1a1a1a] rounded-sm">
                  هل ترغب في طباعة صورة الوثيقة مع إدراج باركود التحقق الرقمي المعتمد (QR Code) أم ترغب في طباعتها فارغة بدون باركود؟
                </p>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      handlePrint(printTargetDoc, true);
                      setShowPrintConfirmModal(false);
                      setPrintTargetDoc(null);
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#d4af37] hover:bg-[#b8962d] text-black font-bold text-xs rounded-sm cursor-pointer transition-colors shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة مع الباركود الرقمي (موصى به)</span>
                  </button>
                  <button
                    onClick={() => {
                      handlePrint(printTargetDoc, false);
                      setShowPrintConfirmModal(false);
                      setPrintTargetDoc(null);
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#252525] hover:bg-[#333] border border-[#3c3c3c] text-white font-bold text-xs rounded-sm cursor-pointer transition-colors"
                  >
                    <span>طباعة بدون باركود</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowPrintConfirmModal(false);
                      setPrintTargetDoc(null);
                    }}
                    className="w-full py-2 text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer mt-1"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PDF Single Export Confirmation Modal */}
        <AnimatePresence>
          {showPdfConfirmModal && pdfTargetDoc && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-sm w-full max-w-sm shadow-2xl p-6"
                dir="rtl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-500/10 rounded-sm">
                    <Download className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-cairo">تصدير وثيقة PDF</h3>
                    <p className="text-xs text-[#888] mt-0.5">تحديد إعدادات باركود التحقق لملف PDF</p>
                  </div>
                </div>

                <p className="text-xs text-white leading-relaxed my-5 p-3 bg-black/40 border border-[#1a1a1a] rounded-sm">
                  هل ترغب في تصدير ملف الـ PDF مدمجاً بباركود التحقق الرقمي المعتمد (QR Code) أم تصديره بدونه؟
                </p>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      handleExportToPDF(pdfTargetDoc, true);
                      setShowPdfConfirmModal(false);
                      setPdfTargetDoc(null);
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded-sm cursor-pointer transition-colors shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>تصدير مع الباركود الرقمي (موصى به)</span>
                  </button>
                  <button
                    onClick={() => {
                      handleExportToPDF(pdfTargetDoc, false);
                      setShowPdfConfirmModal(false);
                      setPdfTargetDoc(null);
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#252525] hover:bg-[#333] border border-[#3c3c3c] text-white font-bold text-xs rounded-sm cursor-pointer transition-colors"
                  >
                    <span>تصدير بدون باركود</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowPdfConfirmModal(false);
                      setPdfTargetDoc(null);
                    }}
                    className="w-full py-2 text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer mt-1"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PDF All Export Confirmation Modal */}
        <AnimatePresence>
          {showPdfAllConfirmModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-sm w-full max-w-md shadow-2xl p-6"
                dir="rtl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-500/10 rounded-sm">
                    <Download className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-cairo">تصدير كافة الكتب إلى PDF</h3>
                    <p className="text-xs text-[#888] mt-0.5">تحديد هيكلية التصدير الجماعي للوثائق</p>
                  </div>
                </div>

                <div className="space-y-4 my-5">
                  {/* Separate vs Single PDF file */}
                  <div>
                    <label className="text-xs text-[#aaa] font-bold block mb-1.5">طريقة حفظ الملفات المصدرة:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPdfAllOption('separate')}
                        className={`p-3 border text-xs font-bold rounded-sm cursor-pointer transition-all ${
                          pdfAllOption === 'separate'
                            ? 'bg-red-950/20 border-red-800 text-red-400 shadow-md'
                            : 'bg-[#141414] border-[#1f1f1f] text-[#888] hover:text-white'
                        }`}
                      >
                        نسخة مستقلة لكل كتاب
                        <span className="block text-[9px] text-[#666] font-normal mt-1">ملفات منفصلة متعددة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfAllOption('single')}
                        className={`p-3 border text-xs font-bold rounded-sm cursor-pointer transition-all ${
                          pdfAllOption === 'single'
                            ? 'bg-red-950/20 border-red-800 text-red-400 shadow-md'
                            : 'bg-[#141414] border-[#1f1f1f] text-[#888] hover:text-white'
                        }`}
                      >
                        نسخة واحدة مجمعة للكل
                        <span className="block text-[9px] text-[#666] font-normal mt-1">ملف مدمج متعدد الصفحات</span>
                      </button>
                    </div>
                  </div>

                  {/* Barcode inclusion */}
                  <div>
                    <label className="text-xs text-[#aaa] font-bold block mb-1.5">تضمين باركود التحقق الرقمي (QR Code):</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPdfAllIncludeBarcode(true)}
                        className={`p-2.5 border text-xs font-bold rounded-sm cursor-pointer transition-all ${
                          pdfAllIncludeBarcode === true
                            ? 'bg-[#1e1a10] border-[#5d461a] text-[#d4af37] shadow-md'
                            : 'bg-[#141414] border-[#1f1f1f] text-[#888] hover:text-white'
                        }`}
                      >
                        نعم، تضمين الباركود
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfAllIncludeBarcode(false)}
                        className={`p-2.5 border text-xs font-bold rounded-sm cursor-pointer transition-all ${
                          pdfAllIncludeBarcode === false
                            ? 'bg-[#1e1111] border-[#5d2020] text-red-400 shadow-md'
                            : 'bg-[#141414] border-[#1f1f1f] text-[#888] hover:text-white'
                        }`}
                      >
                        لا، بدون الباركود
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-[#1a1a1a]">
                  <button
                    onClick={() => setShowPdfAllConfirmModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={() => handleExportAllToPDFCombined(pdfAllOption, pdfAllIncludeBarcode)}
                    className="flex items-center gap-1.5 px-5 py-2 bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded-sm cursor-pointer transition-colors shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تأكيد وبدء التصدير</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Ollama AI & Offline Configuration Settings Modal */}
        <AnimatePresence>
          {showOllamaSettingsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0b0c0f] border border-[#d4af37]/40 rounded-md w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-auto max-h-[90vh]"
                dir="rtl"
              >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-800/80 bg-[#0d0f14]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#d4af37]/10 rounded-sm text-[#d4af37]">
                      <Sparkles className="w-5 h-5 text-[#d4af37]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-cairo">إعدادات الذكاء الاصطناعي والمعالجة المحلية (Ollama AI Setup)</h3>
                      <p className="text-[10px] text-gray-400 font-cairo mt-0.5">تهيئة المعالج الذكي دون اتصال ومزامنة النماذج المحلية</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowOllamaSettingsModal(false)}
                    className="p-1.5 text-gray-400 hover:text-white bg-[#141414] hover:bg-[#222] rounded-sm transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1 font-cairo text-right">
                  
                  {/* Alert Info */}
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded text-xs text-amber-200 leading-relaxed space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-400">
                      <Lightbulb className="w-4 h-4 shrink-0" />
                      <span>ما هو Ollama وما فائدة تشغيله على جهازك؟</span>
                    </div>
                    <p className="text-[11px] text-gray-300">
                      برنامج <strong>Ollama</strong> هو محرك يتيح لك تشغيل نماذج الذكاء الاصطناعي الكبيرة (مثل <strong>Qwen 2.5</strong> أو <strong>Llama 3</strong>) <strong>محلياً بنسبة 100%</strong> على حاسبتك الخاصة دون الحاجة لاتصال بالإنترنت.
                    </p>
                    <p className="text-[11px] text-gray-300">
                      <strong>فائدة تنزيله على Docker أو كبرنامج مستقل:</strong> يضمن السرية التامة للبيانات (لا يتم إرسال أي وثيقة أو كتاب إداري إلى خوادم خارجية)، مع إمكانية استخلاص وتدقيق وتصنيف الكتب الإدارية وتصحيح الحروف المتقطعة لغوياً بشكل فوري حتى لو انقطع الإنترنت بالكامل في الدائرة أو المؤسسة.
                    </p>
                  </div>

                  {/* Windows CMD / Docker Error Help Section */}
                  <div className="p-3 bg-[#111] border border-gray-800 rounded space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span>حل مشكلة خطأ &quot;Ollama is not recognized&quot; في موجه الأوامر:</span>
                    </div>
                    
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      هذا الخطأ يعني أن نظام الويندوز لا يعثر على أمر <code className="text-red-400 font-mono bg-black px-1 rounded">ollama</code> لأنك قمت بتنصيبه داخل حاوية Docker فقط، وبالتالي لا يمكن تشغيل الأمر مباشرة في سطر أوامر الويندوز الخارجي (الـ Host).
                    </p>

                    <div className="space-y-1.5 pt-1.5 text-[11px]">
                      <strong className="text-gray-300 block">خطوات سحب وتفعيل الموديل العربي الذكي بشكل صحيح:</strong>
                      <ol className="list-decimal list-inside space-y-1 text-gray-400 pl-2">
                        <li>
                          افتح الـ PowerShell واكتب الأمر التالي لسحب موديل متقدم يدعم الصور (Vision) لضمان دقة القراءة المباشرة دون الاعتماد على القارئ الضوئي الضعيف:
                          <div className="bg-black text-[#85e89d] p-2 rounded font-mono text-left direction-ltr text-[10px] my-1.5 overflow-x-auto select-all">
                            docker exec -it ollama ollama run minicpm-v
                          </div>
                          <div className="text-[11px] bg-red-950/40 text-red-300 border border-red-900/50 p-2 rounded block mt-2">
                            <strong>⚠️ تنبيه هام للحصول على نص عربي سليم 100% بدون تشوه:</strong><br/>
                            الموديلات النصية (مثل qwen2.5:7b) <b>لا يمكنها رؤية الصورة</b>، وتعتمد على قارئ ضوئي محلي (Tesseract) يسبب تشوهاً كبيراً وحروفاً متقطعة في اللغة العربية.<br/>
                            لحل هذه المشكلة <b>جذرياً وبشكل احترافي</b> في وضع (أوفلاين)، يجب عليك استخدام موديل يدعم الرؤية (Vision) مثل <code>minicpm-v</code> أو <code>llama3.2-vision</code> أو <code>llava</code>. هذه الموديلات تقرأ الصورة مباشرة وتسحب النص العربي بدقة مذهلة دون أي تشوه.
                          </div>
                        </li>
                        <li>
                          إذا لم تقم بتشغيل الحاوية بعد، يمكنك تشغيل Ollama على Docker بأمر واحد يفتح المنفذ الخارجي:
                          <div className="bg-black text-[#79b8ff] p-2 rounded font-mono text-left direction-ltr text-[10px] my-1.5 overflow-x-auto select-all">
                            docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
                          </div>
                        </li>
                        <li>
                          تأكد من كتابة اسم الموديل بالضبط <code className="text-[#d4af37] font-mono bg-black px-1 rounded">minicpm-v</code> في الإعدادات أدناه لتوجيه المحلل لاستخدامه.
                        </li>
                      </ol>
                    </div>

                    <div className="mt-3 p-2 bg-red-950/30 border border-red-900/50 rounded">
                      <strong className="text-red-400 block text-xs mb-1">حل مشكلة "network is unreachable" (لا يوجد اتصال إنترنت في دوكر):</strong>
                      <p className="text-[10px] text-gray-300 mb-2">
                        إذا ظهر لك خطأ يخبرك بأن الشبكة غير متصلة عند محاولة تحميل الموديل داخل دوكر، فهذا يعني أن حاوية دوكر ليس لديها صلاحية الوصول للإنترنت من حاسبتك.
                      </p>
                      <p className="text-[10px] text-gray-300">
                        <strong>الحل الأسهل والأسرع:</strong> لا تستخدم دوكر. قم بتحميل برنامج Ollama مباشرة للويندوز من موقعهم الرسمي <a href="https://ollama.com/download/windows" target="_blank" rel="noreferrer" className="text-blue-400 underline">ollama.com</a>. بعد تثبيته، افتح موجه الأوامر (CMD) العادي واكتب: <code className="text-[#85e89d] font-mono bg-black px-1 rounded">ollama run minicpm-v</code>
                      </p>
                    </div>
                  </div>

                  {/* Form Configuration Inputs */}
                  <div className="space-y-3.5 pt-2 border-t border-gray-800">
                    <div className="flex items-center justify-between p-2.5 bg-black/40 border border-gray-800 rounded">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">حالة تشغيل المساعد الذكي المحلي:</span>
                        <span className="text-[10px] text-gray-500 block">قم بتفعيل الخيار لتوجيه النظام لاستخدام ملقم Ollama عند سحب أو تصوير الوثائق</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useOllama}
                          onChange={(e) => setUseOllama(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-amber-500/20 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-black"></div>
                      </label>
                    </div>

                    {useOllama && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1.5">
                          <label className="text-xs text-gray-300 font-bold block">رابط ملقم Ollama (المنفذ الافتراضي هو 11434):</label>
                          <input
                            type="text"
                            value={ollamaUrl}
                            onChange={(e) => setOllamaUrl(e.target.value)}
                            placeholder="http://localhost:11434"
                            className="w-full bg-[#050608] border border-gray-800 text-xs text-white rounded px-3 py-2.5 focus:outline-none focus:border-amber-500 font-mono text-left direction-ltr"
                          />
                          <span className="text-[9px] text-gray-500 block">إذا كان دوكر يعمل على نفس الحاسبة، اتركه <code className="font-mono text-gray-400">http://localhost:11434</code></span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs text-gray-300 font-bold block">اسم الموديل المنصب في Ollama:</label>
                          <input
                            type="text"
                            value={ollamaModel}
                            onChange={(e) => setOllamaModel(e.target.value)}
                            placeholder="minicpm-v"
                            className="w-full bg-[#050608] border border-gray-800 text-xs text-white rounded px-3 py-2.5 focus:outline-none focus:border-amber-500 font-mono text-left direction-ltr"
                          />
                          <span className="text-[9px] text-gray-500 block">هام للغة العربية: يُفضل بشدة استخدام <code className="font-mono text-amber-400">minicpm-v</code> أو <code className="font-mono text-amber-400">qwen2-vl</code> لأن llama3 يخطئ كثيراً في العربية.</span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-[#08080c] border-t border-gray-800/80 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="text-[10px] text-gray-500 font-cairo">
                    * احفظ الإعدادات للبدء بتحليل الكتب الإدارية أوفلاين.
                  </div>
                  <div className="flex gap-2.5 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          showToast('info', 'جاري فحص الاتصال المباشر...', 'يتم الآن محاولة الاتصال بـ Ollama مباشرة من المتصفح...');
                          const testUrl = (ollamaUrl || 'http://localhost:11434').replace(/\/$/, "");
                          const controller = new AbortController();
                          const tId = setTimeout(() => controller.abort(), 4500); // 4.5s timeout
                          
                          let response;
                          let directSuccess = false;
                          try {
                            response = await fetch(`${testUrl}/api/tags`, { signal: controller.signal });
                            clearTimeout(tId);
                            if (response.ok) {
                              directSuccess = true;
                              const data = await response.json();
                              const modelsList = data.models ? data.models.map((m: any) => m.name).join(', ') : 'متصل';
                              showToast('success', 'تم الاتصال المباشر بنجاح! 🎉', `ملقم Ollama متصل ومفتوح لـ CORS وجاهز للعمل. الموديلات المتوفرة: ${modelsList}`);
                            }
                          } catch (directErr) {
                            clearTimeout(tId);
                            console.log("Direct client-side Ollama check failed. Trying server-side connection proxy...", directErr);
                          }

                          if (!directSuccess) {
                            showToast('info', 'جاري فحص الاتصال عبر الخادم...', 'تفحص الآن شبكة الكانتينر وخادم Ollama...');
                            const serverTestRes = await fetch('/api/ollama/test', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ ollamaUrl })
                            });

                            if (serverTestRes.ok) {
                              const serverData = await serverTestRes.json();
                              const modelsList = serverData.models && serverData.models.length > 0 
                                ? serverData.models.map((m: any) => m.name).join(', ') 
                                : 'لا توجد موديلات محملة بعد';
                              showToast('success', 'تم الاتصال عبر الخادم بنجاح! 🐳', `تمكن الخادم من الاتصال بـ Ollama داخل شبكة Docker بنجاح. الموديلات المتوفرة: ${modelsList}`);
                            } else {
                              const errData = await serverTestRes.json().catch(() => ({}));
                              throw new Error(errData.error || `استجاب الخادم برمز خطأ: ${serverTestRes.status}`);
                            }
                          }
                        } catch (e: any) {
                          showToast('error', 'تعذر الوصول لـ Ollama بالكامل', `تأكد من تشغيل حاوية Ollama (Docker) وتنزيل الموديل المطلوب. الخطأ: ${e.message || e}`);
                        }
                      }}
                      className="px-4 py-2 bg-amber-950/20 hover:bg-amber-900/30 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-sm transition-all cursor-pointer font-cairo"
                    >
                      فحص الاتصال بالملقم ⚡
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOllamaSettingsModal(false);
                        showToast('success', 'تم حفظ الإعدادات', 'تم اعتماد إعدادات ملقم Ollama والموديل الخاص بك بنجاح.');
                      }}
                      className="px-6 py-2 bg-[#d4af37] hover:bg-[#b8962d] text-black text-xs font-bold rounded-sm transition-all cursor-pointer font-cairo"
                    >
                      حفظ واعتماد
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reports Modal */}
        <AnimatePresence>
          {showReports && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-sm w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
              >
                <div className="flex justify-between items-center p-5 border-b border-[#1a1a1a] bg-[#0a0a0a]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#d4af37]/10 rounded-sm">
                      <FileText className="w-5 h-5 text-[#d4af37]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-cairo font-bold text-white">التقارير المفصلة والإحصائيات</h2>
                      <p className="text-[#888] text-xs mt-0.5">ملخص شامل لأداء المنظومة والوثائق المؤرشفة</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowReports(false)}
                    className="p-2 text-[#888] hover:text-white bg-[#1a1a1a] hover:bg-[#222] rounded-sm transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                  {/* General Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#141414] border border-[#1c1c1c] p-4 rounded-sm flex flex-col items-center justify-center text-center shadow-inner">
                      <div className="text-3xl font-bold text-[#d4af37] mb-1">{documents.length}</div>
                      <div className="text-xs text-[#888] font-bold">إجمالي الوثائق</div>
                    </div>
                    <div className="bg-[#141414] border border-[#1c1c1c] p-4 rounded-sm flex flex-col items-center justify-center text-center shadow-inner">
                      <div className="text-3xl font-bold text-emerald-500 mb-1">{documents.filter(d => d.status === 'success').length}</div>
                      <div className="text-xs text-[#888] font-bold">مستخلص بنجاح</div>
                    </div>
                    <div className="bg-[#141414] border border-[#1c1c1c] p-4 rounded-sm flex flex-col items-center justify-center text-center shadow-inner">
                      <div className="text-3xl font-bold text-amber-500 mb-1">{documents.filter(d => d.status === 'processing').length}</div>
                      <div className="text-xs text-[#888] font-bold">قيد المعالجة</div>
                    </div>
                    <div className="bg-[#141414] border border-[#1c1c1c] p-4 rounded-sm flex flex-col items-center justify-center text-center shadow-inner">
                      <div className="text-3xl font-bold text-red-500 mb-1">{documents.filter(d => d.status === 'error').length}</div>
                      <div className="text-xs text-[#888] font-bold">مرفوض/أخطاء</div>
                    </div>
                  </div>

                  {/* Document Types Breakdown */}
                  <div className="bg-[#141414] border border-[#1c1c1c] rounded-sm p-5 shadow-inner">
                    <h3 className="text-sm font-bold text-white mb-4 border-b border-[#222] pb-2">تصنيف الوثائق حسب النوع</h3>
                    <div className="space-y-3">
                      {Array.from(new Set(documents.filter(d => d.status === 'success' && d.documentType).map(d => d.documentType))).map(type => {
                        const count = documents.filter(d => d.documentType === type).length;
                        const percentage = documents.length > 0 ? Math.round((count / documents.length) * 100) : 0;
                        return (
                          <div key={type as string} className="flex items-center gap-3">
                            <div className="w-24 text-xs font-bold text-[#aaa] truncate">{type as string}</div>
                            <div className="flex-1 bg-[#0a0a0a] rounded-sm h-3 border border-[#222] overflow-hidden">
                              <div className="bg-[#d4af37] h-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                            <div className="w-12 text-left text-xs font-bold text-[#e5e5e5]">{count}</div>
                          </div>
                        );
                      })}
                      {documents.filter(d => d.status === 'success').length === 0 && (
                        <div className="text-xs text-[#666] text-center py-4">لا تتوفر بيانات لعرض التصنيفات</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Latest Activity */}
                  <div className="bg-[#141414] border border-[#1c1c1c] rounded-sm p-5 shadow-inner">
                    <h3 className="text-sm font-bold text-white mb-4 border-b border-[#222] pb-2">سجل النشاطات الحديثة</h3>
                    <div className="space-y-2">
                      {documents.slice(0, 5).map(doc => (
                        <div key={doc.id} className="flex items-center justify-between bg-[#0a0a0a] p-3 rounded-sm border border-[#222]">
                          <div className="flex items-center gap-3">
                            <FileCheck2 className={`w-4 h-4 ${doc.status === 'success' ? 'text-emerald-500' : doc.status === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
                            <div className="text-xs font-bold text-[#ccc]">{doc.fileName}</div>
                          </div>
                          <div className="text-[10px] text-[#888]">{doc.documentDate || 'تاريخ غير متوفر'}</div>
                        </div>
                      ))}
                      {documents.length === 0 && (
                        <div className="text-xs text-[#666] text-center py-4">لا توجد نشاطات مسجلة بعد</div>
                      )}
                    </div>
                  </div>

                </div>
                
                <div className="p-4 border-t border-[#1a1a1a] bg-[#0a0a0a] flex justify-end">
                  <button
                    onClick={() => setShowReports(false)}
                    className="px-6 py-2 bg-[#d4af37] hover:bg-[#b8962d] text-black text-xs font-bold rounded-sm transition-colors cursor-pointer"
                  >
                    إغلاق التقارير
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Direct Camera Capture Modal Overlay */}
          {isCameraOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-2xl bg-[#0a0a0a] border border-[#d4af37]/40 rounded-md overflow-hidden shadow-2xl flex flex-col"
              >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-[#1c1c1c] bg-[#0d0d0d]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-[#d4af37]/10 rounded-sm text-[#d4af37]">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-cairo">التقاط وثيقة بالكاميرا المباشرة</h3>
                      <p className="text-[10px] text-[#666] font-cairo mt-0.5">صوّر الخطاب أو الأمر الإداري بوضوح للحصول على أفضل دقة قراءة</p>
                    </div>
                  </div>
                  <button
                    onClick={stopCamera}
                    className="p-1.5 text-[#888] hover:text-white bg-[#1a1a1a] hover:bg-[#222] rounded-sm transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Viewfinder / Canvas Area */}
                <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden border-b border-[#1c1c1c]">
                  {isCameraLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-3">
                      <Loader2 className="w-10 h-10 animate-spin text-[#d4af37]" />
                      <span className="text-xs font-medium text-[#aaa] font-cairo">جاري تهيئة وتوصيل كاميرا الجهاز...</span>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 p-6 text-center gap-4">
                      <div className="p-3 bg-red-950/40 rounded-full border border-red-500/20 text-red-500">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <div className="space-y-1 max-w-sm">
                        <h4 className="text-sm font-bold text-red-200 font-cairo">فشل الوصول إلى الكاميرا</h4>
                        <p className="text-xs text-red-400 font-cairo leading-relaxed">{cameraError}</p>
                      </div>
                      <button
                        onClick={() => startCamera(selectedVideoDeviceId)}
                        className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-200 border border-red-500/30 rounded-sm text-xs font-bold transition-all cursor-pointer font-cairo"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  )}

                  {/* The Live Video Feed */}
                  {!capturedPhotoUrl ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    // The Frozen Captured Photo
                    <img
                      src={capturedPhotoUrl}
                      alt="Captured Document preview"
                      className="w-full h-full object-contain"
                    />
                  )}

                  {/* Target Frame Overlay to help guide the user to frame the paper */}
                  {!capturedPhotoUrl && !cameraError && !isCameraLoading && (
                    <div className="absolute inset-4 sm:inset-8 border-2 border-dashed border-[#d4af37]/30 rounded pointer-events-none flex items-center justify-center">
                      <div className="text-[10px] text-[#d4af37]/60 font-mono tracking-widest bg-black/60 px-2.5 py-1 rounded">
                        وجّه حدود الوثيقة الورقية داخل المربع
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-[#080808] flex flex-col sm:flex-row justify-between items-center gap-4">
                  {/* Camera Selector (only show if multiple inputs exist) */}
                  <div className="w-full sm:w-auto">
                    {videoDevices.length > 1 && !capturedPhotoUrl && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#888] font-bold shrink-0 font-cairo">اختر الكاميرا:</span>
                        <select
                          value={selectedVideoDeviceId}
                          onChange={(e) => startCamera(e.target.value)}
                          className="bg-black/60 border border-[#222] text-xs text-white rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-[#d4af37] cursor-pointer"
                        >
                          {videoDevices.map((device, idx) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `كاميرا رقم ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Actions Shutter */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {!capturedPhotoUrl ? (
                      <>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-5 py-2 bg-transparent hover:bg-[#111] text-[#888] hover:text-white border border-[#222] rounded-sm text-xs font-bold transition-all cursor-pointer font-cairo"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={capturePhoto}
                          disabled={isCameraLoading || !!cameraError}
                          className="flex items-center justify-center gap-2 bg-[#d4af37] hover:bg-[#b8962d] text-black px-6 py-2.5 rounded-sm text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed font-cairo"
                        >
                          <Camera className="w-4 h-4" />
                          <span>التقاط لقطة</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setCapturedPhotoUrl(null)}
                          className="px-5 py-2 bg-[#1a1a1a] hover:bg-[#222] text-[#ccc] border border-[#222] rounded-sm text-xs font-bold transition-all cursor-pointer font-cairo"
                        >
                          إعادة التقاط
                        </button>
                        <button
                          type="button"
                          onClick={confirmCapturedPhoto}
                          className="flex items-center justify-center gap-2 bg-[#d4af37] hover:bg-[#b8962d] text-black px-6 py-2.5 rounded-sm text-xs font-bold shadow-md cursor-pointer transition-all font-cairo"
                        >
                          <Check className="w-4 h-4" />
                          <span>اعتماد واستخلاص البيانات</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Integrated Hardware Document Scanner Modal (TWAIN/WIA Interface) */}
          {isScannerOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6"
            >
              <style>{`
                @keyframes scanline {
                  0% { top: 4%; opacity: 0.8; }
                  50% { top: 96%; opacity: 1; }
                  100% { top: 4%; opacity: 0.8; }
                }
                .animate-scan-line {
                  animation: scanline 2.0s infinite linear;
                }
                .terminal-scrollbar::-webkit-scrollbar {
                  width: 5px;
                }
                .terminal-scrollbar::-webkit-scrollbar-track {
                  background: rgba(0,0,0,0.2);
                }
                .terminal-scrollbar::-webkit-scrollbar-thumb {
                  background: rgba(255,255,255,0.15);
                  border-radius: 2px;
                }
              `}</style>

              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-6xl bg-[#08090c] border border-cyan-500/30 rounded-lg overflow-hidden shadow-2xl flex flex-col h-[90vh] md:h-[85vh]"
              >
                {/* Modal Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-800/80 bg-[#0d0f14]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-950/40 rounded-md text-cyan-400 border border-cyan-500/20 shadow-inner">
                      <Printer className="w-5 h-5 animate-pulse text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-cairo">منصة السحب والمسح الضوئي الذكية (Scanner Gateway)</h3>
                      <p className="text-[10px] text-gray-500 font-cairo mt-0.5">منظومة ربط برمجية للتحكم بالماسحات الضوئية المحلیة المتصلة والملقم الآلي (ADF / TWAIN)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (scannerStatus === 'scanning_adf' || scannerStatus === 'scanning_flatbed') {
                        if (!confirm('عملية المسح الضوئي نشطة حالياً. هل أنت متأكد من إلغاء العملية والخروج؟')) return;
                      }
                      setIsScannerOpen(false);
                      setScannerStatus('idle');
                    }}
                    className="p-1.5 text-gray-400 hover:text-white bg-gray-900/60 hover:bg-gray-800 rounded-sm transition-colors cursor-pointer border border-gray-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Split Interface */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
                  
                  {/* Right Panel: Settings Sidebar */}
                  <div className="lg:col-span-4 border-l border-gray-900 bg-[#0a0c0f] p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                    <div className="space-y-4 font-cairo">
                      
                      {/* Section 1: Device Detection */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-400">الماسح المتصل بالحاسبة</label>
                          <button
                            onClick={detectLocalScanners}
                            disabled={isCheckingScanners}
                            className="p-1 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 rounded border border-cyan-950 transition-all flex items-center gap-1 px-1.5 cursor-pointer disabled:opacity-50"
                            title="إعادة فحص المنافذ"
                          >
                            <RefreshCw className={`w-3 h-3 ${isCheckingScanners ? 'animate-spin' : ''}`} />
                            <span>تحديث الحالة</span>
                          </button>
                        </div>
                        
                        <select
                          value={selectedScanner}
                          onChange={(e) => setSelectedScanner(e.target.value)}
                          disabled={scannerStatus !== 'idle'}
                          className="w-full bg-[#050608] border border-cyan-500/30 text-xs text-white rounded px-2.5 py-2 focus:outline-none focus:border-cyan-500 cursor-pointer font-bold"
                        >
                          {detectedScanners.map((scanner, index) => (
                            <option key={index} value={scanner}>
                              {scanner}
                            </option>
                          ))}
                        </select>

                        {/* Native Dynamsoft Select Source Button */}
                        {true && (
                          <button
                            type="button"
                            onClick={openSDKSelectSourceDialog}
                            disabled={scannerStatus !== 'idle'}
                            className="w-full mt-1.5 bg-amber-950/25 hover:bg-amber-900/30 text-amber-400 border border-amber-500/20 rounded py-1.5 px-2 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <span>فتح نافذة اختيار السكنر الافتراضية لـ Dynamsoft</span>
                            <span>🎛️</span>
                          </button>
                        )}
                        
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 bg-black/40 p-1.5 rounded border border-gray-900">
                          <div className={`w-1.5 h-1.5 rounded-full ${selectedScanner.includes('DR-C230') ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]' : 'bg-amber-500'}`}></div>
                          <span className="text-gray-400">
                            {selectedScanner.includes('DR-C230') 
                              ? 'Canon imageFORMULA DR-C230: جاهز للسحب' 
                              : 'بانتظار ربط تعريف TWAIN المباشر...'}
                          </span>
                        </div>
                      </div>

                      {/* Driver Setup Tip */}
                      {!isCheckingScanners && scannerStatus === 'idle' && (
                        <div className="p-2.5 bg-cyan-950/10 border border-cyan-500/10 rounded text-[9px] text-gray-400 leading-relaxed font-cairo space-y-2">
                          <div>
                            <strong className="text-cyan-400 block mb-0.5">تنبيه الربط الحقيقي:</strong>
                            للسحب المباشر من جهاز <strong>DR-C230</strong>، تأكد من تشغيل تطبيق 
                            <span className="text-white mx-0.5 underline">Scanner Bridge</span> 
                            على حاسبتك لفتح قناة TWAIN للمتصفح.
                          </div>
                          
                          {/* Custom Bridge URL Input */}
                          <div className="pt-2 border-t border-cyan-500/10 space-y-1.5">
                            <label className="text-[9px] text-gray-400 block">عنوان IP أو رابط الجسر المحلي:</label>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={customBridgeUrl}
                                onChange={(e) => {
                                  setCustomBridgeUrl(e.target.value);
                                  setDismissConnectionGuide(false); // Reset dismiss on input change
                                }}
                                placeholder="مثال: https://127.0.0.1:18626"
                                className="flex-1 bg-[#050608] border border-gray-800 text-[10px] text-white rounded px-2 py-1 focus:outline-none focus:border-cyan-500 font-mono text-left direction-ltr"
                              />
                              <button
                                onClick={() => {
                                  setDismissConnectionGuide(false);
                                  detectLocalScanners();
                                }}
                                className="px-2 bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 rounded text-[9px] hover:bg-cyan-900/30 cursor-pointer font-bold"
                              >
                                ربط
                              </button>
                            </div>
                          </div>
                          
                          {dismissConnectionGuide && (
                            <button
                              onClick={() => setDismissConnectionGuide(false)}
                              className="text-[9px] text-amber-400 hover:underline block text-right mt-1 cursor-pointer w-full text-right"
                            >
                              عرض إرشادات ومتطلبات الربط الحقيقي 🛈
                            </button>
                          )}
                        </div>
                      )}

                      {/* Section: Offline & Local AI (Ollama) Settings */}
                      <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                            تهيئة المعالجة دون اتصال (أوفلاين):
                          </span>
 
 
 
 
 
 
 
 
 
 
                        </div>
 
                        <p className="text-[9px] text-gray-500 leading-relaxed font-sans">
                          عند تفعيل وضع الأوفلاين، سيتم تعطيل الاتصال السحابي بقواعد بيانات فيربيس (لتجنب التوقف)، وسيتم حفظ البيانات محلياً في المتصفح مع تفعيل محرك القواعد والاستخلاص المحلي، أو الاتصال بنموذج Ollama الذكي على ملقم محلي.
                        </p>

                        <div className="space-y-1.5 pt-1 border-t border-amber-500/10">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] text-gray-400 flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={useOllama}
                                onChange={(e) => setUseOllama(e.target.checked)}
                                className="rounded border-gray-800 text-amber-500 focus:ring-amber-500/20 bg-black cursor-pointer"
                              />
                              تفعيل Ollama للتحليل والفرز الذكي
                            </label>
                          </div>

                          {useOllama && (
                            <div className="space-y-2 pt-1.5 transition-all">
                              <div>
                                <span className="text-[8px] text-gray-500 block mb-0.5">رابط ملقم Ollama المحلي:</span>
                                <input
                                  type="text"
                                  value={ollamaUrl}
                                  onChange={(e) => setOllamaUrl(e.target.value)}
                                  placeholder="http://localhost:11434"
                                  className="w-full bg-[#050608] border border-gray-800 text-[9px] text-white rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 font-mono text-left direction-ltr"
                                />
                              </div>
                              <div>
                                <span className="text-[8px] text-gray-500 block mb-0.5">اسم النموذج المستخدم في Ollama:</span>
                                <input
                                  type="text"
                                  value={ollamaModel}
                                  onChange={(e) => setOllamaModel(e.target.value)}
                                  placeholder="qwen2.5:7b"
                                  className="w-full bg-[#050608] border border-gray-800 text-[9px] text-white rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 font-mono text-left direction-ltr"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="h-px bg-gray-900 my-2"></div>

                      {/* Section 2: Scanning Parameters */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-gray-400">خصائص المسح الضوئي</h4>
                        
                        {/* Paper Source */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-gray-500">مصدر التغذية والورق</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setScanSource('adf')}
                              disabled={scannerStatus !== 'idle'}
                              className={`p-2 rounded text-xs font-bold border transition-all cursor-pointer ${
                                scanSource === 'adf'
                                  ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-500/5'
                                  : 'bg-black/40 border-gray-800/80 text-gray-500 hover:text-gray-400'
                              }`}
                            >
                              ملقم تلقائي (ADF)
                            </button>
                            <button
                              type="button"
                              onClick={() => setScanSource('flatbed')}
                              disabled={scannerStatus !== 'idle'}
                              className={`p-2 rounded text-xs font-bold border transition-all cursor-pointer ${
                                scanSource === 'flatbed'
                                  ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-500/5'
                                  : 'bg-black/40 border-gray-800/80 text-gray-500 hover:text-gray-400'
                              }`}
                            >
                              مسطح (Flatbed)
                            </button>
                          </div>
                        </div>

                        {/* DPI resolution */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-gray-500">الدقة والجودة (DPI)</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[150, 200, 300, 600].map((dpi) => (
                              <button
                                key={dpi}
                                type="button"
                                onClick={() => setScanDpi(dpi)}
                                disabled={scannerStatus !== 'idle'}
                                className={`py-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                  scanDpi === dpi
                                    ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-400'
                                    : 'bg-black/40 border-gray-800/60 text-gray-500 hover:text-gray-400'
                                }`}
                              >
                                {dpi}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Color Mode */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-gray-500">نمط الألوان</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { key: 'color', label: 'ملون (Color)' },
                              { key: 'gray', label: 'تدرج رمادي' },
                              { key: 'bw', label: 'أسود / أبيض' }
                            ].map((mode) => (
                              <button
                                key={mode.key}
                                type="button"
                                onClick={() => setScanColorMode(mode.key as any)}
                                disabled={scannerStatus !== 'idle'}
                                className={`py-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                  scanColorMode === mode.key
                                    ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-400'
                                    : 'bg-black/40 border-gray-800/60 text-gray-500 hover:text-gray-400'
                                }`}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Action buttons at bottom */}
                    <div className="pt-4 border-t border-gray-900 mt-6 font-cairo">
                      {scannerStatus === 'idle' ? (
                        <button
                          type="button"
                          onClick={startScannerAction}
                          className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-3 rounded text-xs font-black shadow-md shadow-cyan-500/10 transition-all cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                          <span>بدء السحب الضوئي (Start Scan)</span>
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">تقدم عملية السحب:</span>
                            <span className="font-bold text-cyan-400">{scanProgress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-950 rounded-full overflow-hidden border border-gray-900">
                            <div 
                              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300 rounded-full"
                              style={{ width: `${scanProgress}%` }}
                            ></div>
                          </div>
                          <p className="text-[9px] text-gray-500 text-center mt-1">
                            {scannerStatus === 'connecting' && 'جاري التحقق من التغذية والاتصال ميكانيكياً...'}
                            {scannerStatus === 'connected' && 'تجهيز صينية التلقيم الميكانيكية...'}
                            {scannerStatus === 'scanning_adf' && 'جاري قراءة الورق وتغذية الفيدر...'}
                            {scannerStatus === 'success' && 'اكتمل السحب بنجاح وتحويل الملفات!'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Left Panel: Simulation Viewport & Logs */}
                  <div className="lg:col-span-8 bg-[#040507] p-6 flex flex-col justify-between h-full overflow-hidden">
                    
                    {/* Visual Feeder / Flatbed viewport */}
                    <div className="flex-1 flex flex-col items-center justify-center border border-gray-900 bg-[#06070a]/40 rounded-lg p-6 relative overflow-hidden">
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-black/40 border border-gray-900 rounded text-[10px] text-gray-400 font-mono">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
                        <span>HARDWARE MONITOR</span>
                      </div>

                      {/* Connection Guide Overlay (Shown when real scanner is selected but bridge not active) */}
                      {scannerStatus === 'idle' && selectedScanner.includes('DR-C230') && !scannerBaseUrl && !dismissConnectionGuide && (
                        <div className="absolute inset-0 bg-[#040507]/95 z-30 flex items-center justify-center p-8 overflow-y-auto custom-scrollbar">
                          <div className="max-w-md w-full bg-[#0d0f14] border border-cyan-500/20 rounded-lg p-6 text-right font-cairo shadow-2xl my-auto">
                            <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-3">
                              <div className="p-2 bg-amber-500/10 rounded text-amber-500">
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              <h4 className="text-sm font-bold text-white">متطلبات الربط الحقيقي (Canon DR-C230)</h4>
                            </div>
                            <div className="space-y-4">
                              <p className="text-[11px] text-gray-400 leading-relaxed">
                                المتصفحات لا تملك صلاحية الوصول المباشر للأسلاك والقطع المادية للحاسبة. لتفعيل السحب الحقيقي من جهازك، اتبع الخطوات التالية:
                              </p>
                              <ul className="space-y-3 text-[11px] text-gray-400">
                                <li className="flex gap-2 items-start">
                                  <span className="text-cyan-400 font-bold">1.</span>
                                  <span>نصب تعريف **Canon TWAIN Driver** الأصلي على ويندوز.</span>
                                </li>
                                <li className="flex gap-2 items-start">
                                  <span className="text-cyan-400 font-bold">2.</span>
                                  <span>حمل وثبت برنامج "تجسير" مثل **Dynamsoft Service** أو **Scanner.js Bridge**.</span>
                                </li>
                                <li className="flex gap-2 items-start">
                                  <span className="text-cyan-400 font-bold">3.</span>
                                  <span>تأكد من ظهور أيقونة البرنامج بجانب الساعة في شريط المهام.</span>
                                </li>
                                <li className="flex gap-2 items-start text-amber-400">
                                  <span className="font-bold">4.</span>
                                  <span>بما أن الموقع يعمل عبر بروتوكول آمن (HTTPS)، يرجى الضغط على أحد الروابط التالية لفتح صفحة الأمان لبرنامج Dynamsoft وقبولها لتمكين الاتصال المحلي (اضغط على الرابط، ثم Advanced ثم Proceed لمرة واحدة): <a href="https://127.0.0.1:18626" target="_blank" rel="noopener noreferrer" className="underline font-mono text-cyan-400 hover:text-cyan-300">منفذ 18626 (الافتراضي)</a> أو <a href="https://127.0.0.1:18623" target="_blank" rel="noopener noreferrer" className="underline font-mono text-cyan-400 hover:text-cyan-300">منفذ 18623 (جهازك الحالي)</a>.</span>
                                </li>
                              </ul>

                              {/* Manual Custom IP/URL Input in Overlay */}
                              <div className="p-3 bg-black/40 border border-gray-800 rounded space-y-2 mt-2">
                                <label className="text-[10px] font-bold text-gray-400 block">هل تستخدم منفذًا أو جهازًا آخر بالشبكة؟</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={customBridgeUrl}
                                    onChange={(e) => setCustomBridgeUrl(e.target.value)}
                                    placeholder="مثال: https://192.168.1.15:18626"
                                    className="flex-1 bg-[#050608] border border-gray-700 text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-mono text-left direction-ltr"
                                  />
                                </div>
                                <span className="text-[9px] text-gray-500 block">سنقوم بالبحث في هذا العنوان تلقائيًا عند إعادة فحص الاتصال.</span>
                              </div>

                              <div className="flex flex-col gap-2 pt-2">
                                <button 
                                  onClick={detectLocalScanners}
                                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 rounded text-xs font-bold transition-all cursor-pointer shadow-lg shadow-cyan-950/20"
                                >
                                  إعادة فحص الاتصال بالهاردوير
                                </button>
                                <button 
                                  onClick={() => setDismissConnectionGuide(true)}
                                  className="w-full bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-400 py-2.5 rounded text-xs font-bold transition-all cursor-pointer border border-cyan-500/20"
                                >
                                  إغلاق التنبيه ومتابعة العمل على أي حال
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Display States */}
                      {scannerStatus === 'idle' && (
                        <div className="text-center space-y-4 flex flex-col items-center max-w-sm">
                          <div className="p-5 bg-cyan-950/10 border border-cyan-500/10 rounded-full text-cyan-500/40">
                            <Printer className="w-16 h-16" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-300 font-cairo">الماسح الضوئي الذكي في وضع الاستعداد</h4>
                            <p className="text-xs text-gray-500 font-cairo leading-relaxed mt-1.5">
                              الرجاء إدخال الأوراق في ملقم السكنر الحقيقي (Feeder ADF) أو وضع الورقة على زجاج الماسح المكتبي، ثم انقر على "بدء السحب الضوئي" للبدء.
                            </p>
                          </div>
                        </div>
                      )}

                      {scannerStatus === 'connecting' && (
                        <div className="text-center space-y-4 flex flex-col items-center">
                          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-cyan-400 font-cairo">جاري تهيئة الماسح الضوئي</h4>
                            <p className="text-[10px] text-gray-500 font-cairo">Establishing handshake with physical WIA/TWAIN hardware</p>
                          </div>
                        </div>
                      )}

                      {scannerStatus === 'connected' && (
                        <div className="text-center space-y-4 flex flex-col items-center">
                          <div className="p-4 bg-green-950/20 border border-green-500/30 rounded-full text-green-400 animate-pulse">
                            <ShieldCheck className="w-12 h-12 text-green-400" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-green-400 font-cairo">تم تأسيس الاتصال والمطابقة</h4>
                            <p className="text-[10px] text-gray-500 font-cairo">Hardware interface matching successful</p>
                          </div>
                        </div>
                      )}

                      {(scannerStatus === 'scanning_adf' || scannerStatus === 'scanning_flatbed') && (
                        <div className="flex flex-col items-center justify-center space-y-6 w-full">
                          
                          {/* Animated Feeder Roller Stage */}
                          <div className="relative aspect-[3/4] w-full max-w-[210px] bg-neutral-900 border border-neutral-800 rounded shadow-2xl overflow-hidden flex flex-col items-center justify-center">
                            
                            {/* Roller Mechanical Head */}
                            <div className="absolute top-0 inset-x-0 h-5 bg-[#000] border-b border-neutral-800 flex items-center justify-center z-20 shadow-md">
                              <div className="w-20 h-1.5 bg-cyan-500/40 rounded-full animate-pulse"></div>
                            </div>
                            
                            {/* Paper Sliding Container */}
                            <div className="w-11/12 h-[88%] bg-[#faf8f2] shadow-2xl border border-neutral-200/40 p-4 relative overflow-hidden transform translate-y-1">
                              {/* Glowing Laser Scan Bar */}
                              <div className="absolute left-0 right-0 h-1.5 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.9)] animate-scan-line z-10"></div>

                              {/* Sample content placeholder */}
                              <div className="space-y-3 opacity-60">
                                <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
                                  <div className="w-3 h-3 bg-neutral-400 rounded-full"></div>
                                  <div className="h-2 w-16 bg-neutral-300 rounded"></div>
                                </div>
                                <div className="space-y-1.5 pt-4">
                                  <div className="h-1.5 w-full bg-neutral-300 rounded"></div>
                                  <div className="h-1.5 w-11/12 bg-neutral-300 rounded"></div>
                                  <div className="h-1.5 w-full bg-neutral-300 rounded"></div>
                                  <div className="h-1.5 w-2/3 bg-neutral-300 rounded"></div>
                                </div>
                                <div className="pt-8 flex justify-center">
                                  <div className="w-10 h-10 border-2 border-neutral-300 rounded-full flex items-center justify-center text-neutral-300">
                                    ★
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Roller Mechanical Foot */}
                            <div className="absolute bottom-0 inset-x-0 h-4 bg-[#000] border-t border-neutral-800 z-20"></div>
                          </div>

                          <div className="text-center space-y-1.5">
                            <h4 className="text-xs font-bold text-cyan-400 font-cairo flex items-center justify-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                              <span>جاري تغذية الأوراق والمسح الضوئي النشط بدقة {scanDpi} DPI...</span>
                            </h4>
                            <p className="text-[10px] text-gray-500 font-cairo">يرجى الانتظار حتى انتهاء الفيدر الميكانيكي من قراءة المستندات بالكامل</p>
                          </div>
                        </div>
                      )}

                      {scannerStatus === 'success' && (
                        <div className="text-center space-y-4 flex flex-col items-center">
                          <div className="p-4 bg-cyan-950/30 border border-cyan-500/40 rounded-full text-cyan-400 animate-bounce">
                            <CheckCircle2 className="w-14 h-14" />
                          </div>
                          <div className="space-y-1.5 max-w-sm">
                            <h4 className="text-sm font-bold text-cyan-400 font-cairo">اكتمل سحب الأوراق ونقل الملفات!</h4>
                            <p className="text-xs text-gray-400 font-cairo leading-relaxed">
                              تم نقل الأوراق الممسوحة ضوئياً بنجاح إلى المنظومة الذكية، وبدأت عملية التجزئة واستخراج البيانات تلقائياً.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Monospace System Logs */}
                    <div className="mt-4 border border-gray-900 bg-black/60 rounded-lg p-3.5 h-36 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-gray-900 pb-2 mb-2">
                        <span className="text-[10px] font-mono font-bold text-gray-500 tracking-wider">TWAIN CONSOLE & GATEWAY LOGS</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-cyan-950/30 border border-cyan-500/20 text-cyan-400 rounded">CONNECTED</span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto terminal-scrollbar space-y-1 pr-1 text-right" dir="ltr">
                        {scannerLogs.map((log, index) => (
                          <div key={index} className="text-[9px] font-mono text-gray-400 whitespace-pre-wrap leading-relaxed tracking-normal select-all text-right">
                            <span className="text-cyan-500/80 mr-1">❯</span> {log}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                  
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Dynamsoft Service / SSL Certificate Helper Modal */}
          {isDwtErrorModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4"
              dir="rtl"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-xl bg-[#090b10] border border-cyan-500/40 rounded-lg shadow-2xl p-6 font-cairo text-right text-white relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-cyan-500 via-amber-500 to-red-500"></div>
                
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 shrink-0 mt-1 animate-pulse">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-amber-400">فشل الاتصال بالماسح الحقيقي (Dynamsoft Service)</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      المتصفح لم يتمكن من الوصول إلى برنامج الخدمة المحلية على جهاز الحاسوب الخاص بك. يرجى مراجعة الحلول المباشرة بالأسفل لتفعيل السحب الحقيقي فوراً:
                    </p>
                  </div>
                </div>

                <div className="space-y-4 border-y border-gray-800/80 py-4 my-4">
                  {/* Step 1: Accept SSL */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-cyan-400 block flex items-center gap-1.5">
                      <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-cyan-950 text-cyan-400 text-[10px] border border-cyan-500/20 font-mono">1</span>
                      الحل الفوري والأكثر شيوعاً: قبول شهادة الأمان (SSL)
                    </span>
                    <p className="text-[11px] text-gray-300 leading-relaxed pr-6">
                      بما أن المنظومة تعمل عبر رابط مشفر (HTTPS)، فإن المتصفح يمنع الاتصال بالماسح المحلي تلقائياً لحمايتك.
                      <strong className="text-amber-300 block mt-1 font-bold">اضغط على الرابط بالأسفل، وعند ظهور صفحة التحذير، اضغط على "خيارات متقدمة" (Advanced) ثم اختر "متابعة إلى 127.0.0.1 (غير آمن)" (Proceed) لمرة واحدة فقط لتخطي الحجب:</strong>
                    </p>
                    <div className="pr-6 pt-1 flex flex-wrap gap-2">
                      <a 
                        href="https://127.0.0.1:18626" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 px-3.5 py-1.5 rounded text-[11px] font-bold transition-all cursor-pointer font-mono"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>رابط الأمان (منفذ 18626)</span>
                      </a>
                      <a 
                        href="https://127.0.0.1:18623" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 px-3.5 py-1.5 rounded text-[11px] font-bold transition-all cursor-pointer font-mono"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>رابط الأمان (منفذ 18623 - جهازك الحالي)</span>
                      </a>
                    </div>
                  </div>

                  {/* Step 2: Download Service */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-xs font-bold text-cyan-400 block flex items-center gap-1.5">
                      <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-cyan-950 text-cyan-400 text-[10px] border border-cyan-500/20 font-mono">2</span>
                      تحميل وتثبيت الخدمة (إذا لم تكن مثبتة مسبقاً)
                    </span>
                    <p className="text-[11px] text-gray-300 leading-relaxed pr-6">
                      إذا لم تقم بتثبيت برنامج الربط "Dynamsoft Service" مسبقاً على هذا الحاسوب، يرجى تحميله وتثبيته فوراً لنظام التشغيل لديك:
                    </p>
                    <div className="pr-6 pt-1 flex flex-wrap gap-2">
                      <a 
                        href="https://cdn.jsdelivr.net/npm/dwt@18.5.0/dist/DynamsoftServiceSetup.msi" 
                        className="inline-flex items-center gap-1 bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white border border-gray-800 px-3 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>تحميل لنظام Windows (MSI)</span>
                      </a>
                      <a 
                        href="https://cdn.jsdelivr.net/npm/dwt@18.5.0/dist/DynamsoftServiceSetup.pkg" 
                        className="inline-flex items-center gap-1 bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white border border-gray-800 px-3 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>تحميل لنظام macOS</span>
                      </a>
                    </div>
                  </div>

                  {/* Tech details */}
                  {dwtErrorDetails && (
                    <div className="p-2.5 bg-black/40 border border-red-950/40 rounded text-[10px] font-mono text-red-400 leading-normal select-all">
                      <span className="font-bold block mb-0.5">تفاصيل الخطأ التقني (Technical Error):</span>
                      {dwtErrorDetails.message} (كود: {dwtErrorDetails.code}) | الإجراء: {dwtErrorDetails.action}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 justify-end items-center pt-2">
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDwtErrorModalOpen(false);
                        detectLocalScanners();
                      }}
                      className="flex-1 sm:flex-initial bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-xs font-bold transition-all cursor-pointer font-cairo"
                    >
                      إعادة فحص الاتصال
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDwtErrorModalOpen(false)}
                      className="bg-neutral-900 hover:bg-neutral-800 text-gray-400 hover:text-white border border-gray-800 px-4 py-2 rounded text-xs font-bold transition-all cursor-pointer font-cairo"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Toast Alerts for Duplications & Other Events */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-[#0a0a0a] border border-amber-500/30 text-white rounded-md p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex gap-3.5 items-start relative overflow-hidden group/toast"
              dir="rtl"
            >
              <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500"></div>
              <div className="p-2 rounded bg-amber-500/10 text-amber-500 shrink-0 mt-0.5 animate-pulse">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1.5">
                <h4 className="font-cairo font-black text-sm text-amber-400">{toast.title}</h4>
                <p className="font-cairo text-xs text-gray-300 leading-relaxed">{toast.message}</p>
                {toast.docId && (
                  <button
                    onClick={() => {
                      setSelectedDocId(toast.docId);
                      document.getElementById('header-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 hover:text-amber-400 font-cairo bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded transition-all cursor-pointer mt-1 border border-amber-500/20 shadow-sm"
                  >
                    <Eye className="w-3 h-3" />
                    <span>عرض ومقارنة المستند المكرر الموجود بالأرشيف</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-gray-500 hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
