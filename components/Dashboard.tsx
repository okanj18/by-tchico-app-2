
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Depense, StatutCommande, Client } from '../types';
import { getAIAnalysis } from '../services/geminiService';
import app from '../services/firebase'; // Import pour vérifier la connexion
import { Sparkles, ArrowRight, Loader, Cake, MessageCircle, Gift, AlertTriangle, CheckCircle, Clock, Scissors, Activity, Shirt, CheckSquare, CloudOff, HelpCircle, X, ExternalLink, Copy, Database } from 'lucide-react';

interface DashboardProps {
    commandes: Commande[];
    employes: Employe[];
    depenses: Depense[];
    clients: Client[];
}

const Dashboard: React.FC<DashboardProps> = ({ commandes, employes, depenses, clients }) => {
    const [aiAdvice, setAiAdvice] = useState<string | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [showSyncHelp, setShowSyncHelp] = useState(false); // Modal state for sync instructions

    // Vérification du mode connecté
    const isOfflineMode = !app;

    const pendingOrders = commandes.filter(c => c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE).length;
    const activeTailors = employes.filter(e => e.actif !== false).length; 
    
    // Production Pipeline Stats
    const productionStats = useMemo(() => {
        return {
            attente: commandes.filter(c => c.statut === StatutCommande.EN_ATTENTE).length,
            coupe: commandes.filter(c => c.statut === StatutCommande.EN_COUPE).length,
            couture: commandes.filter(c => c.statut === StatutCommande.COUTURE).length,
            finition: commandes.filter(c => c.statut === StatutCommande.FINITION).length,
            pret: commandes.filter(c => c.statut === StatutCommande.PRET).length
        };
    }, [commandes]);

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
            statutCommandes: productionStats,
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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert(`Copié : ${text}`);
    };

    return (
        <div className="space-y-6">
            {/* ALERTE MODE HORS LIGNE */}
            {isOfflineMode && (
                <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                <CloudOff className="h-5 w-5 text-orange-500" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-bold text-orange-800">
                                    Mode Local (Non Synchronisé)
                                </h3>
                                <div className="mt-1 text-sm text-orange-700">
                                    <p>
                                        Les données restent sur <strong>CET appareil uniquement</strong>. Pour synchroniser PC et Mobile, connectez la base de données.
                                    </p>
                                    <button 
                                        onClick={() => setShowSyncHelp(true)}
                                        className="mt-2 inline-flex items-center gap-1 font-bold text-orange-900 bg-orange-100 px-3 py-1.5 rounded hover:bg-orange-200 transition-colors text-xs"
                                    >
                                        <HelpCircle size={14} /> Comment activer la synchronisation ?
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SYNC HELP MODAL */}
            {showSyncHelp && (
                <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in duration-200">
                        <div className="bg-brand-900 text-white p-4 flex justify-between items-center rounded-t-xl shrink-0">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Database size={20} /> Configuration Cloud (Firebase)
                            </h2>
                            <button onClick={() => setShowSyncHelp(false)}><X size={24} className="hover:text-brand-200"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800">
                                <p className="font-bold mb-1 flex items-center gap-2"><AlertTriangle size={16}/> Important : Sauvegardez vos données !</p>
                                <p>Avant de connecter le Cloud, allez dans <strong>Paramètres &gt; Sauvegarder les données</strong>. Une fois connecté, les données locales seront remplacées par celles du Cloud (qui seront vides au début). Vous pourrez alors utiliser <strong>Importer</strong> pour remettre vos données.</p>
                            </div>

                            <ol className="list-decimal pl-5 space-y-4 text-sm text-gray-700">
                                <li>
                                    <strong>Créez un projet Firebase :</strong><br/>
                                    Allez sur <a href="https://console.firebase.google.com" target="_blank" className="text-blue-600 underline font-bold inline-flex items-center gap-1">console.firebase.google.com <ExternalLink size={12}/></a>, créez un projet, puis ajoutez une "Web App" (icône <code>&lt;/&gt;</code>).
                                </li>
                                <li>
                                    <strong>Activez Firestore Database :</strong><br/>
                                    Dans le menu Firebase "Créer", choisissez "Firestore Database", faites "Créer une base de données", choisissez le mode de production et une région.
                                </li>
                                <li>
                                    <strong>Copiez les clés de configuration :</strong><br/>
                                    Dans les paramètres de votre projet Firebase (roue dentée), récupérez les valeurs de configuration SDK.
                                </li>
                                <li>
                                    <strong>Ajoutez les variables dans Vercel :</strong><br/>
                                    Allez sur votre projet Vercel &gt; Settings &gt; Environment Variables. Ajoutez les clés suivantes (copiez-les ci-dessous) :
                                </li>
                            </ol>

                            <div className="bg-gray-100 p-4 rounded-lg space-y-2 font-mono text-xs">
                                <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                                    <span className="text-gray-600 select-all">VITE_FIREBASE_API_KEY</span>
                                    <button onClick={() => copyToClipboard('VITE_FIREBASE_API_KEY')} className="text-brand-600 hover:bg-brand-50 p-1 rounded"><Copy size={14}/></button>
                                </div>
                                <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                                    <span className="text-gray-600 select-all">VITE_FIREBASE_AUTH_DOMAIN</span>
                                    <button onClick={() => copyToClipboard('VITE_FIREBASE_AUTH_DOMAIN')} className="text-brand-600 hover:bg-brand-50 p-1 rounded"><Copy size={14}/></button>
                                </div>
                                <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                                    <span className="text-gray-600 select-all">VITE_FIREBASE_PROJECT_ID</span>
                                    <button onClick={() => copyToClipboard('VITE_FIREBASE_PROJECT_ID')} className="text-brand-600 hover:bg-brand-50 p-1 rounded"><Copy size={14}/></button>
                                </div>
                            </div>

                            <p className="text-sm text-gray-600">
                                Une fois ajouté, allez dans <strong>Deployments</strong> sur Vercel et faites <strong>Redeploy</strong>.
                            </p>
                        </div>

                        <div className="p-4 border-t bg-gray-50 flex justify-end rounded-b-xl">
                            <button onClick={() => setShowSyncHelp(false)} className="px-4 py-2 bg-gray-800 text-white rounded font-bold hover:bg-gray-900">J'ai compris</button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* PRODUCTION PIPELINE (NEW) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-brand-600"/> 
                    Flux de l'Atelier
                </h3>
                <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="flex flex-col items-center p-2 rounded-lg bg-gray-50 border border-gray-100">
                        <span className="text-xs text-gray-500 uppercase font-bold mb-1">Attente</span>
                        <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold mb-1">{productionStats.attente}</div>
                        <span className="text-[10px] text-gray-400">Commandes</span>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center">
                        <ArrowRight className="text-gray-300" size={20} />
                    </div>

                    <div className="flex flex-col items-center p-2 rounded-lg bg-blue-50 border border-blue-100">
                        <span className="text-xs text-blue-600 uppercase font-bold mb-1">Coupe</span>
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-1">
                            <Scissors size={16} className="mr-1"/> {productionStats.coupe}
                        </div>
                        <span className="text-[10px] text-blue-400">En cours</span>
                    </div>

                    <div className="flex flex-col items-center justify-center">
                        <ArrowRight className="text-gray-300" size={20} />
                    </div>

                    <div className="flex flex-col items-center p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                        <span className="text-xs text-indigo-600 uppercase font-bold mb-1">Couture</span>
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-1">
                            <Shirt size={16} className="mr-1"/> {productionStats.couture}
                        </div>
                        <span className="text-[10px] text-indigo-400">Montage</span>
                    </div>

                    <div className="flex flex-col items-center justify-center">
                        <ArrowRight className="text-gray-300" size={20} />
                    </div>

                    <div className="flex flex-col items-center p-2 rounded-lg bg-purple-50 border border-purple-100">
                        <span className="text-xs text-purple-600 uppercase font-bold mb-1">Finition</span>
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-1">
                            {productionStats.finition}
                        </div>
                        <span className="text-[10px] text-purple-400">Repassage</span>
                    </div>

                    <div className="flex flex-col items-center justify-center">
                        <ArrowRight className="text-gray-300" size={20} />
                    </div>

                    <div className="flex flex-col items-center p-2 rounded-lg bg-green-50 border border-green-100">
                        <span className="text-xs text-green-600 uppercase font-bold mb-1">Prêt</span>
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold mb-1">
                            <CheckSquare size={16} className="mr-1"/> {productionStats.pret}
                        </div>
                        <span className="text-[10px] text-green-400">À Livrer</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Stats Column */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Quick Stats Grid - Compact Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-brand-200 transition-colors flex flex-col justify-between h-24">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Commandes Actives</p>
                            <p className="text-2xl font-bold text-gray-800">{pendingOrders}</p>
                            <div className="text-[10px] text-orange-500 font-medium">Atelier Chargé à {Math.min(100, Math.round((pendingOrders / (activeTailors * 5)) * 100))}%</div>
                        </div>
                        
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-brand-200 transition-colors flex flex-col justify-between h-24">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Effectif Présent</p>
                            <p className="text-2xl font-bold text-gray-800">{activeTailors}</p>
                            <div className="text-[10px] text-green-500 font-medium">Tailleurs & Vendeurs</div>
                        </div>

                        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-brand-200 transition-colors flex flex-col justify-between h-24">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sorties Caisse (Mois)</p>
                            <p className="text-2xl font-bold text-gray-800">
                                {(depenses.reduce((acc, d) => acc + d.montant, 0) / 1000).toFixed(0)}k
                            </p>
                            <div className="text-[10px] text-red-500 font-medium">FCFA Dépensés</div>
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
