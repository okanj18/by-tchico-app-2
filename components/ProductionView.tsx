
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, RoleEmploye, StatutCommande, CompteFinancier, CompanyAssets, ModePaiement } from '../types';
// Added XCircle to the imports from lucide-react
import { Scissors, Clock, CheckCircle, Plus, Search, User, Package, Calendar, AlertTriangle, FileText, ChevronRight, X, Save, Wallet, List, LayoutGrid, History, Filter, UserPlus, XCircle } from 'lucide-react';

interface ProductionViewProps {
    commandes: Commande[];
    employes: Employe[];
    clients: Client[];
    articles: Article[];
    userRole: RoleEmploye;
    onUpdateStatus: (id: string, status: StatutCommande) => void;
    onCreateOrder: (order: Commande, consommations: any[], paymentMethod?: ModePaiement, accountId?: string) => void;
    onUpdateOrder: (order: Commande, accountId?: string, paymentMethod?: ModePaiement) => void;
    onAddPayment: (orderId: string, amount: number, method: ModePaiement, note: string, date: string, accountId?: string) => void;
    onArchiveOrder: (id: string) => void;
    comptes: CompteFinancier[];
    companyAssets: CompanyAssets;
}

type TabProduction = 'DASHBOARD' | 'AGENDA' | 'HISTORIQUE';

const ProductionView: React.FC<ProductionViewProps> = ({ 
    commandes, employes, clients, articles, onUpdateStatus, onCreateOrder, onUpdateOrder, onAddPayment, onArchiveOrder, comptes 
}) => {
    // Navigation & Filtres
    const [activeTab, setActiveTab] = useState<TabProduction>('DASHBOARD');
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatutCommande | 'ALL'>('ALL');
    
    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Commande | null>(null);
    
    // État du formulaire de création
    const [prixBase, setPrixBase] = useState(0);
    const [avance, setAvance] = useState(0);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [description, setDescription] = useState('');
    const [dateLivraison, setDateLivraison] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [accountId, setAccountId] = useState('');

    // --- LOGIQUE FILTRAGE ---
    const filteredOrders = useMemo(() => {
        return commandes.filter(c => {
            const isCustom = c.type === 'SUR_MESURE';
            const matchesSearch = c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.includes(searchTerm);
            const matchesStatus = statusFilter === 'ALL' || c.statut === statusFilter;
            
            if (activeTab === 'HISTORIQUE') {
                return isCustom && (c.archived || c.statut === StatutCommande.LIVRE || c.statut === StatutCommande.ANNULE) && matchesSearch;
            }
            
            // Pour Dashboard et Agenda, on ne montre que l'actif
            return isCustom && !c.archived && c.statut !== StatutCommande.LIVRE && c.statut !== StatutCommande.ANNULE && matchesSearch && matchesStatus;
        });
    }, [commandes, searchTerm, statusFilter, activeTab]);

    const ordersByDate = useMemo(() => {
        const groups: Record<string, Commande[]> = {};
        filteredOrders.forEach(o => {
            const date = o.dateLivraisonPrevue;
            if (!groups[date]) groups[date] = [];
            groups[date].push(o);
        });
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredOrders]);

    // --- ACTIONS ---
    const handleSave = () => {
        if (!selectedClientId || prixBase <= 0) { 
            alert("Veuillez sélectionner un client et saisir un prix."); 
            return; 
        }
        if (avance > 0 && !accountId) {
            alert("Veuillez sélectionner un compte d'encaissement pour l'avance.");
            return;
        }

        const client = clients.find(cl => cl.id === selectedClientId);
        const newOrder: Commande = {
            id: `CMD_PROD_${Date.now()}`,
            clientId: selectedClientId,
            clientNom: client?.nom || 'Inconnu',
            description,
            dateCommande: new Date().toISOString(),
            dateLivraisonPrevue: dateLivraison,
            statut: StatutCommande.EN_ATTENTE,
            tailleursIds: [],
            prixTotal: prixBase,
            avance: avance,
            reste: prixBase - avance,
            type: 'SUR_MESURE',
            quantite: 1,
            paiements: avance > 0 ? [{
                id: `PAY_${Date.now()}`,
                date: new Date().toISOString(),
                montant: avance,
                moyenPaiement: paymentMethod,
                note: 'Avance à la commande'
            }] : []
        };

        onCreateOrder(newOrder, [], paymentMethod, accountId);
        setIsAddModalOpen(false);
        // Reset
        setPrixBase(0); setAvance(0); setSelectedClientId(''); setDescription(''); setAccountId('');
    };

    const toggleTailor = (order: Commande, tailorId: string) => {
        const isAssigned = order.tailleursIds.includes(tailorId);
        const newIds = isAssigned 
            ? order.tailleursIds.filter(id => id !== tailorId)
            : [...order.tailleursIds, tailorId];
        
        onUpdateOrder({ ...order, tailleursIds: newIds });
        if (selectedOrderDetails?.id === order.id) {
            setSelectedOrderDetails({ ...order, tailleursIds: newIds });
        }
    };

    return (
        <div className="flex flex-col space-y-4 h-full">
            {/* --- BARRE DE NAVIGATION ET OUTILS --- */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-brand-900 flex items-center gap-2">
                            <Scissors className="text-brand-600" size={24}/> ATELIER
                        </h2>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setActiveTab('DASHBOARD')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'DASHBOARD' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <LayoutGrid size={14}/> Tableau
                            </button>
                            <button onClick={() => setActiveTab('AGENDA')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'AGENDA' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <Clock size={14}/> Agenda
                            </button>
                            <button onClick={() => setActiveTab('HISTORIQUE')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'HISTORIQUE' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <History size={14}/> Archive
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-64">
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                            <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors" />
                        </div>
                        {activeTab === 'DASHBOARD' && (
                            <div className="flex bg-gray-50 border rounded-lg p-1">
                                <button onClick={() => setViewMode('GRID')} className={`p-1.5 rounded ${viewMode === 'GRID' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-400'}`}><LayoutGrid size={16}/></button>
                                <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded ${viewMode === 'LIST' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-400'}`}><List size={16}/></button>
                            </div>
                        )}
                        <button onClick={() => setIsAddModalOpen(true)} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95">
                            <Plus size={20}/> Nouvelle Commande
                        </button>
                    </div>
                </div>
            </div>

            {/* --- CONTENU PRINCIPAL --- */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {activeTab === 'DASHBOARD' && (
                    viewMode === 'GRID' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                            {filteredOrders.map(cmd => (
                                <div key={cmd.id} onClick={() => setSelectedOrderDetails(cmd)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group flex flex-col h-full border-b-4 border-b-transparent hover:border-b-brand-500">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-black text-gray-900 text-lg uppercase tracking-tighter">{cmd.clientNom}</h3>
                                            <p className="text-[10px] font-mono text-gray-400">REF: #{cmd.id.slice(-6)}</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                                            cmd.statut === StatutCommande.PRET ? 'bg-green-50 text-green-700 border-green-200' : 
                                            cmd.statut === StatutCommande.EN_COUPE ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            'bg-orange-50 text-orange-700 border-orange-200'
                                        }`}>
                                            {cmd.statut}
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-50/50 p-3 rounded-xl mb-4 flex-1">
                                        <p className="text-xs text-gray-600 italic line-clamp-3">"{cmd.description || 'Pas de description'}"</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Livraison</p>
                                            <p className="text-sm font-bold text-gray-700 flex items-center gap-1">
                                                <Calendar size={14} className="text-brand-500"/> {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Reste à payer</p>
                                            <p className={`text-sm font-black ${cmd.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {cmd.reste.toLocaleString()} F
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="flex -space-x-2">
                                            {cmd.tailleursIds.slice(0, 3).map(id => (
                                                <div key={id} className="w-7 h-7 rounded-full bg-brand-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-brand-700 uppercase" title={employes.find(e => e.id === id)?.nom}>
                                                    {employes.find(e => e.id === id)?.nom.charAt(0)}
                                                </div>
                                            ))}
                                            {cmd.tailleursIds.length > 3 && (
                                                <div className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                    +{cmd.tailleursIds.length - 3}
                                                </div>
                                            )}
                                            {cmd.tailleursIds.length === 0 && <span className="text-[10px] text-gray-400 font-bold uppercase py-1">⚠️ Aucun tailleur</span>}
                                        </div>
                                        <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all"/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-black uppercase text-[10px] border-b">
                                    <tr>
                                        <th className="py-4 px-6">Client</th>
                                        <th className="py-4 px-6">Description</th>
                                        <th className="py-4 px-6 text-center">Statut</th>
                                        <th className="py-4 px-6">Livraison</th>
                                        <th className="py-4 px-6 text-right">Reste</th>
                                        <th className="py-4 px-6 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredOrders.map(cmd => (
                                        <tr key={cmd.id} className="hover:bg-brand-50/30 transition-colors cursor-pointer" onClick={() => setSelectedOrderDetails(cmd)}>
                                            <td className="py-4 px-6 font-bold text-gray-900">{cmd.clientNom}</td>
                                            <td className="py-4 px-6 text-gray-500 truncate max-w-xs">{cmd.description}</td>
                                            <td className="py-4 px-6 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${cmd.statut === StatutCommande.PRET ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {cmd.statut}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 font-medium text-gray-600">{new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</td>
                                            <td className={`py-4 px-6 text-right font-black ${cmd.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>{cmd.reste.toLocaleString()} F</td>
                                            <td className="py-4 px-6 text-center">
                                                <button className="p-2 text-gray-400 hover:text-brand-600"><Eye size={18}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}

                {activeTab === 'AGENDA' && (
                    <div className="space-y-6 pb-10">
                        {ordersByDate.map(([date, items]) => (
                            <div key={date} className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="px-4 py-1.5 bg-brand-900 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-sm">
                                        {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </div>
                                    <div className="flex-1 h-[1px] bg-gray-200"></div>
                                    <span className="text-xs font-bold text-gray-400 uppercase">{items.length} Commande(s)</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {items.map(cmd => (
                                        <div key={cmd.id} onClick={() => setSelectedOrderDetails(cmd)} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-brand-300 cursor-pointer transition-all flex flex-col justify-between group">
                                            <div>
                                                <h4 className="font-bold text-gray-900 uppercase text-xs truncate">{cmd.clientNom}</h4>
                                                <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{cmd.description}</p>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-dashed flex justify-between items-center">
                                                <span className={`text-[10px] font-black uppercase ${cmd.statut === StatutCommande.PRET ? 'text-green-600' : 'text-brand-600'}`}>{cmd.statut}</span>
                                                <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500"/>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {ordersByDate.length === 0 && (
                            <div className="py-20 text-center text-gray-400 italic">Aucune commande de production prévue prochainement.</div>
                        )}
                    </div>
                )}

                {activeTab === 'HISTORIQUE' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] border-b">
                                <tr>
                                    <th className="py-4 px-6">Client</th>
                                    <th className="py-4 px-6">Modèle</th>
                                    <th className="py-4 px-6">Date Livré</th>
                                    <th className="py-4 px-6 text-right">Montant Total</th>
                                    <th className="py-4 px-6 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredOrders.map(cmd => (
                                    <tr key={cmd.id} className="hover:bg-gray-50">
                                        <td className="py-4 px-6 font-bold">{cmd.clientNom}</td>
                                        <td className="py-4 px-6 text-gray-500">{cmd.description}</td>
                                        <td className="py-4 px-6">{new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</td>
                                        <td className="py-4 px-6 text-right font-black">{cmd.prixTotal.toLocaleString()} F</td>
                                        <td className="py-4 px-6 text-center">
                                            <button onClick={() => setSelectedOrderDetails(cmd)} className="text-brand-600 font-bold hover:underline text-xs">Voir</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- MODAL CREATION --- */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-brand-900 text-white p-5 flex justify-between items-center">
                            <h3 className="text-xl font-black flex items-center gap-2 uppercase tracking-tighter"><Plus size={24}/> Créer une Commande</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full"><X size={24}/></button>
                        </div>
                        
                        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Client</label>
                                <select className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 bg-gray-50 font-bold" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
                                    <option value="">-- Sélectionner le client --</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.telephone})</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Description Modèle / Détails</label>
                                <textarea className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Tissu, mesures spécifiques, broderies..."/>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Prix TTC (FCFA)</label>
                                    <input type="number" className="w-full p-3 border border-gray-300 rounded-xl font-black text-lg focus:ring-2 focus:ring-brand-500 text-center" value={prixBase || ''} placeholder="0" onChange={e => setPrixBase(parseInt(e.target.value) || 0)}/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-green-700 uppercase mb-1">Avance Déposée</label>
                                    <input type="number" className="w-full p-3 border border-green-200 bg-green-50 rounded-xl font-black text-lg text-green-700 focus:ring-2 focus:ring-green-500 text-center" value={avance || ''} placeholder="0" onChange={e => setAvance(parseInt(e.target.value) || 0)}/>
                                </div>
                            </div>

                            {avance > 0 && (
                                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 text-orange-800 font-bold text-[10px] uppercase">
                                        <Wallet size={14}/> Encaissement Immédiat
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <select className="w-full p-2 border border-orange-200 rounded-lg text-xs bg-white font-bold" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
                                            <option value="ESPECE">ESPECE</option>
                                            <option value="WAVE">WAVE</option>
                                            <option value="ORANGE_MONEY">ORANGE MONEY</option>
                                        </select>
                                        <select className="w-full p-2 border border-orange-200 rounded-lg text-xs bg-white font-bold" value={accountId} onChange={e => setAccountId(e.target.value)}>
                                            <option value="">-- Caisse --</option>
                                            {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Date de livraison prévue</label>
                                <input type="date" className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 font-bold" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}/>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 border rounded-xl font-black text-gray-600 hover:bg-gray-100 uppercase text-xs">Annuler</button>
                            <button onClick={handleSave} className="flex-[2] py-3 bg-brand-600 text-white rounded-xl font-black shadow-lg hover:bg-brand-700 flex items-center justify-center gap-2 uppercase text-xs tracking-widest">
                                <Save size={18}/> Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DETAILS ET ACTIONS --- */}
            {selectedOrderDetails && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                        <div className="bg-gray-900 text-white p-5 flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-lg uppercase tracking-tight">{selectedOrderDetails.clientNom}</h3>
                                <p className="text-[10px] text-gray-400 font-mono">ID: {selectedOrderDetails.id}</p>
                            </div>
                            <button onClick={() => setSelectedOrderDetails(null)} className="hover:bg-white/10 p-1 rounded-full"><X size={24}/></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-8">
                            {/* Recap & Statut */}
                            <div className="flex flex-col md:flex-row justify-between gap-6 border-b pb-6">
                                <div className="space-y-4 flex-1">
                                    <div>
                                        <span className="block text-[10px] font-black text-gray-400 uppercase mb-1">Détail du modèle</span>
                                        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            "{selectedOrderDetails.description || 'Pas de description fournie.'}"
                                        </p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <span className="block text-[10px] font-black text-gray-400 uppercase mb-1">Livraison</span>
                                            <div className="flex items-center gap-2 text-brand-700 font-black"><Calendar size={16}/> {new Date(selectedOrderDetails.dateLivraisonPrevue).toLocaleDateString()}</div>
                                        </div>
                                        <div className="flex-1">
                                            <span className="block text-[10px] font-black text-gray-400 uppercase mb-1">Statut Atelier</span>
                                            <select className="w-full p-2 border rounded-lg text-xs font-black bg-brand-50 border-brand-200" value={selectedOrderDetails.statut} onChange={e => onUpdateStatus(selectedOrderDetails.id, e.target.value as StatutCommande)}>
                                                {Object.values(StatutCommande).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full md:w-56 bg-gray-900 text-white p-6 rounded-3xl space-y-4 shadow-inner">
                                    <div className="text-center">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Total Commande</p>
                                        <p className="text-2xl font-black">{selectedOrderDetails.prixTotal.toLocaleString()} F</p>
                                    </div>
                                    <div className="border-t border-white/10 pt-4 space-y-2">
                                        <div className="flex justify-between text-xs"><span className="text-gray-400">Payé</span><span className="font-bold text-green-400">-{selectedOrderDetails.avance.toLocaleString()} F</span></div>
                                        <div className="flex justify-between text-sm pt-2 border-t border-white/10"><span className="font-black text-brand-300">RESTE</span><span className="font-black text-xl text-red-500">{selectedOrderDetails.reste.toLocaleString()} F</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Assignation Tailleurs */}
                            <div className="space-y-4">
                                <h4 className="font-black text-xs text-gray-500 uppercase flex items-center gap-2"><UserPlus size={16} className="text-brand-500"/> Assignation des Tailleurs</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {employes.filter(e => (e.role === RoleEmploye.TAILLEUR || e.role === RoleEmploye.CHEF_ATELIER) && e.actif !== false).map(tailor => {
                                        const isActive = selectedOrderDetails.tailleursIds.includes(tailor.id);
                                        return (
                                            <button key={tailor.id} onClick={() => toggleTailor(selectedOrderDetails, tailor.id)} className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${isActive ? 'bg-brand-600 border-brand-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-white/20' : 'bg-gray-100'}`}>{tailor.nom.charAt(0)}</div>
                                                <span className="text-xs font-bold truncate">{tailor.nom}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Historique Paiements */}
                            <div className="space-y-4">
                                <h4 className="font-black text-xs text-gray-500 uppercase flex items-center gap-2"><Wallet size={16} className="text-green-500"/> Règlements de cette commande</h4>
                                <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 space-y-2">
                                    {selectedOrderDetails.paiements?.map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-gray-100">
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(p.date).toLocaleDateString()}</p>
                                                <p className="text-xs font-bold text-gray-700">{p.note || 'Paiement'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-green-600">+{p.montant.toLocaleString()} F</p>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase">{p.moyenPaiement}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedOrderDetails.paiements || selectedOrderDetails.paiements.length === 0) && <p className="text-center py-4 text-xs text-gray-400 italic">Aucun paiement enregistré.</p>}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                            <div className="flex gap-2">
                                {!selectedOrderDetails.archived && (selectedOrderDetails.statut === StatutCommande.LIVRE || selectedOrderDetails.statut === StatutCommande.ANNULE) && (
                                    <button onClick={() => { onArchiveOrder(selectedOrderDetails.id); setSelectedOrderDetails(null); }} className="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"><Archive size={14}/> Archiver</button>
                                )}
                            </div>
                            <button onClick={() => setSelectedOrderDetails(null)} className="px-8 py-2 bg-white border border-gray-300 rounded-xl font-black text-gray-700 uppercase text-xs tracking-widest hover:bg-gray-100">Fermer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Icônes manquantes
const Eye = ({ size }: { size: number }) => <FileText size={size}/>;
const Archive = ({ size }: { size: number }) => <XCircle size={size}/>;

export default ProductionView;
