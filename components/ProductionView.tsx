
import React, { useState, useMemo } from 'react';
import { Commande, Employe, Client, Article, RoleEmploye, StatutCommande, CompteFinancier, CompanyAssets, ModePaiement } from '../types';
import { Scissors, Clock, CheckCircle, Plus, Search, User, Package, Calendar, AlertTriangle, FileText, ChevronRight } from 'lucide-react';

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
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    
    // Form State
    const [prixBase, setPrixBase] = useState(0);
    const [avance, setAvance] = useState(0);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [description, setDescription] = useState('');
    const [dateLivraison, setDateLivraison] = useState(new Date().toISOString().split('T')[0]);

    const filteredCommandes = commandes.filter(c => 
        c.type === 'SUR_MESURE' && !c.archived &&
        (statusFilter === 'ALL' || c.statut === statusFilter) &&
        (c.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.includes(searchTerm))
    );

    const handleSave = () => {
        if (!selectedClientId || prixBase <= 0) { alert("Client et prix requis."); return; }
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
            quantite: 1
        };

        onCreateOrder(newOrder, []);
        setIsAddModalOpen(false);
        // Reset form
        setPrixBase(0); setAvance(0); setSelectedClientId(''); setDescription('');
    };

    return (
        <div className="flex flex-col space-y-4 h-full">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold flex items-center gap-2"><Scissors className="text-brand-600"/> Atelier & Production</h2>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-2.5 text-gray-400"/>
                        <input type="text" placeholder="Chercher commande..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border rounded-lg text-sm w-64" />
                    </div>
                    <button onClick={() => { setIsEditingOrder(false); setIsAddModalOpen(true); }} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus size={20}/> Nouvelle Commande</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                {filteredCommandes.map(cmd => (
                    <div key={cmd.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-gray-800">{cmd.clientNom}</h3>
                                <p className="text-[10px] font-mono text-gray-400">#{cmd.id.slice(-6)}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${cmd.statut === StatutCommande.PRET ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                {cmd.statut}
                            </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-4 line-clamp-2">{cmd.description}</p>
                        <div className="flex justify-between items-end border-t pt-3">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Livraison Prévue</p>
                                <p className="text-sm font-bold text-gray-700 flex items-center gap-1"><Calendar size={14}/> {new Date(cmd.dateLivraisonPrevue).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Reste à payer</p>
                                <p className={`text-sm font-bold ${cmd.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>{cmd.reste.toLocaleString()} F</p>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <select className="flex-1 p-1 text-xs border rounded" value={cmd.statut} onChange={e => onUpdateStatus(cmd.id, e.target.value as StatutCommande)}>
                                {Object.values(StatutCommande).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Creation */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Nouvelle Commande Sur Mesure</h3>
                            <button onClick={() => setIsAddModalOpen(false)}><ChevronRight className="rotate-90 text-gray-400"/></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium mb-1">Client</label><select className="w-full p-2 border rounded" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}><option value="">-- Choisir Client --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
                            <div><label className="block text-sm font-medium mb-1">Description Modèle</label><textarea className="w-full p-2 border rounded" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Détails du modèle, tissus, etc..."/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Prix TTC</label><input type="number" className="w-full p-2 border rounded font-bold" value={prixBase || ''} placeholder="0" onChange={e => setPrixBase(parseInt(e.target.value) || 0)}/></div>
                                <div><label className="block text-sm font-medium mb-1">Avance</label><input type="number" className="w-full p-2 border rounded font-bold text-green-700" value={avance || ''} placeholder="0" onChange={e => setAvance(parseInt(e.target.value) || 0)}/></div>
                            </div>
                            <div><label className="block text-sm font-medium mb-1">Date Livraison</label><input type="date" className="w-full p-2 border rounded" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}/></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border rounded font-medium">Annuler</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-brand-600 text-white rounded font-bold shadow-md hover:bg-brand-700">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionView;
