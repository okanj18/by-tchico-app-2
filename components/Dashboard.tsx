
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Depense, StatutCommande, Client } from '../types';
import { getAIAnalysis } from '../services/geminiService';
import app from '../services/firebase';
import { Sparkles, ArrowRight, Loader, Cake, MessageCircle, Gift, AlertTriangle, CheckCircle, Clock, Scissors, Activity, Shirt, CheckSquare, CloudOff, HelpCircle, X, ExternalLink, Copy, Database, TrendingUp, Star, Zap } from 'lucide-react';

interface DashboardProps {
    commandes: Commande[];
    employes: Employe[];
    depenses: Depense[];
    clients: Client[];
}

const Dashboard: React.FC<DashboardProps> = ({ commandes, employes, depenses, clients }) => {
    const [aiAdvice, setAiAdvice] = useState<string | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [showSyncHelp, setShowSyncHelp] = useState(false);

    const isOfflineMode = !app;

    const pendingOrders = commandes.filter(c => c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE).length;
    const activeTailors = employes.filter(e => e.actif !== false).length; 
    
    const productionStats = useMemo(() => {
        return {
            attente: commandes.filter(c => c.statut === StatutCommande.EN_ATTENTE).length,
            coupe: commandes.filter(c => c.statut === StatutCommande.EN_COUPE).length,
            couture: commandes.filter(c => c.statut === StatutCommande.COUTURE).length,
            finition: commandes.filter(c => c.statut === StatutCommande.FINITION).length,
            pret: commandes.filter(c => c.statut === StatutCommande.PRET).length
        };
    }, [commandes]);

    const upcomingBirthdays = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        return clients.filter(client => {
            if (!client.dateAnniversaire) return false;
            const birthDate = new Date(client.dateAnniversaire);
            const currentYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
            const diffTime = currentYearBirthday.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return diffDays >= 0 && diffDays <= 7;
        });
    }, [clients]);

    const urgentOrders = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return commandes.filter(c => {
            if (c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE || c.archived) return false;
            const deadline = new Date(c.dateLivraisonPrevue);
            const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays <= 3;
        }).sort((a, b) => new Date(a.dateLivraisonPrevue).getTime() - new Date(b.dateLivraisonPrevue).getTime());
    }, [commandes]);

    // CALCUL DU "SANTÉ SCORE" DE L'ENTREPRISE (0-100)
    const businessHealthScore = useMemo(() => {
        let score = 70; // Base
        if (urgentOrders.length > 5) score -= 20;
        if (productionStats.pret > 5) score += 10;
        if (pendingOrders > activeTailors * 4) score -= 15;
        return Math.max(0, Math.min(100, score));
    }, [urgentOrders, productionStats, pendingOrders, activeTailors]);

    const handleAskAI = async () => {
        setLoadingAI(true);
        const context = JSON.stringify({
            commandesEnCours: pendingOrders,
            commandesUrgentes: urgentOrders.length,
            chiffreAffaires: commandes.reduce((acc, c) => acc + c.prixTotal, 0),
            depensesTotales: depenses.reduce((acc, d) => acc + d.montant, 0),
            tailleursDisponibles: activeTailors,
            statutCommandes: productionStats,
            anniversairesProchains: upcomingBirthdays.length
        });
        const prompt = "Analyse la performance de BY TCHICO. Donne moi une recommandation stratégique très courte.";
        const response = await getAIAnalysis(context, prompt);
        setAiAdvice(response);
        setLoadingAI(false);
    };

    return (
        <div className="space-y-6">
            {isOfflineMode && (
                <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r shadow-sm animate-pulse">
                    <div className="flex items-start">
                        <CloudOff className="h-5 w-5 text-orange-500 mr-3" />
                        <div className="text-xs text-orange-700">
                            <strong>Mode Local Actif.</strong> Les données sont en sécurité sur cet appareil.
                            <button onClick={() => setShowSyncHelp(true)} className="ml-2 underline font-black">En savoir plus</button>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER LUXE AVEC SCORE DE SANTÉ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-brand-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black mb-2 tracking-tighter uppercase">BY TCHICO <span className="text-brand-400">Intelligence</span></h1>
                        <p className="text-brand-200 text-sm font-medium max-w-md">L'excellence de la couture sénégalaise, pilotée par la donnée.</p>
                        
                        <div className="mt-8 flex items-center gap-6">
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black uppercase text-brand-300 tracking-widest mb-1">Commandes</p>
                                <p className="text-2xl font-black">{pendingOrders}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black uppercase text-brand-300 tracking-widest mb-1">Urgences</p>
                                <p className="text-2xl font-black text-orange-400">{urgentOrders.length}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black uppercase text-brand-300 tracking-widest mb-1">Loyauté Or</p>
                                <p className="text-2xl font-black text-yellow-400">{clients.length > 0 ? 'Active' : 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 p-8 flex flex-col items-center">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-brand-800" />
                                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * businessHealthScore) / 100} className="text-brand-400" />
                            </svg>
                            <span className="absolute text-xl font-black">{businessHealthScore}%</span>
                        </div>
                        <p className="text-[8px] font-black uppercase tracking-widest mt-2 text-brand-300">Santé Business</p>
                    </div>
                </div>

                {/* AI ACTION CARD */}
                <div className="bg-white rounded-[2rem] p-8 border-2 border-brand-100 shadow-xl flex flex-col justify-center items-center text-center">
                    <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4 text-brand-600">
                        <Zap size={32} />
                    </div>
                    <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest mb-4">Analyse Stratégique</h3>
                    {!aiAdvice ? (
                        <button 
                            onClick={handleAskAI}
                            disabled={loadingAI}
                            className="bg-brand-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loadingAI ? 'Calcul en cours...' : 'Consulter Gemini IA'}
                        </button>
                    ) : (
                        <div className="animate-in fade-in duration-500">
                            <p className="text-xs text-gray-600 italic leading-relaxed mb-4">"{aiAdvice}"</p>
                            <button onClick={() => setAiAdvice(null)} className="text-[9px] font-black uppercase text-brand-600 underline">Nouvelle analyse</button>
                        </div>
                    )}
                </div>
            </div>

            {/* FLUX ATELIER REVISITÉ */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="font-black text-gray-800 uppercase text-xs tracking-[0.2em] flex items-center gap-2">
                        <TrendingUp size={16} className="text-brand-600"/> Performance de l'Atelier
                    </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: 'Attente', val: productionStats.attente, color: 'bg-gray-100 text-gray-500' },
                        { label: 'En Coupe', val: productionStats.coupe, color: 'bg-blue-50 text-blue-600' },
                        { label: 'Couture', val: productionStats.couture, color: 'bg-indigo-50 text-indigo-600' },
                        { label: 'Finition', val: productionStats.finition, color: 'bg-purple-50 text-purple-600' },
                        { label: 'Prêt', val: productionStats.pret, color: 'bg-green-50 text-green-600' },
                    ].map((s, i) => (
                        <div key={i} className={`${s.color} p-6 rounded-2xl flex flex-col items-center justify-center border border-white shadow-sm`}>
                            <span className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">{s.label}</span>
                            <span className="text-3xl font-black">{s.val}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                    <h3 className="font-black text-gray-800 uppercase text-xs tracking-[0.2em] mb-6 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-red-500"/> Priorités de livraison
                    </h3>
                    <div className="space-y-4">
                        {urgentOrders.slice(0, 5).map(cmd => (
                            <div key={cmd.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-brand-300 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm font-black text-xs text-brand-900">{cmd.clientNom.charAt(0)}</div>
                                    <div>
                                        <p className="font-black text-gray-800 uppercase text-xs">{cmd.clientNom}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{cmd.description}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</p>
                                    <span className="text-[8px] font-bold bg-white px-2 py-0.5 rounded border uppercase">Urgent</span>
                                </div>
                            </div>
                        ))}
                        {urgentOrders.length === 0 && <p className="text-center text-gray-400 italic py-8 text-sm">Toutes les livraisons sont sous contrôle.</p>}
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-8 border border-pink-100 shadow-sm">
                    <h3 className="font-black text-gray-800 uppercase text-xs tracking-[0.2em] mb-6 flex items-center gap-2">
                        <Star size={16} className="text-pink-500"/> Fidélité & Évènements
                    </h3>
                    <div className="space-y-4">
                        {upcomingBirthdays.map(client => (
                            <div key={client.id} className="flex items-center justify-between p-4 bg-pink-50/50 rounded-2xl border border-pink-100">
                                <div className="flex items-center gap-3">
                                    <Cake className="text-pink-400" size={18} />
                                    <div>
                                        <p className="font-black text-gray-800 uppercase text-[10px]">{client.nom}</p>
                                        <p className="text-[9px] text-pink-500 font-bold">Anniversaire bientôt</p>
                                    </div>
                                </div>
                                <button onClick={() => window.open(`https://wa.me/${client.telephone.replace(/\D/g,'')}?text=Joyeux Anniversaire !`, '_blank')} className="p-2 bg-white text-green-500 rounded-full shadow-sm hover:bg-green-50"><MessageCircle size={16}/></button>
                            </div>
                        ))}
                        {upcomingBirthdays.length === 0 && <p className="text-center text-gray-300 italic py-8 text-[10px] uppercase font-bold">Aucun anniversaire cette semaine</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
