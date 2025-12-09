import React, { useState, useMemo } from 'react';
import { Commande, Employe, Depense, StatutCommande, Client } from '../types';
import { getAIAnalysis } from '../services/geminiService';
import { Sparkles, ArrowRight, Loader, Cake, MessageCircle, Gift, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface DashboardProps {
    commandes: Commande[];
    employes: Employe[];
    depenses: Depense[];
    clients: Client[];
}

const Dashboard: React.FC<DashboardProps> = ({ commandes, employes, depenses, clients }) => {
    const [aiAdvice, setAiAdvice] = useState<string | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);

    const pendingOrders = commandes.filter(c => c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE).length;
    const activeTailors = employes.filter(e => e.actif !== false).length; 
    
    // Logic to find upcoming birthdays (next 7 days)
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
        }).sort((a,b) => {
             const da = new Date(a.dateAnniversaire!);
             const db = new Date(b.dateAnniversaire!);
             const dateA = new Date(today.getFullYear(), da.getMonth(), da.getDate());
             const dateB = new Date(today.getFullYear(), db.getMonth(), db.getDate());
             return dateA.getTime() - dateB.getTime();
        });
    }, [clients]);

    // Logic for Urgent Orders (Deadline <= 3 days)
    const urgentOrders = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return commandes.filter(c => {
            if (c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE || c.archived) return false;
            
            const deadline = new Date(c.dateLivraisonPrevue);
            deadline.setHours(0, 0, 0, 0);
            const diffTime = deadline.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Alert if Late (< 0) or Urgent (<= 3 days)
            return diffDays <= 3;
        }).sort((a, b) => new Date(a.dateLivraisonPrevue).getTime() - new Date(b.dateLivraisonPrevue).getTime());
    }, [commandes]);

    // Prepare data context for AI
    const handleAskAI = async () => {
        setLoadingAI(true);
        const context = JSON.stringify({
            commandesEnCours: pendingOrders,
            commandesUrgentes: urgentOrders.length,
            chiffreAffaires: commandes.reduce((acc, c) => acc + c.prixTotal, 0),
            depensesTotales: depenses.reduce((acc, d) => acc + d.montant, 0),
            tailleursDisponibles: activeTailors,
            statutCommandes: commandes.map(c => c.statut),
            anniversairesProchains: upcomingBirthdays.length
        });
        
        const prompt = "Analyse la performance actuelle de BY TCHICO. Donne moi 3 points clés (Production, Vente, Finance) et une recommandation stratégique pour la semaine prochaine. Mentionne s'il y a des opportunités avec les commandes urgentes ou les anniversaires.";
        
        const response = await getAIAnalysis(context, prompt);
        setAiAdvice(response);
        setLoadingAI(false);
    };

    const handleWhatsAppBirthday = (client: Client) => {
        const msg = `Joyeux Anniversaire ${client.nom} ! 🎉 Toute l'équipe BY TCHICO vous souhaite une excellente journée. Passez nous voir pour une surprise !`;
        const url = `https://wa.me/${client.telephone.replace(/\s+/g, '').replace('+', '')}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="space-y-4">
            {/* Banner Compact */}
            <div className="bg-gradient-to-r from-brand-900 to-brand-700 rounded-xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-center min-h-[100px]">
                <div className="relative z-10">
                    <h1 className="text-xl font-bold mb-1">Bonjour, Gérant BY TCHICO</h1>
                    <p className="text-brand-100 opacity-90 text-sm max-w-2xl">
                        Voici le résumé de l'activité de vos boutiques et de l'unité de production.
                    </p>
                </div>
                {/* Decorative circle */}
                <div className="absolute -right-10 -bottom-16 w-48 h-48 bg-brand-500 rounded-full opacity-20 blur-3xl"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Stats Column */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Quick Stats Grid - Compact Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-brand-200 transition-colors flex flex-col justify-between h-24">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Commandes en cours</p>
                            <p className="text-2xl font-bold text-gray-800">{pendingOrders}</p>
                            <div className="text-[10px] text-orange-500 font-medium">Priorité Atelier</div>
                        </div>
                        
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-brand-200 transition-colors flex flex-col justify-between h-24">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Effectif Actif</p>
                            <p className="text-2xl font-bold text-gray-800">{activeTailors}</p>
                            <div className="text-[10px] text-green-500 font-medium">Tailleurs & Vendeurs</div>
                        </div>

                        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-brand-200 transition-colors flex flex-col justify-between h-24">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Dépenses du mois</p>
                            <p className="text-2xl font-bold text-gray-800">
                                {(depenses.reduce((acc, d) => acc + d.montant, 0) / 1000).toFixed(0)}k
                            </p>
                            <div className="text-[10px] text-red-500 font-medium">FCFA Sorties</div>
                        </div>

                        {/* Alertes Livraisons Card */}
                        <div className={`bg-white p-3 rounded-lg shadow-sm border transition-colors flex flex-col justify-between h-24 ${urgentOrders.length > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 hover:border-brand-200'}`}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wider ${urgentOrders.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>Alertes Livraison</p>
                            <p className={`text-2xl font-bold ${urgentOrders.length > 0 ? 'text-red-700' : 'text-gray-800'}`}>{urgentOrders.length}</p>
                            <div className={`text-[10px] font-medium flex items-center gap-1 ${urgentOrders.length > 0 ? 'text-red-600' : 'text-green-500'}`}>
                                {urgentOrders.length > 0 ? <><AlertTriangle size={12} /> À traiter d'urgence</> : <><CheckCircle size={12} /> Tout est à jour</>}
                            </div>
                        </div>
                    </div>

                    {/* AI Advisor Section Compact */}
                    <div className="bg-white border border-brand-200 rounded-lg p-4 shadow-sm relative">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="text-brand-500 animate-pulse" size={16} />
                            <h2 className="text-sm font-bold text-gray-800">Conseiller IA (Gemini)</h2>
                        </div>
                        
                        {!aiAdvice ? (
                            <div className="text-center py-2">
                                <button 
                                    onClick={handleAskAI}
                                    disabled={loadingAI}
                                    className="inline-flex items-center gap-2 bg-black text-white px-4 py-1.5 rounded-full text-xs font-medium hover:bg-gray-800 transition-all disabled:opacity-70"
                                >
                                    {loadingAI ? <Loader className="animate-spin" size={14}/> : 'Analyser mon Business'}
                                    {!loadingAI && <ArrowRight size={14} />}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-gray-50 p-3 rounded border border-gray-100 text-gray-700 leading-snug whitespace-pre-line text-xs max-h-[120px] overflow-y-auto custom-scrollbar">
                                {aiAdvice}
                                <button 
                                    onClick={() => setAiAdvice(null)}
                                    className="block mt-2 text-brand-600 font-bold hover:underline"
                                >
                                    Fermer
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Events & Birthdays */}
                <div className="space-y-4">
                    {/* Urgent Deliveries List */}
                    <div className="bg-white rounded-lg shadow-sm border border-red-100 overflow-hidden relative h-full max-h-[300px] flex flex-col">
                        <div className="bg-gradient-to-r from-red-600 to-orange-600 p-3 text-white flex justify-between items-center shrink-0">
                            <h3 className="font-bold flex items-center gap-2 text-sm"><AlertTriangle size={16}/> Livraisons Urgentes</h3>
                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white font-medium">≤ 3 Jours</span>
                        </div>
                        <div className="p-3 bg-red-50/30 flex-1 overflow-y-auto custom-scrollbar">
                            {urgentOrders.length > 0 ? (
                                <div className="space-y-2">
                                    {urgentOrders.map(cmd => {
                                        const today = new Date(); today.setHours(0,0,0,0);
                                        const deadline = new Date(cmd.dateLivraisonPrevue); deadline.setHours(0,0,0,0);
                                        const diffTime = deadline.getTime() - today.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        
                                        const isLate = diffDays < 0;
                                        
                                        return (
                                            <div key={cmd.id} className="bg-white p-2 rounded border border-red-100 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-gray-800 text-xs truncate max-w-[120px]">{cmd.clientNom}</span>
                                                    <span className={`text-[10px] px-1.5 rounded font-bold ${isLate ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                        {isLate ? `Retard J+${Math.abs(diffDays)}` : diffDays === 0 ? "AUJOURD'HUI" : `J-${diffDays}`}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-600 truncate mb-1">{cmd.description}</p>
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-gray-400">#{cmd.id.slice(-4)}</span>
                                                    <span className="font-medium text-gray-500 flex items-center gap-1">
                                                        <Clock size={10} /> {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-gray-400 flex flex-col items-center justify-center h-full">
                                    <CheckCircle size={24} className="mb-2 opacity-20 text-green-500"/>
                                    <p className="text-xs">Aucune urgence signalée.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Birthdays Card Compact */}
                    <div className="bg-white rounded-lg shadow-sm border border-pink-100 overflow-hidden relative h-full max-h-[300px] flex flex-col">
                        <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-3 text-white flex justify-between items-center shrink-0">
                            <h3 className="font-bold flex items-center gap-2 text-sm"><Cake size={16}/> Anniversaires</h3>
                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white font-medium">7 Jours</span>
                        </div>
                        <div className="p-3 bg-pink-50/30 flex-1 overflow-y-auto custom-scrollbar">
                            {upcomingBirthdays.length > 0 ? (
                                <div className="space-y-2">
                                    {upcomingBirthdays.map(client => {
                                        const bDate = new Date(client.dateAnniversaire!);
                                        const isToday = bDate.getDate() === new Date().getDate() && bDate.getMonth() === new Date().getMonth();
                                        
                                        return (
                                            <div key={client.id} className="flex items-center justify-between bg-white p-2 rounded border border-pink-100 shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${isToday ? 'bg-pink-500 animate-pulse' : 'bg-pink-300'}`}>
                                                        {client.nom.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-gray-800 truncate max-w-[100px]">{client.nom}</p>
                                                        <p className="text-[10px] text-pink-500 font-medium">
                                                            {isToday ? 'Aujourd\'hui !' : `Le ${bDate.getDate()} ${bDate.toLocaleString('default', {month: 'short'})}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleWhatsAppBirthday(client)}
                                                    className="text-green-500 hover:text-green-600 p-1.5 hover:bg-green-50 rounded-full transition-colors"
                                                    title="Envoyer Vœux"
                                                >
                                                    <MessageCircle size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-gray-400 flex flex-col items-center justify-center h-full">
                                    <Gift size={24} className="mb-2 opacity-20"/>
                                    <p className="text-xs">Rien cette semaine.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;