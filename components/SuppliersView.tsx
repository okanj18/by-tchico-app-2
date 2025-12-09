
import React, { useState, useMemo } from 'react';
import { Fournisseur, CommandeFournisseur, CompteFinancier, StatutCommandeFournisseur } from '../types';
import { Plus, Search, Truck, Edit2, Phone, MapPin, ShoppingCart, DollarSign, X, Save, History } from 'lucide-react';

interface SuppliersViewProps {
    fournisseurs: Fournisseur[];
    commandesFournisseurs: CommandeFournisseur[];
    onAddFournisseur: (f: Fournisseur) => void;
    onUpdateFournisseur: (f: Fournisseur) => void;
    onAddPayment: (orderId: string, amount: number, date: string, accountId?: string) => void;
    comptes: CompteFinancier[];
}

const SuppliersView: React.FC<SuppliersViewProps> = ({ 
    fournisseurs, 
    commandesFournisseurs, 
    onAddFournisseur, 
    onUpdateFournisseur, 
    onAddPayment,
    comptes 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<Fournisseur | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    // Form Data
    const [formData, setFormData] = useState<Partial<Fournisseur>>({
        nomEntreprise: '',
        contactPersonne: '',
        telephone: '',
        adresse: '',
        categories: [],
        delaiLivraisonMoyen: 0,
        notes: ''
    });
    const [categoryInput, setCategoryInput] = useState('');

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<CommandeFournisseur | null>(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentAccountId, setPaymentAccountId] = useState<string>('');

    // History Modal State
    const [historyOrder, setHistoryOrder] = useState<CommandeFournisseur | null>(null);

    // Derived Data
    const filteredSuppliers = fournisseurs.filter(f => 
        f.nomEntreprise.toLowerCase().includes(searchTerm.toLowerCase()) || 
        f.categories.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const supplierOrders = useMemo(() => {
        if (!selectedSupplier) return [];
        return commandesFournisseurs.filter(c => c.fournisseurId === selectedSupplier.id).sort((a,b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [selectedSupplier, commandesFournisseurs]);

    const supplierStats = useMemo(() => {
        if (!selectedSupplier) return null;
        const orders = commandesFournisseurs.filter(c => c.fournisseurId === selectedSupplier.id);
        const totalOrders = orders.length;
        const totalSpent = orders.reduce((acc, o) => acc + o.montantTotal, 0);
        const totalDebt = orders.reduce((acc, o) => acc + (o.montantTotal - o.montantPaye), 0);
        return { totalOrders, totalSpent, totalDebt };
    }, [selectedSupplier, commandesFournisseurs]);

    // Actions
    const handleOpenAdd = () => {
        setFormData({
            nomEntreprise: '',
            contactPersonne: '',
            telephone: '',
            adresse: '',
            categories: [],
            delaiLivraisonMoyen: 0,
            notes: ''
        });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (f: Fournisseur) => {
        setFormData({ ...f });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!formData.nomEntreprise) return;
        
        if (isEditing && selectedSupplier) {
            onUpdateFournisseur({ ...selectedSupplier, ...formData as Fournisseur });
            setSelectedSupplier({ ...selectedSupplier, ...formData as Fournisseur });
        } else {
            const newF: Fournisseur = {
                id: `F${Date.now()}`,
                ...formData as Fournisseur,
                categories: formData.categories || []
            };
            onAddFournisseur(newF);
        }
        setIsModalOpen(false);
    };

    const handleAddCategory = () => {
        if (categoryInput && !formData.categories?.includes(categoryInput)) {
            setFormData(prev => ({ ...prev, categories: [...(prev.categories || []), categoryInput] }));
            setCategoryInput('');
        }
    };

    const handleRemoveCategory = (cat: string) => {
        setFormData(prev => ({ ...prev, categories: prev.categories?.filter(c => c !== cat) }));
    };

    const openPaymentModal = (order: CommandeFournisseur) => {
        setSelectedOrderForPayment(order);
        setPaymentAmount(order.montantTotal - order.montantPaye);
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentAccountId('');
        setIsPaymentModalOpen(true);
    };

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || paymentAmount <= 0) return;
        
        // --- BLOCAGE SÉCURITÉ ---
        if (!paymentAccountId) {
            alert("Veuillez sélectionner un compte de paiement (source du règlement).");
            return;
        }

        const selectedAccount = comptes.find(c => c.id === paymentAccountId);
        if (selectedAccount && selectedAccount.solde < paymentAmount) {
            alert(`🚫 SOLDE INSUFFISANT !\n\nLe compte "${selectedAccount.nom}" n'a que ${selectedAccount.solde.toLocaleString()} F.\nImpossible de payer ${paymentAmount.toLocaleString()} F.`);
            return;
        }
        // ------------------------

        onAddPayment(selectedOrderForPayment.id, paymentAmount, paymentDate, paymentAccountId);
        setIsPaymentModalOpen(false);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
            {/* LISTE FOURNISSEURS */}
            <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700">Fournisseurs</h3>
                    <button onClick={handleOpenAdd} className="p-2 bg-brand-600 text-white rounded-full hover:bg-brand-700 shadow-sm"><Plus size={18}/></button>
                </div>
                <div className="p-4 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Rechercher..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredSuppliers.map(f => (
                        <div 
                            key={f.id} 
                            onClick={() => setSelectedSupplier(f)}
                            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-brand-50 transition-colors ${selectedSupplier?.id === f.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''}`}
                        >
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-gray-800">{f.nomEntreprise}</h4>
                                {f.categories && f.categories.length > 0 && (
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{f.categories[0]}</span>
                                )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1 flex items-center gap-1"><Truck size={12}/> {f.contactPersonne}</p>
                            <p className="text-xs text-gray-400 mt-1">{f.telephone}</p>
                        </div>
                    ))}
                    {filteredSuppliers.length === 0 && (
                        <div className="p-8 text-center text-gray-400">Aucun fournisseur trouvé.</div>
                    )}
                </div>
            </div>

            {/* DETAILS & HISTORIQUE */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                {selectedSupplier ? (
                    <div className="flex flex-col h-full">
                        {/* Header Details */}
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">{selectedSupplier.nomEntreprise}</h2>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {selectedSupplier.categories.map(c => (
                                            <span key={c} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">{c}</span>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={() => handleOpenEdit(selectedSupplier)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors">
                                    <Edit2 size={14}/> Modifier
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-6">
                                <div className="flex items-center gap-2"><Phone size={16} className="text-gray-400"/> {selectedSupplier.telephone}</div>
                                <div className="flex items-center gap-2"><MapPin size={16} className="text-gray-400"/> {selectedSupplier.adresse}</div>
                                <div className="flex items-center gap-2"><Truck size={16} className="text-gray-400"/> Délai: {selectedSupplier.delaiLivraisonMoyen} jours</div>
                            </div>

                            {/* Stats */}
                            {supplierStats && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <span className="text-xs text-gray-500 uppercase font-bold">Total Commandes</span>
                                        <p className="text-xl font-bold text-gray-800">{supplierStats.totalOrders}</p>
                                    </div>
                                    <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                        <span className="text-xs text-green-700 uppercase font-bold">Total Acheté</span>
                                        <p className="text-xl font-bold text-green-800">{supplierStats.totalSpent.toLocaleString()} F</p>
                                    </div>
                                    <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                        <span className="text-xs text-red-700 uppercase font-bold">Dette Actuelle</span>
                                        <p className="text-xl font-bold text-red-800">{supplierStats.totalDebt.toLocaleString()} F</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Order History */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><ShoppingCart size={18}/> Historique Commandes</h3>
                            <div className="space-y-3">
                                {supplierOrders.map(order => {
                                    const isPaid = order.montantPaye >= order.montantTotal;
                                    return (
                                        <div key={order.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="font-mono text-xs text-gray-500">#{order.id}</span>
                                                    <p className="font-bold text-sm">{new Date(order.dateCommande).toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${order.statut === StatutCommandeFournisseur.LIVRE ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                        {order.statut}
                                                    </span>
                                                    <span className={`text-xs font-bold ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                                                        {isPaid ? 'Payé' : `Reste: ${(order.montantTotal - order.montantPaye).toLocaleString()} F`}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-end mt-2">
                                                <div className="text-xs text-gray-600">
                                                    {order.lignes.length} articles • Total: {order.montantTotal.toLocaleString()} F
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setHistoryOrder(order)} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 flex items-center gap-1" title="Voir les règlements">
                                                        <History size={12}/> Historique
                                                    </button>
                                                    {!isPaid && (
                                                        <button onClick={() => openPaymentModal(order)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1">
                                                            <DollarSign size={12}/> Payer
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {supplierOrders.length === 0 && (
                                    <p className="text-center text-gray-400 italic py-4">Aucune commande pour ce fournisseur.</p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <Truck size={64} className="mb-4 opacity-20"/>
                        <p>Sélectionnez un fournisseur pour voir les détails.</p>
                    </div>
                )}
            </div>

            {/* Modal Add/Edit Supplier */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">{isEditing ? 'Modifier Fournisseur' : 'Nouveau Fournisseur'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-gray-500 hover:text-gray-700"/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom Entreprise</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={formData.nomEntreprise} onChange={e => setFormData({...formData, nomEntreprise: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded" value={formData.contactPersonne} onChange={e => setFormData({...formData, contactPersonne: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={formData.adresse} onChange={e => setFormData({...formData, adresse: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Catégories</label>
                                <div className="flex gap-2 mb-2">
                                    <input type="text" className="flex-1 p-2 border border-gray-300 rounded text-sm" placeholder="Ajouter une catégorie..." value={categoryInput} onChange={e => setCategoryInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddCategory()} />
                                    <button onClick={handleAddCategory} className="bg-brand-600 text-white px-3 rounded"><Plus size={16}/></button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.categories?.map(cat => (
                                        <span key={cat} className="bg-gray-100 px-2 py-1 rounded text-xs flex items-center gap-1">
                                            {cat} <button onClick={() => handleRemoveCategory(cat)}><X size={10}/></button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Délai Livraison (Jours)</label>
                                    <input type="number" className="w-full p-2 border border-gray-300 rounded" value={formData.delaiLivraisonMoyen} onChange={e => setFormData({...formData, delaiLivraisonMoyen: parseInt(e.target.value) || 0})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea className="w-full p-2 border border-gray-300 rounded" rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 flex items-center gap-2"><Save size={18}/> Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Paiement */}
            {isPaymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                            <DollarSign className="text-green-600" /> Règlement Fournisseur
                        </h3>
                        
                        <div className="mb-4">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-500">Total Commande</span>
                                <span className="font-bold">{selectedOrderForPayment.montantTotal.toLocaleString()} F</span>
                            </div>
                            <div className="flex justify-between text-sm mb-4">
                                <span className="text-gray-500">Déjà Payé</span>
                                <span className="font-bold text-green-600">{selectedOrderForPayment.montantPaye.toLocaleString()} F</span>
                            </div>
                            
                            <label className="block text-sm font-medium text-gray-700 mb-1">Montant du Paiement</label>
                            <input 
                                type="number" 
                                className="w-full p-3 border border-gray-300 rounded font-bold text-lg text-brand-700"
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="mb-4">
                             <label className="block text-sm font-medium text-gray-700 mb-1">Date Paiement</label>
                             <input 
                                type="date"
                                className="w-full p-2 border border-gray-300 rounded"
                                value={paymentDate}
                                onChange={e => setPaymentDate(e.target.value)}
                            />
                        </div>

                        {/* SELECTEUR DE COMPTE POUR REGLEMENT */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Compte de paiement</label>
                            <select 
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                value={paymentAccountId}
                                onChange={(e) => setPaymentAccountId(e.target.value)}
                            >
                                <option value="">-- Choisir Compte --</option>
                                {comptes.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.nom} ({acc.type}) - Solde: {acc.solde.toLocaleString()} F</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button 
                                onClick={handleConfirmPayment}
                                disabled={!paymentAccountId || paymentAmount <= 0}
                                className={`px-4 py-2 text-white rounded font-bold ${!paymentAccountId || paymentAmount <= 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                Valider Paiement
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Historique Paiements */}
            {historyOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col animate-in zoom-in duration-200">
                        <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center rounded-t-xl">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <History size={18} className="text-gray-500"/>
                                Historique Paiements
                            </h3>
                            <button onClick={() => setHistoryOrder(null)}><X size={20} className="text-gray-500 hover:text-gray-700"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <div className="text-sm mb-4 border-b border-gray-100 pb-3">
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-500">Commande</span>
                                    <span className="font-bold">#{historyOrder.id.slice(-6)}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-500">Date</span>
                                    <span className="font-bold">{new Date(historyOrder.dateCommande).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Total</span>
                                    <span className="font-bold text-gray-800">{historyOrder.montantTotal.toLocaleString()} F</span>
                                </div>
                            </div>

                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Règlements effectués</h4>
                            
                            {historyOrder.paiements && historyOrder.paiements.length > 0 ? (
                                <div className="space-y-3">
                                    {historyOrder.paiements.map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-100 text-sm">
                                            <div>
                                                <p className="font-bold text-gray-700">{new Date(p.date).toLocaleDateString()}</p>
                                                {p.note && <p className="text-xs text-gray-500 italic">{p.note}</p>}
                                            </div>
                                            <span className="font-bold text-green-600">+{p.montant.toLocaleString()} F</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-400 italic py-4">Aucun paiement enregistré.</p>
                            )}

                            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-600">Reste à payer</span>
                                <span className="text-lg font-bold text-red-600">{(historyOrder.montantTotal - historyOrder.montantPaye).toLocaleString()} F</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuppliersView;
