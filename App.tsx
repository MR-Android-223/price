
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, MoreVertical, Trash2, Calendar, 
    Download, Upload, Lock, X, 
    Sparkles, MessageCircle, Play, RefreshCw, AlertCircle, Copy
} from 'lucide-react';
import { AppData, DebtRecord, ModalType } from './types';
import { storage } from './services/storage';
import { geminiService, playAudio } from './services/gemini';

// --- Types & Constants ---
const ROW_COUNT = 200;
const DEFAULT_EXCHANGE_RATE = 10000;

// --- Modal Component ---
interface ModalProps {
    children?: React.ReactNode;
    onClose: () => void;
    title: string;
}

const Modal = ({ children, onClose, title }: ModalProps) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <h2 className="text-xl font-black text-slate-800">{title}</h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition">
                    <X className="w-6 h-6 text-slate-400" />
                </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-1 py-2">
                {children}
            </div>
        </div>
    </div>
);

// --- Global window extensions ---
declare global {
  // Define AIStudio interface to resolve conflicting types in the global Window object
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Correctly declare aistudio with the AIStudio type as expected by the environment
    aistudio: AIStudio;
    webkitAudioContext: typeof AudioContext;
  }
}

export default function App() {
    // --- State ---
    const [data, setData] = useState<AppData>(() => {
        const loaded = storage.load();
        const records = loaded?.records || Array.from({ length: ROW_COUNT }, (_, i) => ({
            id: `row-${i}`, name: '', liraDebt: '', dollarDebt: '', category: '', date: ''
        }));
        return {
            records: records.length === ROW_COUNT ? records : [...records, ...Array.from({ length: Math.max(0, ROW_COUNT - records.length) }, (_, i) => ({
                id: `extra-${i}`, name: '', liraDebt: '', dollarDebt: '', category: '', date: ''
            }))],
            settings: loaded?.settings || {
                exchangeRate: DEFAULT_EXCHANGE_RATE,
                columnNames: ['الاسم', 'ليرة', 'دولار', 'الصنف', 'التاريخ'],
                password: ''
            }
        };
    });

    const [isLocked, setIsLocked] = useState(!!data.settings.password);
    const [passwordInput, setPasswordInput] = useState('');
    const [activeModal, setActiveModal] = useState<ModalType>(ModalType.NONE);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [meditationVisual, setMeditationVisual] = useState<string | null>(null);
    const [hasApiKey, setHasApiKey] = useState(false);
    const [exchangeRateTemp, setExchangeRateTemp] = useState(data.settings.exchangeRate.toString());

    // --- Sync & Auth ---
    useEffect(() => {
        storage.save(data);
    }, [data]);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio) {
                const selected = await window.aistudio.hasSelectedApiKey();
                setHasApiKey(selected);
            }
        };
        checkKey();
    }, []);

    const handleOpenKeySelector = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setHasApiKey(true);
        }
    };

    // --- Handlers ---
    const updateRecord = (index: number, field: keyof DebtRecord, value: string) => {
        const updated = [...data.records];
        updated[index] = { ...updated[index], [field]: value };
        setData({ ...data, records: updated });
    };

    const updateHeader = (index: number, value: string) => {
        const updatedHeaders = [...data.settings.columnNames];
        updatedHeaders[index] = value;
        setData({ ...data, settings: { ...data.settings, columnNames: updatedHeaders } });
    };

    const fillDateSequentially = (startIndex: number) => {
        const today = new Date().toISOString().split('T')[0];
        const updated = [...data.records];
        for (let i = startIndex; i < updated.length; i++) {
            updated[i] = { ...updated[i], date: today };
        }
        setData({ ...data, records: updated });
    };

    const deletePersonData = (name: string) => {
        if (window.confirm(`هل أنت متأكد من مسح جميع بيانات "${name}"؟`)) {
            const cleaned = data.records.map(r => 
                r.name === name ? { ...r, name: '', liraDebt: '', dollarDebt: '', category: '', date: '' } : r
            );
            setData({ ...data, records: cleaned });
        }
    };

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        const filtered = data.records.filter(r => r.name.toLowerCase().includes(q));
        const uniqueNames = Array.from(new Set(filtered.map(r => r.name).filter(n => n !== '')));
        
        return uniqueNames.map(name => {
            const personRows = data.records.filter(r => r.name === name);
            const totalLira = personRows.reduce((s, r) => s + (parseFloat(r.liraDebt) || 0), 0);
            const totalDollar = personRows.reduce((s, r) => s + (parseFloat(r.dollarDebt) || 0), 0);
            return { name, totalLira, totalDollar, count: personRows.length };
        });
    }, [data.records, searchQuery]);

    // --- AI Functions ---
    const generateMeditation = async () => {
        if (!hasApiKey) {
            await handleOpenKeySelector();
        }
        setIsAiLoading(true);
        try {
            const visual = await geminiService.generateVisual("A serene glowing lotus in a peaceful pond at night, 4k digital art");
            if (visual) setMeditationVisual(visual);

            const audioBase64 = await geminiService.generateSpeech("أغمض عينيك.. خذ نفساً عميقاً.. سجلاتك منظمة.. حساباتك في أمان.. ركز على هدوء أنفاسك الآن.");
            if (audioBase64) playAudio(audioBase64);
        } catch (e: any) {
            if (e.message?.includes("Requested entity was not found")) {
                setHasApiKey(false);
                alert('يرجى إعادة اختيار مفتاح API صالح');
            } else {
                alert('فشل في تحميل ميزات الذكاء الاصطناعي');
            }
        } finally {
            setIsAiLoading(false);
        }
    };

    // --- Views ---
    if (isLocked) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
                <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[3rem] w-full max-w-sm text-center border border-white/20 shadow-2xl">
                    <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-10 h-10 text-indigo-300" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-6">مغلق بكلمة مرور</h2>
                    <input
                        type="password"
                        className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white text-center mb-4 focus:bg-white/10 outline-none"
                        placeholder="أدخل الرمز"
                        value={passwordInput}
                        onChange={e => setPasswordInput(e.target.value)}
                    />
                    <button 
                        onClick={() => {
                            if (passwordInput === data.settings.password) setIsLocked(false);
                            else alert('الرمز غير صحيح');
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold transition"
                    >دخول</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col max-w-5xl mx-auto bg-white shadow-2xl overflow-hidden relative">
            <header className="bg-indigo-600 text-white p-4 flex items-center justify-between sticky top-0 z-40 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="font-black text-lg leading-tight">Balance & Zen</h1>
                        <p className="text-[10px] opacity-70 font-bold">إدارة الديون والتأمل</p>
                    </div>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => setActiveModal(ModalType.SEARCH)} className="p-2 hover:bg-white/10 rounded-xl transition"><Search className="w-6 h-6" /></button>
                    <button onClick={() => setActiveModal(ModalType.SETTINGS)} className="p-2 hover:bg-white/10 rounded-xl transition"><MoreVertical className="w-6 h-6" /></button>
                </div>
            </header>

            <div className="bg-slate-50 border-b px-4 py-2 flex justify-between text-[10px] font-bold text-slate-500">
                <span>سعر الصرف: <span className="text-indigo-600 font-mono">{data.settings.exchangeRate.toLocaleString()}</span> ل.س</span>
                <span>الصفوف: <span className="text-slate-800 font-mono">{ROW_COUNT}</span></span>
            </div>

            <main className="flex-1 overflow-auto custom-scrollbar bg-slate-100">
                <div className="min-w-[600px]">
                    <div className="flex bg-slate-200 sticky top-0 z-30 shadow-sm border-b-2 border-slate-300">
                        {data.settings.columnNames.map((col, i) => (
                            <input 
                                key={`h-${i}`}
                                className="flex-1 bg-transparent p-3 text-center text-xs font-black text-indigo-900 border-l border-slate-300 outline-none focus:bg-white transition-colors"
                                value={col}
                                onChange={e => updateHeader(i, e.target.value)}
                            />
                        ))}
                    </div>

                    <div className="divide-y divide-slate-200 bg-white">
                        {data.records.map((row, idx) => (
                            <div key={row.id} className="flex grid-row group hover:bg-indigo-50/30 transition-colors">
                                <input 
                                    className="flex-1 p-2 text-xs bg-transparent outline-none border-l border-slate-100 focus:bg-white font-bold" 
                                    placeholder="الاسم"
                                    value={row.name} 
                                    onChange={e => updateRecord(idx, 'name', e.target.value)}
                                />
                                <input 
                                    className="flex-1 p-2 text-xs text-center font-mono bg-transparent outline-none border-l border-slate-100 focus:bg-white text-blue-600 font-bold" 
                                    placeholder="0"
                                    type="number"
                                    value={row.liraDebt} 
                                    onChange={e => updateRecord(idx, 'liraDebt', e.target.value)}
                                />
                                <input 
                                    className="flex-1 p-2 text-xs text-center font-mono bg-transparent outline-none border-l border-slate-100 focus:bg-white text-emerald-600 font-bold" 
                                    placeholder="0$"
                                    type="number"
                                    value={row.dollarDebt} 
                                    onChange={e => updateRecord(idx, 'dollarDebt', e.target.value)}
                                />
                                <input 
                                    className="flex-1 p-2 text-xs bg-transparent outline-none border-l border-slate-100 focus:bg-white" 
                                    placeholder="الصنف"
                                    value={row.category} 
                                    onChange={e => updateRecord(idx, 'category', e.target.value)}
                                />
                                <div className="flex-1 relative">
                                    <input 
                                        className="w-full p-2 text-[10px] text-center font-mono bg-transparent outline-none cursor-pointer focus:bg-white" 
                                        type="date"
                                        value={row.date} 
                                        onChange={e => updateRecord(idx, 'date', e.target.value)}
                                        onClick={() => !row.date && fillDateSequentially(idx)}
                                    />
                                    {idx === 0 && !row.date && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); fillDateSequentially(0); }} 
                                            className="absolute left-1 top-1/2 -translate-y-1/2 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Calendar className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <div className="fixed bottom-6 left-6 flex flex-col gap-3 z-50">
                <button 
                    onClick={() => setActiveModal(ModalType.AI_CHAT)}
                    className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition"
                >
                    <MessageCircle className="w-6 h-6" />
                </button>
                <button 
                    onClick={generateMeditation}
                    className="w-14 h-14 bg-emerald-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition overflow-hidden"
                >
                    {isAiLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
                </button>
            </div>

            {activeModal === ModalType.SETTINGS && (
                <Modal title="إعدادات النظام" onClose={() => setActiveModal(ModalType.NONE)}>
                    <div className="space-y-4 pb-4">
                        <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                            <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase tracking-widest">تحديث سعر صرف الدولار</label>
                            <div className="flex gap-2">
                                <input 
                                    type="number"
                                    className="flex-1 p-4 bg-white border border-slate-200 rounded-2xl outline-none font-mono focus:border-indigo-500 font-bold"
                                    value={exchangeRateTemp}
                                    onChange={e => setExchangeRateTemp(e.target.value)}
                                />
                                <button 
                                    onClick={() => setData({ ...data, settings: { ...data.settings, exchangeRate: parseInt(exchangeRateTemp) || DEFAULT_EXCHANGE_RATE } })}
                                    className="bg-indigo-600 text-white px-6 rounded-2xl font-bold hover:bg-indigo-700 transition"
                                >تحديث</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => storage.exportData(data)} className="flex flex-col items-center gap-2 p-4 bg-indigo-50 text-indigo-700 rounded-3xl font-bold hover:bg-indigo-100 transition text-center">
                                <Copy className="w-6 h-6" /> <span className="text-[10px]">تصدير (نسخ)</span>
                            </button>
                            <button onClick={() => {
                                const json = prompt('قم بلصق كود البيانات هنا:');
                                if (json) {
                                    const imported = storage.importData(json);
                                    if (imported) { setData(imported); alert('تم الاستيراد بنجاح'); }
                                    else alert('بيانات غير صالحة');
                                }
                            }} className="flex flex-col items-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-3xl font-bold hover:bg-emerald-100 transition text-center">
                                <Upload className="w-6 h-6" /> <span className="text-[10px]">استيراد يدوي</span>
                            </button>
                            <button onClick={() => setActiveModal(ModalType.PASSWORD)} className="flex flex-col items-center gap-2 p-4 bg-amber-50 text-amber-700 rounded-3xl font-bold hover:bg-amber-100 transition text-center">
                                <Lock className="w-6 h-6" /> <span className="text-[10px]">{data.settings.password ? 'تغيير القفل' : 'إضافة قفل'}</span>
                            </button>
                            <button onClick={() => storage.clear()} className="flex flex-col items-center gap-2 p-4 bg-red-50 text-red-700 rounded-3xl font-bold hover:bg-red-100 transition text-center">
                                <Trash2 className="w-6 h-6" /> <span className="text-[10px]">مسح البيانات</span>
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {activeModal === ModalType.SEARCH && (
                <Modal title="محرك البحث عن العملاء" onClose={() => setActiveModal(ModalType.NONE)}>
                    <div className="relative mb-6">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input 
                            autoFocus
                            className="w-full p-5 pr-12 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none focus:border-indigo-500 transition-all font-bold text-slate-800"
                            placeholder="ابحث عن اسم الشخص..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar px-1">
                        {searchResults.map(res => (
                            <div key={res.name} className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                                <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 mb-1">{res.name}</h3>
                                        <div className="flex gap-2">
                                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{res.count} سجلات</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => deletePersonData(res.name)}
                                        className="p-3 bg-red-50 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="mt-5 grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 p-4 rounded-3xl">
                                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mb-1 text-right">مجموع الليرة</span>
                                        <span className="text-lg font-black text-blue-600 font-mono">{res.totalLira.toLocaleString()}</span>
                                    </div>
                                    <div className="bg-emerald-50 p-4 rounded-3xl">
                                        <span className="text-[9px] text-emerald-600/60 block font-bold uppercase tracking-wider mb-1 text-right">مجموع الدولار</span>
                                        <span className="text-lg font-black text-emerald-600 font-mono">${res.totalDollar.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {searchQuery && searchResults.length === 0 && (
                            <div className="text-center py-12">
                                <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                <p className="text-slate-400 font-bold">لم يتم العثور على أي نتائج لهذا الاسم</p>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {activeModal === ModalType.PASSWORD && (
                <Modal title="حماية الخصوصية" onClose={() => setActiveModal(ModalType.NONE)}>
                    <div className="space-y-4">
                        <input 
                            type="password"
                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none text-center text-2xl font-black tracking-widest focus:border-amber-500"
                            placeholder="الرمز السري"
                            value={passwordInput}
                            onChange={e => setPasswordInput(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    setData({ ...data, settings: { ...data.settings, password: passwordInput } });
                                    setPasswordInput('');
                                    setActiveModal(ModalType.NONE);
                                    alert('تم حفظ كلمة المرور بنجاح');
                                }}
                                className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-bold hover:bg-amber-600 transition shadow-lg shadow-amber-200"
                            >حفظ وقفل</button>
                            <button 
                                onClick={() => {
                                    setData({ ...data, settings: { ...data.settings, password: '' } });
                                    setActiveModal(ModalType.NONE);
                                    alert('تم إزالة الحماية');
                                }}
                                className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-bold hover:bg-slate-200 transition"
                            >إلغاء الحماية</button>
                        </div>
                    </div>
                </Modal>
            )}

            {meditationVisual && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6">
                    <button 
                        onClick={() => setMeditationVisual(null)} 
                        className="absolute top-8 left-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/20"
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <div className="max-w-2xl w-full text-center animate-fade-in">
                        <img src={meditationVisual} className="w-full rounded-[3rem] shadow-[0_0_100px_rgba(79,70,229,0.3)] border border-white/10 mb-10" alt="Serene AI Meditation Visual" />
                        <h2 className="text-3xl font-black text-white mb-3">لحظة صفاء ذهني</h2>
                        <p className="text-white/60 font-bold max-w-md mx-auto text-center">استرخِ قليلاً.. تنفس بعمق.. واترك هموم الحسابات للذكاء الاصطناعي</p>
                    </div>
                </div>
            )}
        </div>
    );
}
