
import React, { useState, useMemo } from 'react';
import { CommandeFournisseur, Fournisseur, Article, Boutique, CompteFinancier, LigneCommandeFournisseur, StatutCommandeFournisseur, StatutPaiement } from '../types';
import { Plus, Search, Filter, ShoppingCart, Edit2, CheckSquare, Truck, DollarSign, X, Save, Trash2, Calendar, AlertCircle, Eye, FileText, Archive, Ban } from 'lucide-react';

interface ProcurementViewProps {
    commandesFournisseurs: CommandeFournisseur[];
    fournisseurs: Fournisseur[];
    articles: Article[];
    boutiques: Boutique[];
    onAddOrder: (order: CommandeFournisseur, accountId?: string) => void;
    onUpdateOrder: (order: CommandeFournisseur) => void;
    onReceiveOrder: (id: string, lieuId: string, quantities: Record<string, number>, date: string) => void;
    onAddPayment: (orderId: string, amount: number, date: string, accountId?: string) => void;
    onUpdateArticle: (a: Article) => void;
    onArchiveOrder: (id: string) => void;
    onDeletePayment?: (orderId: string, paymentId: string) => void;
    onUpdatePayment?: (orderId: string, paymentId: string, updatedPayment: { montant: number, date: string, note?: string }) => void;
    comptes: CompteFinancier[];
}

const ProcurementView: React.FC<ProcurementViewProps> = ({
    commandesFournisseurs,
    fournisseurs,
    articles,
    boutiques,
    onAddOrder,
    onUpdateOrder,
    onReceiveOrder,
    onAddPayment,
    onUpdateArticle,
    onArchiveOrder,
    onDeletePayment,
    onUpdatePayment,
    comptes
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [showArchived, setShowArchived] = useState(false);

    // Order Modal State
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [newOrder, setNewOrder] = useState<Partial<CommandeFournisseur>>({
        dateCommande: new Date().toISOString().split('T')[0],
        lignes: [],
        montantTotal: 0,
        montantPaye: 0
    });
    const [applyTva, setApplyTva] = useState(false);
    const [initialAccountId, setInitialAccountId] = useState('');

    // Detail Modal State
    const [detailOrder, setDetailOrder] = useState<CommandeFournisseur | null>(null);

    // Line Item State for Order Modal
    const [tempLine, setTempLine] = useState<{ articleId: string, variante: string, quantite: number, prixUnitaire: number }>({
        articleId: '',
        variante: '',
        quantite: 0,
        prixUnitaire: 0
    });

    // Reception Modal State
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [receivingOrder, setReceivingOrder] = useState<CommandeFournisseur | null>(null);
    const [receptionQuantities, setReceptionQuantities] = useState<Record<string, number>>({});
    const [receptionLieuId, setReceptionLieuId] = useState<string>('ATELIER');
    const [receptionDate, setReceptionDate] = useState(new Date().toISOString().split('T')[0]);

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentOrder, setPaymentOrder] = useState<CommandeFournisseur | null>(null);
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentAccountId, setPaymentAccountId] = useState('');

    // Derived Data
    const filteredOrders = useMemo(() => {
        return commandesFournisseurs.filter(c => {
            const supplierName = fournisseurs.find(f => f.id === c.fournisseurId)?.nomEntreprise.toLowerCase() || '';
            const matchesSearch = supplierName.includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'ALL' || c.statut === filterStatus;
            
            // Gestion Archive
            const matchesArchive = showArchived ? c.archived === true : c.archived !== true;

            return matchesSearch && matchesStatus && matchesArchive;
        }).sort((a,b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandesFournisseurs, fournisseurs, searchTerm, filterStatus, showArchived]);

    const selectedArticleObj = articles.find(a => a.id === tempLine.articleId);

    // --- HANDLERS ---

    const handleAddLine = () => {
        if (!tempLine.articleId || tempLine.quantite <= 0 || tempLine.prixUnitaire < 0) return;
        
        const article = articles.find(a => a.id === tempLine.articleId);
        if (!article) return;

        const newLine: LigneCommandeFournisseur = {
            id: `L_${Date.now()}`,
            articleId: article.id,
            nomArticle: article.nom,
            variante: tempLine.variante || 'Standard',
            quantite: tempLine.quantite,
            prixUnitaire: tempLine.prixUnitaire,
            totalLigne: tempLine.quantite * tempLine.prixUnitaire,
            quantiteRecue: 0
        };

        const currentLines = newOrder.lignes || [];
        const updatedLines = [...currentLines, newLine];
        const newTotal = updatedLines.reduce((acc, l) => acc + l.totalLigne, 0);

        setNewOrder({
            ...newOrder,
            lignes: updatedLines,
            montantTotal: newTotal
        });

        setTempLine({ articleId: '', variante: '', quantite: 0, prixUnitaire: 0 });
    };

    const handleRemoveLine = (lineId: string) => {
        const updatedLines = (newOrder.lignes || []).filter(l => l.id !== lineId);
        const newTotal = updatedLines.reduce((acc, l) => acc + l.totalLigne, 0);
        setNewOrder({ ...newOrder, lignes: updatedLines, montantTotal: newTotal });
    };

    const handleSaveOrder = () => {
        if (!newOrder.fournisseurId || !newOrder.lignes || newOrder.lignes.length === 0) {
            alert("Veuillez sélectionner un fournisseur et ajouter des articles.");
            return;
        }

        const subTotal = (newOrder.lignes || []).reduce((acc, l) => acc + l.totalLigne, 0);
        const tvaAmount = applyTva ? Math.round(subTotal * 0.18) : 0;
        const totalTTC = subTotal + tvaAmount;

        if (isEditing && editingOrderId) {
            // MODE UPDATE
            const existingOrder = commandesFournisseurs.find(c => c.id === editingOrderId);
            if (!existingOrder) return;

            const updatedOrder: CommandeFournisseur = {
                ...existingOrder,
                fournisseurId: newOrder.fournisseurId,
                dateCommande: newOrder.dateCommande || existingOrder.dateCommande,
                dateLivraisonPrevue: newOrder.dateLivraisonPrevue || existingOrder.dateLivraisonPrevue,
                lignes: newOrder.lignes,
                montantTotal: totalTTC,
                tva: tvaAmount > 0 ? tvaAmount : undefined,
                tvaRate: tvaAmount > 0 ? 18 : undefined,
                statutPaiement: (existingOrder.montantPaye) >= totalTTC ? StatutPaiement.PAYE : ((existingOrder.montantPaye) > 0 ? StatutPaiement.PARTIEL : StatutPaiement.NON_PAYE),
            };

            onUpdateOrder(updatedOrder);
        } else {
            // MODE CREATION
            
            // --- VERIFICATION ACOMPTE ---
            if ((newOrder.montantPaye || 0) > 0) {
                if (!initialAccountId) {
                    alert("Impossible de valider : Vous avez saisi un acompte mais n'avez pas sélectionné le compte de paiement (Caisse/Banque).");
                    return;
                }

                const selectedAccount = comptes.find(c => c.id === initialAccountId);
                if (selectedAccount && selectedAccount.solde < (newOrder.montantPaye || 0)) {
                    alert(`🚫 SOLDE INSUFFISANT !\n\nLe compte "${selectedAccount.nom}" n'a que ${selectedAccount.solde.toLocaleString()} F.\nImpossible de verser un acompte de ${(newOrder.montantPaye || 0).toLocaleString()} F.`);
                    return;
                }
            }

            const order: CommandeFournisseur = {
                id: `CF_${Date.now()}`,
                fournisseurId: newOrder.fournisseurId,
                dateCommande: newOrder.dateCommande || new Date().toISOString(),
                dateLivraisonPrevue: newOrder.dateLivraisonPrevue || '',
                statut: StatutCommandeFournisseur.EN_COURS,
                lignes: newOrder.lignes,
                montantTotal: totalTTC,
                tva: tvaAmount > 0 ? tvaAmount : undefined,
                tvaRate: tvaAmount > 0 ? 18 : undefined,
                montantPaye: newOrder.montantPaye || 0,
                statutPaiement: (newOrder.montantPaye || 0) >= totalTTC ? StatutPaiement.PAYE : ((newOrder.montantPaye || 0) > 0 ? StatutPaiement.PARTIEL : StatutPaiement.NON_PAYE),
                paiements: [],
                receptions: [],
                archived: false
            };
            
            onAddOrder(order, initialAccountId);
        }
        
        setIsOrderModalOpen(false);
        setIsEditing(false);
        setEditingOrderId(null);
    };

    const openCreateModal = () => {
        setNewOrder({
            dateCommande: new Date().toISOString().split('T')[0],
            lignes: [],
            montantTotal: 0,
            montantPaye: 0,
            fournisseurId: ''
        });
        setApplyTva(false);
        setInitialAccountId('');
        setIsEditing(false);
        setEditingOrderId(null);
        setIsOrderModalOpen(true);
    };

    const openEditModal = (order: CommandeFournisseur) => {
        setNewOrder({ ...order, dateCommande: new Date(order.dateCommande).toISOString().split('T')[0], dateLivraisonPrevue: order.dateLivraisonPrevue ? new Date(order.dateLivraisonPrevue).toISOString().split('T')[0] : '' });
        setApplyTva(!!order.tva && order.tva > 0);
        setIsEditing(true);
        setEditingOrderId(order.id);
        setIsOrderModalOpen(true);
    };

    const handleEditPaymentClick = (payment: any) => {
        if (!detailOrder) return;
        setPaymentOrder(detailOrder);
        setEditingPaymentId(payment.id);
        setPaymentAmount(payment.montant);
        setPaymentDate(new Date(payment.date).toISOString().split('T')[0]);
        setPaymentNote(payment.note || '');
        setPaymentAccountId('');
        setIsPaymentModalOpen(true);
    };

    // Reception Handlers
    const openReceiveModal = (order: CommandeFournisseur) => {
        setReceivingOrder(order);
        setReceptionLieuId('ATELIER');
        const initialQty: Record<string, number> = {};
        order.lignes.forEach(l => {
            initialQty[l.id] = Math.max(0, l.quantite - (l.quantiteRecue || 0));
        });
        setReceptionQuantities(initialQty);
        setReceptionDate(new Date().toISOString().split('T')[0]);
        setIsReceiveModalOpen(true);
    };

    const handleConfirmReception = () => {
        if (!receivingOrder) return;
        onReceiveOrder(receivingOrder.id, receptionLieuId, receptionQuantities, receptionDate);
        setIsReceiveModalOpen(false);
        setReceivingOrder(null);
    };

    // Payment Handlers
    const openPaymentModal = (order: CommandeFournisseur) => {
        setPaymentOrder(order);
        setEditingPaymentId(null);
        setPaymentAmount(order.montantTotal - order.montantPaye);
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentNote('');
        setPaymentAccountId('');
        setIsPaymentModalOpen(true);
    };

    const handleConfirmPayment = () => {
        if (!paymentOrder || paymentAmount <= 0) return;

        if (editingPaymentId) {
            // MODE EDITION
            if (onUpdatePayment) {
                onUpdatePayment(paymentOrder.id, editingPaymentId, {
                    montant: paymentAmount,
                    date: paymentDate,
                    note: paymentNote
                });
                
                if (detailOrder && detailOrder.id === paymentOrder.id) {
                    const oldP = detailOrder.paiements?.find(p => p.id === editingPaymentId);
                    if (oldP) {
                        const diff = paymentAmount - oldP.montant;
                        const updatedPaiements = detailOrder.paiements?.map(p => 
                            p.id === editingPaymentId ? { ...p, montant: paymentAmount, date: paymentDate, note: paymentNote } : p
                        );
                        setDetailOrder({
                            ...detailOrder,
                            paiements: updatedPaiements,
                            montantPaye: detailOrder.montantPaye + diff
                        } as CommandeFournisseur);
                    }
                }
            }
        } else {
            // MODE CREATION
            if (!paymentAccountId) { alert("Veuillez sélectionner un compte."); return; }

            const selectedAccount = comptes.find(c => c.id === paymentAccountId);
            if (selectedAccount && selectedAccount.solde < paymentAmount) {
                alert(`🚫 SOLDE INSUFFISANT !\n\nLe compte "${selectedAccount.nom}" n'a que ${selectedAccount.solde.toLocaleString()} F.\nImpossible de payer ${paymentAmount.toLocaleString()} F.`);
                return;
            }

            onAddPayment(paymentOrder.id, paymentAmount, paymentDate, paymentAccountId);
        }

        setIsPaymentModalOpen(false);
        setPaymentOrder(null);
        setEditingPaymentId(null);
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ShoppingCart className="text-brand-600" /> Approvisionnement
                </h2>
                <div className="flex w-full sm:w-auto items-center gap-2">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Rechercher commande..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                        />
                    </div>
                    
                    <button 
                        onClick={() => setShowArchived(!showArchived)} 
                        className={`px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm border ${showArchived ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                        <Archive size={16} />
                        <span className="hidden sm:inline">{showArchived ? 'Voir Actifs' : 'Archives'}</span>
                    </button>

                    {!showArchived && (
                        <button onClick={openCreateModal} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors whitespace-nowrap">
                            <Plus size={20} /> Nouvelle Commande
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Fournisseur</th>
                            <th className="py-3 px-4 text-center">Statut</th>
                            <th className="py-3 px-4 text-center">Paiement</th>
                            <th className="py-3 px-4 text-right">Total</th>
                            <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredOrders.map(order => {
                            const supplier = fournisseurs.find(f => f.id === order.fournisseurId);
                            const unpaid = Math.max(0, order.montantTotal - order.montantPaye);
                            // Tolérance de 10 F pour les erreurs d'arrondi
                            const isFullyPaid = unpaid <= 10;
                            const isFullyDelivered = order.statut === StatutCommandeFournisseur.LIVRE;
                            const isCancelled = order.statut === StatutCommandeFournisseur.ANNULE;
                            
                            // IMPORTANT: Ne pas utiliser d'opacité sur la ligne pour éviter les problèmes de stacking context avec z-index
                            const rowClass = isCancelled ? 'bg-gray-100 text-gray-500' : 'hover:bg-gray-50 transition-colors';

                            return (
                                <tr key={order.id} className={rowClass}>
                                    <td className="py-3 px-4 text-gray-600">
                                        <div className={`font-medium ${isCancelled ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{new Date(order.dateCommande).toLocaleDateString('fr-FR')}</div>
                                        <div className="text-xs text-gray-400">Ref: {order.id.slice(-6)}</div>
                                    </td>
                                    <td className="py-3 px-4 font-bold">{supplier?.nomEntreprise || 'Inconnu'}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-3 py-1 rounded text-xs font-bold ${order.statut === StatutCommandeFournisseur.LIVRE ? 'bg-green-100 text-green-800' : isCancelled ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {order.statut}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-3 py-1 rounded text-xs font-bold ${isFullyPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                                            {isFullyPaid ? 'Payé' : `Reste: ${unpaid.toLocaleString('fr-FR')}`}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold">{order.montantTotal.toLocaleString('fr-FR')} F</td>
                                    <td className="py-3 px-4 text-center relative">
                                        {/* Container Action Buttons - Z-Index High */}
                                        <div className="flex justify-center gap-1 relative z-20">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setDetailOrder(order); }} 
                                                className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded" 
                                                title="Voir Détails"
                                                type="button"
                                            >
                                                <Eye size={16}/>
                                            </button>
                                            {!showArchived && (
                                                <>
                                                    {!isCancelled && order.statut !== StatutCommandeFournisseur.LIVRE && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); openReceiveModal(order); }} 
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" 
                                                            title="Réceptionner"
                                                            type="button"
                                                        >
                                                            <Truck size={16}/>
                                                        </button>
                                                    )}
                                                    {!isFullyPaid && !isCancelled && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); openPaymentModal(order); }} 
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded" 
                                                            title="Payer"
                                                            type="button"
                                                        >
                                                            <DollarSign size={16}/>
                                                        </button>
                                                    )}
                                                    {order.statut === StatutCommandeFournisseur.EN_COURS && (
                                                        <>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); openEditModal(order); }} 
                                                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" 
                                                                title="Modifier"
                                                                type="button"
                                                            >
                                                                <Edit2 size={16}/>
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredOrders.length === 0 && (
                            <tr><td colSpan={6} className="py-8 text-center text-gray-400">
                                {showArchived ? "Aucune commande archivée." : "Aucune commande trouvée."}
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Détails Commande */}
            {detailOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col animate-in zoom-in duration-200 max-h-[90vh]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <FileText size={18} className="text-gray-500"/>
                                Détails Commande #{detailOrder.id.slice(-6)}
                            </h3>
                            <button onClick={() => setDetailOrder(null)}><X size={20} className="text-gray-500 hover:text-gray-700"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                                <div>
                                    <p className="text-gray-500 text-xs uppercase font-bold">Fournisseur</p>
                                    <p className="font-bold text-gray-800">{fournisseurs.find(f => f.id === detailOrder.fournisseurId)?.nomEntreprise || 'Inconnu'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase font-bold">Date Commande</p>
                                    <p className="font-bold text-gray-800">{new Date(detailOrder.dateCommande).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase font-bold">Statut</p>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${detailOrder.statut === StatutCommandeFournisseur.LIVRE ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {detailOrder.statut}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase font-bold">Paiement</p>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${detailOrder.statutPaiement === StatutPaiement.PAYE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {detailOrder.statutPaiement} ({detailOrder.montantPaye.toLocaleString()} F payés)
                                    </span>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-600 font-medium">
                                        <tr>
                                            <th className="py-2 px-3">Article</th>
                                            <th className="py-2 px-3 text-center">Qté</th>
                                            <th className="py-2 px-3 text-right">Prix U.</th>
                                            <th className="py-2 px-3 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {detailOrder.lignes.map(line => (
                                            <tr key={line.id}>
                                                <td className="py-2 px-3">
                                                    <div className="font-medium text-gray-800">{line.nomArticle}</div>
                                                    {line.variante !== 'Standard' && <div className="text-xs text-gray-500">{line.variante}</div>}
                                                </td>
                                                <td className="py-2 px-3 text-center font-bold">
                                                    {line.quantite}
                                                    {line.quantiteRecue !== undefined && line.quantiteRecue < line.quantite && (
                                                        <span className="block text-[10px] text-orange-600">Reçu: {line.quantiteRecue}</span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 text-right text-gray-600">{line.prixUnitaire.toLocaleString()}</td>
                                                <td className="py-2 px-3 text-right font-bold">{line.totalLigne.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                                        <tr>
                                            <td colSpan={3} className="py-3 px-3 text-right text-gray-600">TOTAL</td>
                                            <td className="py-3 px-3 text-right text-brand-700">{detailOrder.montantTotal.toLocaleString()} F</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Historique Paiements dans le modal détails */}
                            <div className="mt-6">
                                <h4 className="font-bold text-gray-700 text-sm mb-3">Historique des Paiements</h4>
                                {detailOrder.paiements && detailOrder.paiements.length > 0 ? (
                                    <table className="w-full text-sm text-left border border-gray-100 rounded-lg overflow-hidden">
                                        <thead className="bg-gray-50 text-gray-600 font-medium text-xs">
                                            <tr>
                                                <th className="py-2 px-3">Date</th>
                                                <th className="py-2 px-3">Note</th>
                                                <th className="py-2 px-3 text-right">Montant</th>
                                                <th className="py-2 px-3 text-center w-16"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {detailOrder.paiements.map(p => (
                                                <tr key={p.id}>
                                                    <td className="py-2 px-3 text-gray-600">{new Date(p.date).toLocaleDateString()}</td>
                                                    <td className="py-2 px-3 text-gray-500 italic">{p.note || '-'}</td>
                                                    <td className="py-2 px-3 text-right font-bold text-green-600">{p.montant.toLocaleString()} F</td>
                                                    <td className="py-2 px-3 text-center">
                                                        <div className="flex justify-end gap-1">
                                                            <button 
                                                                onClick={() => handleEditPaymentClick(p)}
                                                                className="text-blue-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50"
                                                                title="Modifier ce paiement"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            {/* Bouton de suppression retiré */}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="text-gray-400 italic text-sm">Aucun paiement enregistré.</p>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end rounded-b-xl">
                            <button onClick={() => setDetailOrder(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Fermer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Order */}
            {isOrderModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg text-gray-800">{isEditing ? 'Modifier Commande' : 'Nouvelle Commande Fournisseur'}</h3>
                            <button onClick={() => setIsOrderModalOpen(false)}><X size={20} className="text-gray-500 hover:text-gray-700"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                                    <select className="w-full p-2 border border-gray-300 rounded" value={newOrder.fournisseurId} onChange={e => setNewOrder({...newOrder, fournisseurId: e.target.value})}>
                                        <option value="">-- Sélectionner --</option>
                                        {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nomEntreprise}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Commande</label>
                                    <input type="date" className="w-full p-2 border border-gray-300 rounded" value={newOrder.dateCommande} onChange={e => setNewOrder({...newOrder, dateCommande: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Livraison Prévue</label>
                                    <input type="date" className="w-full p-2 border border-gray-300 rounded" value={newOrder.dateLivraisonPrevue || ''} onChange={e => setNewOrder({...newOrder, dateLivraisonPrevue: e.target.value})} />
                                </div>
                            </div>

                            {/* Add Lines Section */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h4 className="font-bold text-sm text-gray-700 mb-3">Ajouter des articles</h4>
                                <div className="flex gap-2 items-end mb-2">
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-500 mb-1">Article</label>
                                        <select className="w-full p-1.5 border border-gray-300 rounded text-sm" value={tempLine.articleId} onChange={e => {
                                            const art = articles.find(a => a.id === e.target.value);
                                            setTempLine({ ...tempLine, articleId: e.target.value, variante: '', prixUnitaire: art ? art.prixAchatDefault : 0 });
                                        }}>
                                            <option value="">-- Article --</option>
                                            {articles.filter(a => a.typeArticle === 'MATIERE_PREMIERE').map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-1/4">
                                        <label className="block text-xs text-gray-500 mb-1">Variante</label>
                                        {selectedArticleObj && selectedArticleObj.variantes.length > 0 ? (
                                            <select className="w-full p-1.5 border border-gray-300 rounded text-sm" value={tempLine.variante} onChange={e => setTempLine({...tempLine, variante: e.target.value})}>
                                                <option value="">-- Choisir --</option>
                                                {selectedArticleObj.variantes.map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        ) : (
                                            <input type="text" disabled className="w-full p-1.5 bg-gray-100 border border-gray-300 rounded text-sm" placeholder="Standard" />
                                        )}
                                    </div>
                                    <div className="w-20">
                                        <label className="block text-xs text-gray-500 mb-1">Qté</label>
                                        <input type="number" className="w-full p-1.5 border border-gray-300 rounded text-sm" value={tempLine.quantite || ''} onChange={e => setTempLine({...tempLine, quantite: parseFloat(e.target.value) || 0})} />
                                    </div>
                                    <div className="w-24">
                                        <label className="block text-xs text-gray-500 mb-1">Prix U.</label>
                                        <input type="number" className="w-full p-1.5 border border-gray-300 rounded text-sm" value={tempLine.prixUnitaire || ''} onChange={e => setTempLine({...tempLine, prixUnitaire: parseInt(e.target.value) || 0})} />
                                    </div>
                                    <button onClick={handleAddLine} className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700"><Plus size={20}/></button>
                                </div>

                                {/* Lines List */}
                                <div className="space-y-1">
                                    {newOrder.lignes?.map(line => (
                                        <div key={line.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 text-sm">
                                            <span>{line.nomArticle} {line.variante !== 'Standard' ? `(${line.variante})` : ''} x{line.quantite}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold">{line.totalLigne.toLocaleString()} F</span>
                                                <button onClick={() => handleRemoveLine(line.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {(!newOrder.lignes || newOrder.lignes.length === 0) && <p className="text-center text-gray-400 italic text-xs py-2">Aucun article ajouté.</p>}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="tva" checked={applyTva} onChange={e => setApplyTva(e.target.checked)} className="rounded text-brand-600" />
                                <label htmlFor="tva" className="text-sm font-medium text-gray-700">Appliquer TVA (18%)</label>
                            </div>

                            {/* Total Calculation */}
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                <span className="font-bold text-gray-700">Total Commande (TTC)</span>
                                <span className="text-xl font-bold text-brand-700">
                                    {(() => {
                                        const sub = (newOrder.lignes || []).reduce((acc, l) => acc + l.totalLigne, 0);
                                        const tva = applyTva ? Math.round(sub * 0.18) : 0;
                                        return (sub + tva).toLocaleString();
                                    })()} F
                                </span>
                            </div>

                            {!isEditing && (
                                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                    <h4 className="font-bold text-xs text-gray-700 uppercase mb-2">Paiement Immédiat (Acompte)</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Montant Versé</label>
                                            <input type="number" className="w-full p-1.5 border border-gray-300 rounded text-sm" value={newOrder.montantPaye || ''} onChange={e => setNewOrder({...newOrder, montantPaye: parseInt(e.target.value) || 0})} placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Compte Source</label>
                                            <select className="w-full p-1.5 border border-gray-300 rounded text-sm bg-white" value={initialAccountId} onChange={e => setInitialAccountId(e.target.value)}>
                                                <option value="">-- Choisir --</option>
                                                {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                            <button onClick={() => setIsOrderModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleSaveOrder} className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 font-bold shadow-sm flex items-center gap-2"><Save size={18}/> Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Reception */}
            {isReceiveModalOpen && receivingOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800"><Truck className="text-blue-600"/> Réception Stock</h3>
                            <button onClick={() => setIsReceiveModalOpen(false)}><X size={24} className="text-gray-400"/></button>
                        </div>
                        
                        <div className="space-y-4 overflow-y-auto flex-1 p-1">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de stockage</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={receptionLieuId} onChange={e => setReceptionLieuId(e.target.value)}>
                                    <option value="ATELIER">Atelier Central</option>
                                    {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date Réception</label>
                                <input type="date" className="w-full p-2 border border-gray-300 rounded" value={receptionDate} onChange={e => setReceptionDate(e.target.value)} />
                            </div>

                            <div className="space-y-3">
                                {receivingOrder.lignes.map(line => {
                                    const remaining = Math.max(0, line.quantite - (line.quantiteRecue || 0));
                                    if (remaining === 0) return null;
                                    return (
                                        <div key={line.id} className="bg-gray-50 p-3 rounded border border-gray-200">
                                            <div className="flex justify-between mb-2">
                                                <span className="font-bold text-sm">{line.nomArticle} ({line.variante})</span>
                                                <span className="text-xs text-gray-500">Reste à recevoir: {remaining}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs">Reçu :</label>
                                                <input 
                                                    type="number" 
                                                    className="w-20 p-1 border border-gray-300 rounded text-center font-bold" 
                                                    min="0" 
                                                    max={remaining}
                                                    value={receptionQuantities[line.id] || 0}
                                                    onChange={e => setReceptionQuantities({...receptionQuantities, [line.id]: Math.min(remaining, parseInt(e.target.value) || 0)})}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {receivingOrder.lignes.every(l => (l.quantite - (l.quantiteRecue || 0)) <= 0) && (
                                    <p className="text-center text-green-600 font-bold py-4">Commande entièrement réceptionnée !</p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                            <button onClick={() => setIsReceiveModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleConfirmReception} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">Valider Entrée</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Paiement */}
            {isPaymentModalOpen && paymentOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800"><DollarSign className="text-green-600"/> {editingPaymentId ? 'Modifier Paiement' : 'Règlement'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded font-bold text-lg" value={paymentAmount} onChange={e => setPaymentAmount(parseInt(e.target.value) || 0)} max={editingPaymentId ? undefined : (paymentOrder.montantTotal - paymentOrder.montantPaye)} />
                            </div>
                            
                            {!editingPaymentId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Compte de Paiement</label>
                                    <select className="w-full p-2 border border-gray-300 rounded" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)}>
                                        <option value="">-- Choisir --</option>
                                        {comptes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                    </select>
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input type="date" className="w-full p-2 border border-gray-300 rounded" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                            </div>

                            {editingPaymentId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Note / Détails</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} />
                                    <p className="text-xs text-orange-600 mt-2 bg-orange-50 p-2 rounded">
                                        Attention : Modifier ce montant ne met pas à jour automatiquement la caisse ou la banque. Veuillez ajuster manuellement la trésorerie si nécessaire.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleConfirmPayment} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold">Valider</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcurementView;
