import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Shield, Plus, X, Search, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, AuditLog } from '../types';

export const AdminDashboard = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [statisticalNumber, setStatisticalNumber] = useState('');
  const [classification, setClassification] = useState('');
  const [rank, setRank] = useState('');
  const [grade, setGrade] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [motherName, setMotherName] = useState('');
  const [province, setProvince] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [role, setRole] = useState<'admin' | 'data_entry'>('data_entry');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersData);
      setLoading(false);
    }, (err) => {
      console.error(err);
      handleFirestoreError(err, OperationType.GET, 'users');
    });

    const unsubLogs = onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc')), (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
      setLogs(logsData);
    }, (err) => {
      console.error(err);
    });

    return () => {
      unsubUsers();
      unsubLogs();
    };
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const loginEmail = email.includes('@') ? email : `${email}@archive.system.local`;

      // Note: This creates a user in the current auth context and signs them in.
      // In a real production app, an admin should ideally use Firebase Admin SDK (server-side) to create users.
      // For this frontend-only app, we will use the client SDK. This means the admin might be signed out and signed in as the new user.
      // However, another approach is to have a secondary Firebase app instance just for creating users.
      // But for simplicity, we will assume we can just create them. If it logs the admin out, they will have to log back in.
      const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
      const newUserId = userCredential.user.uid;

      const newUser: Partial<UserProfile> = {
        email: loginEmail,
        fullName,
        statisticalNumber,
        classification,
        rank,
        grade,
        dobDay,
        dobMonth,
        dobYear,
        motherName,
        province,
        workspace,
        role,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', newUserId), newUser);
      
      setIsAddingUser(false);
      // Reset form
      setEmail(''); setPassword(''); setFullName(''); setStatisticalNumber('');
      setClassification(''); setRank(''); setGrade(''); setDobDay(''); setDobMonth(''); setDobYear('');
      setMotherName(''); setProvince(''); setWorkspace(''); setRole('data_entry');
      
      // Because we used createUserWithEmailAndPassword, the admin is now logged in as the new user!
      // This is a known limitation of the client SDK. The user will be redirected to the main app as the new user, or we can prompt them.
      // Let's just reload the page to force the new user state to take effect.
      window.location.reload();

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'فشل في إضافة المستخدم');
    } finally {
      setSubmitting(false);
    }
  };

  const getRankOptions = () => {
    switch(classification) {
      case 'ضابط':
        return ['عميد', 'عقيد', 'رائد', 'نقيب', 'ملازم اول', 'ملازم'];
      case 'موظف مدني':
        return ['موظف درجة اولى', 'موظف درجة ثانية', 'موظف درجة ثالثة', 'موظف درجة رابعة', 'موظف درجة خامسة', 'موظف درجة سادسة', 'موظف درجة سابعة', 'موظف درجة ثامنة'];
      case 'مراتب':
        return ['مفوض درجة اولى', 'مفوض درجة ثانية', 'مفوض درجة ثالثة', 'مفوض درجة رابعة', 'مفوض درجة خامسة', 'مفوض درجة سادسة', 'مفوض درجة سابعة', 'مفوض درجة ثامنة', 'رئيس عرفاء', 'عريف', 'نائب عريف', 'شرطي اول', 'شرطي'];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-cyan-500" />
          لوحة تحكم الإدارة
        </h2>
        <button
          onClick={() => setIsAddingUser(!isAddingUser)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm transition-colors"
        >
          {isAddingUser ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAddingUser ? 'إلغاء' : 'إضافة مستخدم جديد'}
        </button>
      </div>

      {isAddingUser && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4 border-b border-[#1a1a1a] pb-2">بيانات المستخدم الجديد</h3>
          {error && <div className="bg-red-500/10 text-red-400 p-3 rounded mb-4 text-sm border border-red-500/20">{error}</div>}
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">اسم المستخدم (اليوزر) أو رقم الهاتف</label>
              <input type="text" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">كلمة المرور</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">الاسم الكامل</label>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">الرقم الإحصائي</label>
              <input type="text" value={statisticalNumber} onChange={e => setStatisticalNumber(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">الصنف (الرتبة)</label>
              <select required value={classification} onChange={e => { setClassification(e.target.value); setRank(''); setGrade(''); }} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm">
                <option value="">اختر...</option>
                <option value="ضابط">ضابط</option>
                <option value="موظف مدني">موظف مدني</option>
                <option value="مراتب">مراتب</option>
              </select>
            </div>
            
            {classification && (
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">{classification === 'ضابط' || classification === 'مراتب' ? 'الرتبة' : 'الدرجة'}</label>
                <select required value={classification === 'موظف مدني' ? grade : rank} onChange={e => classification === 'موظف مدني' ? setGrade(e.target.value) : setRank(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm">
                  <option value="">اختر...</option>
                  {getRankOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            )}
            
            <div className="col-span-1 md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-bold text-gray-400 mb-1">التولد (يوم / شهر / سنة)</label>
              <div className="flex gap-2">
                <input type="number" min="1" max="31" placeholder="يوم" value={dobDay} onChange={e => setDobDay(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm" />
                <input type="number" min="1" max="12" placeholder="شهر" value={dobMonth} onChange={e => setDobMonth(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm" />
                <input type="number" min="1900" max={new Date().getFullYear()} placeholder="سنة" value={dobYear} onChange={e => setDobYear(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm" />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">اسم الأم الثلاثي</label>
              <input type="text" value={motherName} onChange={e => setMotherName(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">المحافظة</label>
              <input type="text" value={province} onChange={e => setProvince(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">مكان العمل</label>
              <input type="text" value={workspace} onChange={e => setWorkspace(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">الصلاحية</label>
              <select value={role} onChange={e => setRole(e.target.value as 'admin'|'data_entry')} className="w-full bg-[#111] border border-[#222] rounded p-2 text-white text-sm">
                <option value="data_entry">مدخل بيانات</option>
                <option value="admin">أدمن</option>
              </select>
            </div>
            
            <div className="col-span-full pt-4 border-t border-[#1a1a1a]">
              <button type="submit" disabled={submitting} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded transition-colors disabled:opacity-50">
                {submitting ? 'جاري الإضافة...' : 'إضافة وحفظ'}
              </button>
              <p className="text-[10px] text-gray-500 mt-2">تنبيه: ستتم إعادة تحميل الصفحة تلقائياً وتسجيل دخولك كالمستخدم الجديد عند الإضافة (قيد في Firebase Client SDK).</p>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users List */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col max-h-[600px]">
          <div className="p-4 border-b border-[#1a1a1a] bg-[#111] flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-white">المستخدمين المسجلين</h3>
            <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-full mr-auto">{users.length}</span>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">جاري التحميل...</div>
            ) : users.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">لا يوجد مستخدمين</div>
            ) : (
              <div className="space-y-2">
                {users.map(user => (
                  <div key={user.id} className="bg-[#111] border border-[#222] p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white">{user.fullName}</h4>
                      <p className="text-xs text-gray-400 font-mono mt-0.5" dir="ltr">{user.email?.replace('@archive.system.local', '')}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{user.classification} - {user.classification === 'موظف مدني' ? user.grade : user.rank}</span>
                        {user.role === 'admin' && <span className="text-[10px] bg-cyan-900/40 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800/50">أدمن</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Audit Logs */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col max-h-[600px]">
          <div className="p-4 border-b border-[#1a1a1a] bg-[#111] flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-white">سجل المستحدثات (Audit Logs)</h3>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {logs.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">لا توجد حركات مسجلة</div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="bg-[#111] border border-[#222] p-3 rounded-lg flex gap-3 items-start">
                    <div className="shrink-0 mt-0.5">
                      {log.action === 'create' && <Plus className="w-4 h-4 text-green-500" />}
                      {log.action === 'update' && <CheckCircle className="w-4 h-4 text-cyan-500" />}
                      {log.action === 'delete' && <X className="w-4 h-4 text-red-500" />}
                    </div>
                    <div>
                      <p className="text-sm text-gray-200">
                        <span className="font-bold text-white">{log.userName}</span>{' '}
                        {log.action === 'create' && 'أضاف وثيقة جديدة'}
                        {log.action === 'update' && 'عدل على وثيقة'}
                        {log.action === 'delete' && 'حذف وثيقة'}
                        {' '}
                        {log.documentNumber && <span className="font-mono text-cyan-400">({log.documentNumber})</span>}
                      </p>
                      {log.documentSubject && <p className="text-xs text-gray-500 mt-1 line-clamp-1">"{log.documentSubject}"</p>}
                      <p className="text-[10px] text-gray-600 mt-2">{new Date(log.timestamp).toLocaleString('ar-IQ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
