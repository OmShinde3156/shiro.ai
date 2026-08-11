
import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CheckCircle, List, FileText, Send, Loader2, Award, Info } from 'lucide-react';
import API_BASE_URL from '../../api/config';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import toast from 'react-hot-toast';

const AnswerPlanner = () => {
    const { user } = useAuth();
    const { documents, fetchDocuments: refreshDocs } = useContext(Context);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [activeTab, setActiveTab] = useState('answer'); // 'plan', 'answer', 'verification'

    const [formData, setFormData] = useState({
        question: '',
        marks: 5,
        document_id: '',
        answer_type: 'descriptive',
        subject: 'General'
    });

    useEffect(() => {
        if (user?.id) {
            refreshDocs(user.id);
        }
    }, [user]);

    useEffect(() => {
        if (documents.length > 0 && !formData.document_id) {
            setFormData(prev => ({ ...prev, document_id: documents[0].id }));
        }
    }, [documents]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.question || !formData.document_id) {
            toast.error("Please fill in all required fields");
            return;
        }

        setLoading(true);
        setResult(null);
        try {
            const res = await fetch(`${API_BASE_URL}/features/answer-planner`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                const data = await res.json();
                setResult(data);
                setActiveTab('answer');
                toast.success("Answer blueprint generated!");
            } else {
                const err = await res.json();
                toast.error(err.detail || "Generation failed");
            }
        } catch (err) {
            toast.error("Server error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0e14] p-6 lg:p-10 text-white font-inter">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="mb-10">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#72dcff] to-[#ae72ff] mb-2">
                        Multi-Stage Answer Engine
                    </h1>
                    <p className="text-gray-400">Structure, write, and verify exam-ready answers using Truth-Aware RAG.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Panel: Input Form */}
                    <div className="lg:col-span-4">
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-[#151926] border border-white/10 rounded-2xl p-6 sticky top-6"
                        >
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Select Source Material</label>
                                    <select 
                                        className="w-full bg-[#1c2333] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#72dcff] transition-all"
                                        value={formData.document_id}
                                        onChange={(e) => setFormData({...formData, document_id: e.target.value})}
                                    >
                                        {documents.map(doc => (
                                            <option key={doc.id} value={doc.id}>{doc.filename}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Question</label>
                                    <textarea 
                                        rows="4"
                                        placeholder="e.g., Explain the mechanism of Photosynthesis."
                                        className="w-full bg-[#1c2333] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#72dcff] transition-all resize-none"
                                        value={formData.question}
                                        onChange={(e) => setFormData({...formData, question: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Marks</label>
                                        <input 
                                            type="number"
                                            className="w-full bg-[#1c2333] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#72dcff] transition-all"
                                            value={formData.marks}
                                            onChange={(e) => setFormData({...formData, marks: parseInt(e.target.value, 10) || 5})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Subject</label>
                                        <input 
                                            type="text"
                                            placeholder="Biology"
                                            className="w-full bg-[#1c2333] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#72dcff] transition-all"
                                            value={formData.subject}
                                            onChange={(e) => setFormData({...formData, subject: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <button 
                                    disabled={loading}
                                    type="submit"
                                    className="w-full bg-gradient-to-r from-[#72dcff] to-[#ae72ff] hover:opacity-90 disabled:opacity-50 text-[#0b0e14] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(114,220,255,0.3)]"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                                    {loading ? "Processing Stages..." : "Generate Answer"}
                                </button>
                            </form>
                        </motion.div>
                    </div>

                    {/* Right Panel: Output Visualization */}
                    <div className="lg:col-span-8">
                        <AnimatePresence mode="wait">
                            {!result && !loading && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-white/5 rounded-3xl"
                                >
                                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                        <Award className="text-white/20" size={40} />
                                    </div>
                                    <h3 className="text-xl font-medium text-gray-400">Ready for Execution</h3>
                                    <p className="text-gray-500 max-w-sm mt-2">Input your question to trigger the 3-stage Truth-Aware pipeline.</p>
                                </motion.div>
                            )}

                            {loading && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="space-y-6"
                                >
                                    {[1, 2, 3].map((s) => (
                                        <div key={s} className="bg-[#151926] border border-white/5 rounded-2xl p-6 animate-pulse">
                                            <div className="h-4 w-40 bg-white/5 rounded mb-4" />
                                            <div className="h-2 w-full bg-white/5 rounded mb-2" />
                                            <div className="h-2 w-2/3 bg-white/5 rounded" />
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                            {result && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-6"
                                >
                                    {/* Tabs */}
                                    <div className="flex bg-[#151926] p-1 rounded-xl border border-white/10">
                                        {[
                                            { id: 'plan', label: 'Blueprint', icon: List },
                                            { id: 'answer', label: 'Exam Answer', icon: FileText },
                                            { id: 'verification', label: 'Verification', icon: CheckCircle },
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${activeTab === tab.id ? 'bg-[#72dcff]/10 text-[#72dcff]' : 'text-gray-500 hover:text-gray-300'}`}
                                            >
                                                <tab.icon size={16} />
                                                <span className="text-sm font-medium">{tab.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Tab Content */}
                                    <div className="bg-[#151926] border border-white/10 rounded-2xl p-8 min-h-[400px]">
                                        {activeTab === 'plan' && (
                                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                                                <section>
                                                    <h4 className="text-[#72dcff] text-xs font-bold uppercase tracking-wider mb-4">Introduction Strategy</h4>
                                                    <p className="text-gray-300 leading-relaxed">{result.plan.intro}</p>
                                                </section>
                                                <section>
                                                    <h4 className="text-[#ae72ff] text-xs font-bold uppercase tracking-wider mb-4">Core Points</h4>
                                                    <div className="space-y-3">
                                                        {result.plan.points.map((p, i) => (
                                                            <div key={i} className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                                                                <span className="w-6 h-6 rounded bg-[#ae72ff]/20 text-[#ae72ff] flex items-center justify-center text-xs font-bold">{i+1}</span>
                                                                <div className="flex-1">
                                                                    <p className="text-sm text-gray-200">{p.text}</p>
                                                                    <span className={`text-[10px] uppercase font-bold mt-2 inline-block ${p.importance === 'high' ? 'text-red-400' : 'text-blue-400'}`}>
                                                                        Priority: {p.importance}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <section>
                                                        <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">Example Case</h4>
                                                        <p className="text-sm text-gray-400 italic">{result.plan.example}</p>
                                                    </section>
                                                    <section>
                                                        <h4 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">Word Budget</h4>
                                                        <div className="text-[11px] space-y-1 text-gray-500">
                                                            <div>Intro: {result.plan.word_budget.intro} words</div>
                                                            <div>Body: {result.plan.word_budget.points_total} words</div>
                                                            <div>Total Target: {result.marks * 20} words</div>
                                                        </div>
                                                    </section>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'answer' && (
                                            <div className="animate-in fade-in slide-in-from-bottom-2">
                                                <div className="flex items-center justify-between mb-8">
                                                    <div className="flex items-center gap-2 text-[#72dcff]">
                                                        <FileText size={20} />
                                                        <span className="font-bold">Final Exam Response</span>
                                                    </div>
                                                    <div className="px-3 py-1 rounded-full bg-[#72dcff]/10 border border-[#72dcff]/20 text-[#72dcff] text-xs font-bold">
                                                        Marks: {result.marks}
                                                    </div>
                                                </div>
                                                <div className="prose prose-invert max-w-none">
                                                    <div className="text-lg text-gray-200 leading-relaxed whitespace-pre-wrap font-serif">
                                                        {result.final_answer}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'verification' && (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                                <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                                                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-[#0b0e14]">
                                                        <CheckCircle size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-emerald-400">RAG Confidence Score: {(result.confidence * 100).toFixed(1)}%</div>
                                                        <div className="text-xs text-emerald-400/60">Verified against source: {documents.find(d => d.id == formData.document_id)?.filename}</div>
                                                    </div>
                                                </div>

                                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Chain of Verification Results</h4>
                                                <div className="space-y-3">
                                                    {result.verification.map((v, i) => (
                                                        <div key={i} className={`p-4 rounded-xl border ${v.is_verified ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className={`w-2 h-2 rounded-full ${v.is_verified ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                                <span className="text-xs font-bold text-gray-300">Claim {i+1}</span>
                                                            </div>
                                                            <p className="text-sm text-gray-400 mb-2">{v.claim}</p>
                                                            <div className="text-[11px] text-gray-500 flex items-center gap-1">
                                                                <Info size={12} />
                                                                {v.reason}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnswerPlanner;
