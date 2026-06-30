import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, User, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface LoginProps {
  onLoginSuccess?: (localUser?: any, localProfile?: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. First, attempt secure local offline database authentication (Docker Server)
      try {
        const localResponse = await fetch('/api/local/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: email,
            password: password
          })
        });

        if (localResponse.ok) {
          const resData = await localResponse.json();
          if (resData.success) {
            // Save local user session details to localStorage for persistence
            if (rememberMe) {
              localStorage.setItem('archiver_local_user', JSON.stringify(resData.user));
              localStorage.setItem('archiver_local_profile', JSON.stringify(resData.profile));
              // Also toggle offline mode true automatically since we are self-hosting on Docker
              localStorage.setItem('archiver_is_offline', 'true');
            }
            if (onLoginSuccess) {
              onLoginSuccess(resData.user, resData.profile);
            }
            setLoading(false);
            return;
          }
        } else {
          const errData = await localResponse.json();
          if (errData && errData.error) {
            setError(errData.error);
            setLoading(false);
            return;
          }
        }
      } catch (localErr) {
        console.warn('Local offline authentication server unavailable, falling back to Firebase Auth:', localErr);
      }

      // 2. Fallback to Firebase authentication if local server is not accessible or not running
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const loginEmail = email.includes('@') ? email : `${email}@archive.system.local`;
      
      try {
        await signInWithEmailAndPassword(auth, loginEmail, password);
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } catch (authErr: any) {
        // Auto-create default admin in Firebase if it doesn't exist (Only if Firebase is online)
        if ((authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') && email === 'ahmed' && password === '1986@1986') {
          const userCred = await createUserWithEmailAndPassword(auth, loginEmail, password);
          await setDoc(doc(db, 'users', userCred.user.uid), {
            email: loginEmail,
            fullName: 'المدير العام',
            role: 'admin',
            createdAt: Date.now()
          });
          if (onLoginSuccess) {
            onLoginSuccess();
          }
        } else {
          throw authErr;
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('يجب تفعيل خيار تسجيل الدخول (Email/Password) من لوحة تحكم Firebase.');
      } else {
        setError('فشل تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة المرور.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e5e5] font-cairo flex items-center justify-center p-4" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
      >
        <div className="p-8 border-b border-[#1a1a1a] flex flex-col items-center justify-center bg-gradient-to-b from-[#111] to-[#0a0a0a]">
          <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mb-4 border border-cyan-500/20">
            <LogIn className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">نظام الأرشفة الذكي</h1>
          <p className="text-sm text-gray-500 mt-2 text-center">بوابة تسجيل الدخول الآمنة للشبكة المحلية والمخدم السحابي</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-start gap-3 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-300 block">اسم المستخدم (اليوزر) أو رقم الهاتف</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111] border border-[#222] text-white rounded-lg px-4 py-3 pr-10 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-colors text-center"
                placeholder="07703120523"
                dir="ltr"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-300 block">كلمة المرور</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111] border border-[#222] text-white rounded-lg px-4 py-3 pr-10 pl-10 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-colors text-center"
                placeholder="••••••••"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-gray-200 transition-colors">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-[#333] bg-[#111] text-cyan-500 focus:ring-cyan-500 focus:ring-offset-[#111]"
              />
              <span>تذكرني على هذا الجهاز</span>
            </label>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>تسجيل الدخول الآمن</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
