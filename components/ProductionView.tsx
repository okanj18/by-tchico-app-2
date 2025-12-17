
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, RoleEmploye, StatutCommande, CompteFinancier, CompanyAssets, ModePaiement } from '../types';
// Added Wallet to the imports from lucide-react
import { Scissors, Clock, CheckCircle, Plus, Search, User, Package, Calendar, AlertTriangle, FileText, ChevronRight, X, Save, Wallet } from 'lucide-react';

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

const ProductionView: React.FC<ProductionViewProps> = ({ 
    commandes, employes, clients, articles, onUpdateStatus, onCreateOrder, onUpdateOrder, onAddPayment, comptes 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatutCommande | 'ALL'>('ALL');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // État du formulaire
    const [prixBase, setPrixBase] = useState(0);
    const [avance, setAvance] = useState(0);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [description, setDescription] = useState('');
    const [dateLivraison, setDateLivraison] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [accountId, setAccountId] = useState('');

    const filteredCommandes = useMemo(() => {
        return commandes.filter(c => 
            c.type === 'SUR_MESURE' && !c.archived &&
            (statusFilter === 'ALL' || c.statut === statusFilter) &&
            (c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.includes(searchTerm))
        );
    }, [commandes, searchTerm, statusFilter]);

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

    return (
        <div className="flex flex-col space-y-4 h-full">
            {/* Barre d'outils */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Scissors className="text-brand-600" size={24}/> Atelier & Production
                </h2>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search size={18} className="absolute left-3 top-2.5 text-gray-400"/>
                        <input 
                            type="text" 
                            placeholder="Chercher client ou commande..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full" 
                        />
                    </div>
                    <select 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="border rounded-lg px-3 py-2 text-sm bg-gray-50 font-medium"
                    >
                        <option value="ALL">Tous les statuts</option>
                        {Object.values(StatutCommande).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button 
                        onClick={() => setIsAddModalOpen(true)} 
                        className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all"
                    >
                        <Plus size={20}/> Nouvelle Commande
                    </button>
                </div>
            </div>

            {/* Grille des commandes */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                {filteredCommandes.map(cmd => (
                    <div key={cmd.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg uppercase">{cmd.clientNom}</h3>
                                <p className="text-[10px] font-mono text-gray-400">REF: #{cmd.id.slice(-6)}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                                cmd.statut === StatutCommande.PRET ? 'bg-green-100 text-green-700 border border-green-200' : 
                                cmd.statut === StatutCommande.LIVRE ? 'bg-gray-100 text-gray-600' :
                                'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                                {cmd.statut}
                            </span>
                        </div>
                        
                        <div className="bg-gray-50 p-3 rounded-lg mb-4 flex-1">
                            <p className="text-xs text-gray-600 italic line-clamp-3">"{cmd.description || 'Pas de description'}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t pt-4">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Livraison Prévue</p>
                                <p className="text-sm font-bold text-gray-700 flex items-center gap-1">
                                    <Calendar size={14} className="text-brand-500"/> {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Reste à payer</p>
                                <p className={`text-sm font-bold ${cmd.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {cmd.reste.toLocaleString()} F
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Mettre à jour le statut :</label>
                            <select 
                                className="w-full p-2 text-xs border rounded-lg bg-white font-bold" 
                                value={cmd.statut} 
                                onChange={e => onUpdateStatus(cmd.id, e.target.value as StatutCommande)}
                            >
                                {Object.values(StatutCommande).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                ))}
                {filteredCommandes.length === 0 && (
                    <div className="col-span-full py-20 text-center text-gray-400 flex flex-col items-center">
                        <Scissors size={48} className="opacity-10 mb-2"/>
                        <p>Aucune commande de production trouvée.</p>
                    </div>
                )}
            </div>

            {/* Modal Création */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-brand-900 text-white p-4 flex justify-between items-center">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Scissors size={20}/> Nouvelle Commande Sur Mesure</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="hover:bg-white/10 p-1 rounded"><X size={24}/></button>
                        </div>
                        
                        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Client</label>
                                <select 
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500" 
                                    value={selectedClientId} 
                                    onChange={e => setSelectedClientId(e.target.value)}
                                >
                                    <option value="">-- Choisir un Client --</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.telephone})</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description du modèle</label>
                                <textarea 
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500" 
                                    rows={3} 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)} 
                                    placeholder="Détails, tissus, broderies, modifications..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Prix TTC</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-3 border border-gray-300 rounded-lg font-bold text-lg focus:ring-2 focus:ring-brand-500" 
                                        value={prixBase || ''} 
                                        placeholder="0" 
                                        onChange={e => setPrixBase(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-green-700 uppercase mb-1">Avance versée</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-3 border border-green-200 bg-green-50 rounded-lg font-bold text-lg text-green-700 focus:ring-2 focus:ring-green-500" 
                                        value={avance || ''} 
                                        placeholder="0" 
                                        onChange={e => setAvance(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>

                            {avance > 0 && (
                                <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 text-orange-800 font-bold text-xs uppercase">
                                        <Wallet size={14}/> Encaissement de l'avance
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <select 
                                            className="w-full p-2 border border-orange-200 rounded text-sm bg-white" 
                                            value={paymentMethod} 
                                            onChange={e => setPaymentMethod(e.target.value as any)}
                                        >
                                            <option value="ESPECE">Espèce</option>
                                            <option value="WAVE">Wave</option>
                                            <option value="ORANGE_MONEY">Orange Money</option>
                                            <option value="VIREMENT">Virement</option>
                                        </select>
                                        <select 
                                            className="w-full p-2 border border-orange-200 rounded text-sm bg-white" 
                                            value={accountId} 
                                            onChange={e => setAccountId(e.target.value)}
                                        >
                                            <option value="">-- Compte --</option>
                                            {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date de livraison souhaitée</label>
                                <input 
                                    type="date" 
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500" 
                                    value={dateLivraison} 
                                    onChange={e => setDateLivraison(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-5 py-2 border rounded-lg font-bold text-gray-600 hover:bg-gray-100">Annuler</button>
                            <button onClick={handleSave} className="px-8 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-lg hover:bg-brand-700 flex items-center gap-2">
                                <Save size={18}/> Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
