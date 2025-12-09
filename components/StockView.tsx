import React, { useState, useMemo } from 'react';
import { Article, Boutique, MouvementStock, TypeMouvement, RoleEmploye } from '../types';
import { Box, ArrowRightLeft, History, AlertTriangle, Building, Search, Package, X, Save, TrendingUp, TrendingDown, BarChart2, Filter, Edit, Layers, Plus, Trash2, LayoutGrid, List, CheckCircle, AlertOctagon, ArrowRight, Eye } from 'lucide-react';

interface StockViewProps {
    articles: Article[];
    boutiques: Boutique[];
    mouvements: MouvementStock[];
    userRole: RoleEmploye;
    onAddMouvement: (m: MouvementStock) => void;
    onAddBoutique: (b: Boutique) => void;
}

const StockView: React.FC<StockViewProps> = ({ articles, boutiques, mouvements, userRole, onAddMouvement, onAddBoutique }) => {
    const [viewMode, setViewMode] = useState<'LEVELS' | 'HISTORY' | 'ANALYSIS'>('LEVELS');
    const [levelsViewMode, setLevelsViewMode] = useState<'GRID' | 'LIST'>('LIST'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [stockFilter, setStockFilter] = useState<'ALL' | 'AVAILABLE' | 'LOW' | 'OUT'>('ALL');
    
    // Analysis State
    const [analysisArticleId, setAnalysisArticleId] = useState<string>('');
    const [dateStart, setDateStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0]);
    
    // Modals State
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isMassTransferModalOpen, setIsMassTransferModalOpen] = useState(false);
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [isBoutiqueModalOpen, setIsBoutiqueModalOpen] = useState(false);
    const [selectedArticleForDetail, setSelectedArticleForDetail] = useState<Article | null>(null); // NEW: Detail Modal

    // Quick Edit Stock State
    const [isQuickEditModalOpen, setIsQuickEditModalOpen] = useState(false);
    const [quickEditArticle, setQuickEditArticle] = useState<Article | null>(null);
    const [stockEdits, setStockEdits] = useState<Record<string, number>>({}); 

    // Form States 
    const [selectedArticleId, setSelectedArticleId] = useState('');
    const [selectedVariant, setSelectedVariant] = useState('');
    const [selectedSourceId, setSelectedSourceId] = useState('');
    const [selectedDestId, setSelectedDestId] = useState('');
    const [quantity, setQuantity] = useState(0);
    const [reason, setReason] = useState('');
    const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'REMOVE'>('REMOVE');

    // Mass Transfer State
    const [massSourceId, setMassSourceId] = useState('');
    const [massDestId, setMassDestId] = useState('');
    const [massTransferList, setMassTransferList] = useState<Array<{
        tempId: string;
        articleId: string;
        articleNom: string;
        variante: string;
        quantite: number;
        unite: string;
    }>>([]);
    const [massTempArticleId, setMassTempArticleId] = useState('');
    const [massTempVariant, setMassTempVariant] = useState('');
    const [massTempQty, setMassTempQty] = useState(0);

    const [newBoutique, setNewBoutique] = useState<Partial<Boutique>>({ nom: '', lieu: '' });

    // --- PERMISSIONS ---
    const canManageStock = userRole !== RoleEmploye.VENDEUR;

    // --- HELPERS ---
    const getArticleTotal = (a: Article): number => {
        return Object.values(a.stockParLieu).reduce((acc: number, variants: Record<string, number>) => 
            acc + Object.values(variants).reduce((vAcc: number, qty: any) => vAcc + (qty as number), 0)
        , 0);
    };

    const getArticleTotalInShop = (a: Article, shopId: string): number => {
        const variants = a.stockParLieu[shopId];
        if (!variants) return 0;
        return Object.values(variants).reduce((acc: number, qty: number) => acc + qty, 0);
    };

    const filteredArticles = articles.filter(a => {
        const matchesSearch = a.nom.toLowerCase().includes(searchTerm.toLowerCase()) || a.categorie.toLowerCase().includes(searchTerm.toLowerCase());
        const total = getArticleTotal(a);
        
        let matchesFilter = true;
        if (stockFilter === 'AVAILABLE') matchesFilter = total > a.seuilAlerte;
        else if (stockFilter === 'LOW') matchesFilter = total > 0 && total <= a.seuilAlerte;
        else if (stockFilter === 'OUT') matchesFilter = total === 0;

        return matchesSearch && matchesFilter;
    });

    const filteredMouvements = mouvements.filter(m => 
        m.articleNom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.commentaire && m.commentaire.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Summary Stats
    const stats = useMemo(() => {
        let available = 0;
        let low = 0;
        let out = 0;
        let totalValue = 0;

        articles.forEach(a => {
            const total = getArticleTotal(a);
            if (total === 0) out++;
            else if (total <= a.seuilAlerte) low++;
            else available++;

            totalValue += total * a.prixAchatDefault;
        });

        return { available, low, out, totalValue };
    }, [articles]);

    const resetForm = () => {
        setSelectedArticleId('');
        setSelectedVariant('');
        setSelectedSourceId('');
        setSelectedDestId('');
        setQuantity(0);
        setReason('');
        setAdjustmentType('REMOVE');
    };

    const resetMassForm = () => {
        setMassSourceId('');
        setMassDestId('');
        setMassTransferList([]);
        setMassTempArticleId('');
        setMassTempVariant('');
        setMassTempQty(0);
    };

    // --- ACTIONS ---
    const handleTransfer = () => {
        if (!selectedArticleId || !selectedSourceId || !selectedDestId || quantity <= 0) {
            alert("Veuillez remplir tous les champs et saisir une quantité valide.");
            return;
        }
        if (selectedSourceId === selectedDestId) {
            alert("La source et la destination doivent être différentes.");
            return;
        }
        const article = articles.find(a => a.id === selectedArticleId);
        if (!article) return;
        const variantToMove = selectedVariant || 'Standard';
        const stockSource = article.stockParLieu[selectedSourceId]?.[variantToMove] || 0;

        if (stockSource < quantity) {
            const boutiqueSource = boutiques.find(b => b.id === selectedSourceId)?.nom || selectedSourceId;
            alert(`⚠️ STOCK INSUFFISANT\n\nImpossible de transférer ${quantity} ${article.unite}.\nLe stock actuel à "${boutiqueSource}" est de : ${stockSource}.`);
            return;
        }

        const mOut: MouvementStock = {
            id: `M${Date.now()}_TR`,
            date: new Date().toISOString(),
            articleId: article.id,
            articleNom: article.nom,
            variante: variantToMove,
            type: TypeMouvement.TRANSFERT,
            quantite: -quantity,
            lieuId: selectedSourceId,
            lieuDestinationId: selectedDestId,
            commentaire: reason || `Transfert vers ${boutiques.find(b => b.id === selectedDestId)?.nom}`
        };
        onAddMouvement(mOut);
        setIsTransferModalOpen(false);
        resetForm();
    };

    const handleAddToMassList = () => {
        if (!massSourceId) { alert("Veuillez sélectionner une boutique source."); return; }
        if (!massTempArticleId || massTempQty <= 0) { return; }
        const article = articles.find(a => a.id === massTempArticleId);
        if (!article) return;
        const variantToMove = massTempVariant || 'Standard';
        const stockSource = article.stockParLieu[massSourceId]?.[variantToMove] || 0;
        const existingInList = massTransferList.find(i => i.articleId === article.id && i.variante === variantToMove);
        const qtyAlreadyQueued = existingInList ? existingInList.quantite : 0;

        if (stockSource < (massTempQty + qtyAlreadyQueued)) {
            alert(`Stock insuffisant. Disponible: ${stockSource}, Déjà dans la liste: ${qtyAlreadyQueued}, Demandé: ${massTempQty}`);
            return;
        }

        if (existingInList) {
            setMassTransferList(prev => prev.map(item => item.tempId === existingInList.tempId ? { ...item, quantite: item.quantite + massTempQty } : item));
        } else {
            setMassTransferList(prev => [...prev, {
                tempId: Date.now().toString(),
                articleId: article.id,
                articleNom: article.nom,
                variante: variantToMove,
                quantite: massTempQty,
                unite: article.unite
            }]);
        }
        setMassTempQty(0);
    };

    const handleRemoveFromMassList = (tempId: string) => {
        if (window.confirm("Voulez-vous retirer cet article de la liste de transfert ?")) {
            setMassTransferList(prev => prev.filter(i => i.tempId !== tempId));
        }
    };

    const executeMassTransfer = () => {
        if (!massSourceId || !massDestId || massTransferList.length === 0) {
            alert("Informations incomplètes.");
            return;
        }
        if (massSourceId === massDestId) {
            alert("La source et la destination doivent être différentes.");
            return;
        }
        const destName = boutiques.find(b => b.id === massDestId)?.nom || 'Autre';
        massTransferList.forEach(item => {
            const mOut: MouvementStock = {
                id: `M${Date.now()}_TR_MASS_${Math.floor(Math.random() * 1000)}`,
                date: new Date().toISOString(),
                articleId: item.articleId,
                articleNom: item.articleNom,
                variante: item.variante,
                type: TypeMouvement.TRANSFERT,
                quantite: -item.quantite,
                lieuId: massSourceId,
                lieuDestinationId: massDestId,
                commentaire: `Transfert de masse vers ${destName}`
            };
            onAddMouvement(mOut);
        });
        setIsMassTransferModalOpen(false);
        resetMassForm();
    };

    const handleAdjustment = () => {
        if (!selectedArticleId || !selectedSourceId || quantity <= 0 || !reason) {
            alert("Veuillez remplir tous les champs.");
            return;
        }
        const article = articles.find(a => a.id === selectedArticleId);
        if (!article) return;
        const variantToAdj = selectedVariant || 'Standard';
        if (adjustmentType === 'REMOVE') {
            const currentStock = article.stockParLieu[selectedSourceId]?.[variantToAdj] || 0;
            if (currentStock < quantity) {
                alert(`Stock insuffisant pour retirer ${quantity}. Stock actuel: ${currentStock}`);
                return;
            }
        }
        const mAdj: MouvementStock = {
            id: `M${Date.now()}_ADJ`,
            date: new Date().toISOString(),
            articleId: article.id,
            articleNom: article.nom,
            variante: variantToAdj,
            type: TypeMouvement.AJUSTEMENT,
            quantite: adjustmentType === 'ADD' ? quantity : -quantity,
            lieuId: selectedSourceId,
            commentaire: `Ajustement (${adjustmentType === 'ADD' ? '+' : '-'}): ${reason}`
        };
        onAddMouvement(mAdj);
        setIsAdjustmentModalOpen(false);
        resetForm();
    };

    const handleSaveBoutique = () => {
        if (!newBoutique.nom || !newBoutique.lieu) return;
        onAddBoutique({
            id: `B${Date.now()}`,
            nom: newBoutique.nom,
            lieu: newBoutique.lieu
        });
        setIsBoutiqueModalOpen(false);
        setNewBoutique({ nom: '', lieu: '' });
    };

    // Objets sélectionnés pour l'affichage dynamique
    const selectedArticleObj = articles.find(a => a.id === selectedArticleId);
    const massSelectedArticleObj = articles.find(a => a.id === massTempArticleId);

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
            {/* --- HEADER ET BOUTONS --- */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Box className="text-brand-600" /> Gestion des Stocks
                </h2>
                <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto overflow-x-auto max-w-full items-center gap-2">
                    {viewMode === 'LEVELS' && (
                        <div className="flex bg-white p-0.5 rounded border border-gray-200 mr-2">
                            <button onClick={() => setLevelsViewMode('GRID')} className={`p-1.5 rounded transition-all ${levelsViewMode === 'GRID' ? 'bg-gray-100 text-brand-600' : 'text-gray-400 hover:text-gray-600'}`} title="Vue Grille"><LayoutGrid size={16} /></button>
                            <button onClick={() => setLevelsViewMode('LIST')} className={`p-1.5 rounded transition-all ${levelsViewMode === 'LIST' ? 'bg-gray-100 text-brand-600' : 'text-gray-400 hover:text-gray-600'}`} title="Vue Tableau"><List size={16} /></button>
                        </div>
                    )}
                    <button onClick={() => setViewMode('LEVELS')} className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${viewMode === 'LEVELS' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Niveaux de Stock</button>
                    <button onClick={() => setViewMode('HISTORY')} className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${viewMode === 'HISTORY' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Historique Global</button>
                </div>
            </div>

            {/* --- STATS CARDS --- */}
            {viewMode === 'LEVELS' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between"><div><p className="text-xs text-gray-500 uppercase font-bold">Total Références</p><p className="text-2xl font-bold text-gray-900">{articles.length}</p></div><Box size={24} className="text-gray-300"/></div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm flex items-center justify-between"><div><p className="text-xs text-green-700 uppercase font-bold">En Stock</p><p className="text-2xl font-bold text-green-800">{stats.available}</p></div><CheckCircle size={24} className="text-green-300"/></div>
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 shadow-sm flex items-center justify-between"><div><p className="text-xs text-orange-700 uppercase font-bold">Stock Faible</p><p className="text-2xl font-bold text-orange-800">{stats.low}</p></div><AlertTriangle size={24} className="text-orange-300"/></div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm flex items-center justify-between"><div><p className="text-xs text-red-700 uppercase font-bold">Rupture Stock</p><p className="text-2xl font-bold text-red-800">{stats.out}</p></div><AlertOctagon size={24} className="text-red-300"/></div>
                </div>
            )}

            {/* --- FILTERS & ACTIONS BAR --- */}
            {viewMode !== 'ANALYSIS' && (
                <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                    <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                        <div className="relative flex-1 sm:min-w-[250px]">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input type="text" placeholder={viewMode === 'LEVELS' ? "Rechercher un article..." : "Rechercher un mouvement..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500" />
                        </div>
                        {viewMode === 'LEVELS' && (
                            <div className="flex bg-white border border-gray-200 p-1 rounded-lg overflow-x-auto">
                                {['ALL', 'AVAILABLE', 'LOW', 'OUT'].map(filter => (
                                    <button key={filter} onClick={() => setStockFilter(filter as any)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${stockFilter === filter ? (filter === 'OUT' ? 'bg-red-100 text-red-700' : filter === 'LOW' ? 'bg-orange-100 text-orange-700' : filter === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-gray-800 text-white') : 'text-gray-500 hover:bg-gray-50'}`}>{filter === 'ALL' ? 'Tous' : filter === 'AVAILABLE' ? 'Disponibles' : filter === 'LOW' ? 'Faible' : 'En Rupture'}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {canManageStock && (
                        <div className="flex gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                            <button onClick={() => { resetForm(); setIsTransferModalOpen(true); }} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm"><ArrowRightLeft size={16} /> Transfert</button>
                            <button onClick={() => { resetMassForm(); setIsMassTransferModalOpen(true); }} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm"><Layers size={16} /> En Masse</button>
                            <button onClick={() => { resetForm(); setIsAdjustmentModalOpen(true); }} className="flex-1 sm:flex-none bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm"><AlertTriangle size={16} /> Ajustement</button>
                            <button onClick={() => setIsBoutiqueModalOpen(true)} className="flex-1 sm:flex-none bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm"><Building size={16} /> + Boutique</button>
                        </div>
                    )}
                </div>
            )}

            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-gray-200">
                {viewMode === 'LEVELS' ? (
                    levelsViewMode === 'LIST' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0 z-10 border-b border-gray-200">
                                    <tr>
                                        <th className="py-3 px-4">Article</th>
                                        <th className="py-3 px-4">Type</th>
                                        <th className="py-3 px-4 text-center">Total Global</th>
                                        {boutiques.map(b => (
                                            <th key={b.id} className="py-3 px-4 text-center border-l border-gray-100">{b.nom}</th>
                                        ))}
                                        <th className="py-3 px-4 text-center">Détails</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredArticles.map(article => {
                                        const total = getArticleTotal(article);
                                        const statusColor = total === 0 ? 'text-red-500' : total <= article.seuilAlerte ? 'text-orange-500' : 'text-green-600';
                                        return (
                                            <tr key={article.id} className="hover:bg-gray-50">
                                                <td className="py-3 px-4 font-bold text-gray-800">{article.nom}</td>
                                                <td className="py-3 px-4 text-gray-500 text-xs">{article.categorie}</td>
                                                <td className={`py-3 px-4 text-center font-bold ${statusColor} bg-gray-50`}>{total} {article.unite}</td>
                                                {boutiques.map(b => {
                                                    const shopTotal = getArticleTotalInShop(article, b.id);
                                                    return (
                                                        <td key={b.id} className="py-3 px-4 text-center border-l border-gray-100 text-gray-700">
                                                            {shopTotal > 0 ? shopTotal : <span className="text-gray-300">-</span>}
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-3 px-4 text-center">
                                                    <button 
                                                        onClick={() => setSelectedArticleForDetail(article)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="Voir détails par variante"
                                                    >
                                                        <Eye size={16}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredArticles.map(article => (
                                <div key={article.id} className="bg-white border rounded-lg p-4 shadow-sm relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-gray-800 pr-8">{article.nom}</h3>
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${getArticleTotal(article) <= article.seuilAlerte ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                            {getArticleTotal(article)} {article.unite}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedArticleForDetail(article)}
                                        className="absolute top-4 right-4 text-blue-500 hover:bg-blue-50 p-1 rounded"
                                        title="Voir Détails"
                                    >
                                        <Eye size={16}/>
                                    </button>
                                    <div className="space-y-1 mt-3">
                                        {boutiques.map(b => {
                                            const qty = getArticleTotalInShop(article, b.id);
                                            return (
                                                <div key={b.id} className="flex justify-between text-sm border-b border-gray-100 pb-1 last:border-0">
                                                    <span className="text-gray-500">{b.nom}</span>
                                                    <span className={`font-medium ${qty > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{qty}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : viewMode === 'HISTORY' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0 z-10 border-b border-gray-200">
                                <tr>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Article</th>
                                    <th className="py-3 px-4">Type Mouvement</th>
                                    <th className="py-3 px-4">Quantité</th>
                                    <th className="py-3 px-4">Lieu</th>
                                    <th className="py-3 px-4">Détail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredMouvements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (
                                    <tr key={m.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 text-gray-500">{new Date(m.date).toLocaleDateString()}</td>
                                        <td className="py-3 px-4 font-medium text-gray-800">{m.articleNom} <span className="text-xs text-gray-400">({m.variante})</span></td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold 
                                                ${m.type === TypeMouvement.VENTE || m.type === TypeMouvement.CONSOMMATION ? 'bg-orange-100 text-orange-800' : 
                                                  m.type === TypeMouvement.ACHAT || m.type === TypeMouvement.PRODUCTION ? 'bg-green-100 text-green-800' : 
                                                  'bg-blue-100 text-blue-800'}`}>
                                                {m.type}
                                            </span>
                                        </td>
                                        <td className={`py-3 px-4 font-bold ${m.quantite > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {m.quantite > 0 ? '+' : ''}{m.quantite}
                                        </td>
                                        <td className="py-3 px-4 text-gray-600">
                                            {boutiques.find(b => b.id === m.lieuId)?.nom} 
                                            {m.lieuDestinationId && <span className="text-gray-400"> → {boutiques.find(b => b.id === m.lieuDestinationId)?.nom}</span>}
                                        </td>
                                        <td className="py-3 px-4 text-gray-500 text-xs italic">{m.commentaire}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-400">
                        <BarChart2 size={48} className="mx-auto mb-2 opacity-20"/>
                        <p>Module d'analyse des flux en cours de développement.</p>
                    </div>
                )}
            </div>

            {/* --- MODAL DETAILS STOCK PAR VARIANTE --- */}
            {selectedArticleForDetail && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                                <Box className="text-brand-600" /> Détails Stock : {selectedArticleForDetail.nom}
                            </h3>
                            <button onClick={() => setSelectedArticleForDetail(null)} className="hover:bg-gray-100 p-1 rounded-full text-gray-500"><X size={24}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0">
                                    <tr>
                                        <th className="p-3">Variante</th>
                                        <th className="p-3 text-center bg-gray-100 font-bold border-l border-r border-gray-200">TOTAL</th>
                                        {boutiques.map(b => (
                                            <th key={b.id} className="p-3 text-center border-r border-gray-100">{b.nom}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedArticleForDetail.variantes.length > 0 ? (
                                        selectedArticleForDetail.variantes.map(variant => {
                                            let rowTotal = 0;
                                            return (
                                                <tr key={variant} className="hover:bg-gray-50">
                                                    <td className="p-3 font-medium text-gray-800">{variant}</td>
                                                    <td className="p-3 text-center font-bold bg-gray-50 border-l border-r border-gray-200">
                                                        {(() => {
                                                            const tot = (Object.values(selectedArticleForDetail.stockParLieu) as Record<string, number>[]).reduce((acc: number, place) => acc + (Number(place[variant]) || 0), 0);
                                                            rowTotal = tot;
                                                            return tot;
                                                        })()}
                                                    </td>
                                                    {boutiques.map(b => (
                                                        <td key={b.id} className="p-3 text-center border-r border-gray-100 text-gray-600">
                                                            {selectedArticleForDetail.stockParLieu[b.id]?.[variant] || '-'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        // Cas sans variante explicite (Standard)
                                        <tr className="hover:bg-gray-50">
                                            <td className="p-3 font-medium text-gray-800">Standard</td>
                                            <td className="p-3 text-center font-bold bg-gray-50 border-l border-r border-gray-200">
                                                {getArticleTotal(selectedArticleForDetail)}
                                            </td>
                                            {boutiques.map(b => (
                                                <td key={b.id} className="p-3 text-center border-r border-gray-100 text-gray-600">
                                                    {selectedArticleForDetail.stockParLieu[b.id]?.['Standard'] || '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button onClick={() => setSelectedArticleForDetail(null)} className="px-4 py-2 bg-gray-800 text-white rounded font-medium hover:bg-gray-900">Fermer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL TRANSFERT --- */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                            <ArrowRightLeft className="text-blue-600" /> Transfert de Stock
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Article</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={selectedArticleId} onChange={e => setSelectedArticleId(e.target.value)}>
                                    <option value="">-- Sélectionner --</option>
                                    {articles.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                                </select>
                            </div>
                            {selectedArticleObj && selectedArticleObj.variantes.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Variante</label>
                                    <select className="w-full p-2 border border-gray-300 rounded" value={selectedVariant} onChange={e => setSelectedVariant(e.target.value)}>
                                        <option value="">-- Sélectionner --</option>
                                        {selectedArticleObj.variantes.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Source (De)</label>
                                    <select className="w-full p-2 border border-gray-300 rounded" value={selectedSourceId} onChange={e => setSelectedSourceId(e.target.value)}>
                                        <option value="">-- Choisir --</option>
                                        {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination (Vers)</label>
                                    <select className="w-full p-2 border border-gray-300 rounded" value={selectedDestId} onChange={e => setSelectedDestId(e.target.value)}>
                                        <option value="">-- Choisir --</option>
                                        {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Motif / Commentaire</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Réassort boutique" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsTransferModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleTransfer} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL AJUSTEMENT --- */}
            {isAdjustmentModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                            <AlertTriangle className="text-orange-600" /> Ajustement de Stock
                        </h3>
                        <div className="bg-orange-50 border border-orange-100 p-3 rounded text-sm text-orange-800 mb-4">
                            Utilisez ceci pour corriger les erreurs d'inventaire, pertes ou vols.
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Article</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={selectedArticleId} onChange={e => setSelectedArticleId(e.target.value)}>
                                    <option value="">-- Sélectionner --</option>
                                    {articles.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                                </select>
                            </div>
                            {selectedArticleObj && selectedArticleObj.variantes.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Variante</label>
                                    <select className="w-full p-2 border border-gray-300 rounded" value={selectedVariant} onChange={e => setSelectedVariant(e.target.value)}>
                                        <option value="">-- Sélectionner --</option>
                                        {selectedArticleObj.variantes.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={selectedSourceId} onChange={e => setSelectedSourceId(e.target.value)}>
                                    <option value="">-- Choisir --</option>
                                    {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <div className="flex bg-gray-100 p-1 rounded">
                                        <button onClick={() => setAdjustmentType('ADD')} className={`flex-1 py-1 rounded text-sm font-bold ${adjustmentType === 'ADD' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>Ajout (+)</button>
                                        <button onClick={() => setAdjustmentType('REMOVE')} className={`flex-1 py-1 rounded text-sm font-bold ${adjustmentType === 'REMOVE' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>Retrait (-)</button>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                                    <input type="number" className="w-full p-2 border border-gray-300 rounded" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Raison</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Inventaire, Perte..." />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsAdjustmentModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleAdjustment} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 font-bold">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL TRANSFERT EN MASSE --- */}
            {isMassTransferModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                                <Layers className="text-indigo-600" /> Transfert en Masse
                            </h3>
                            <button onClick={() => setIsMassTransferModalOpen(false)} className="hover:bg-gray-100 p-1 rounded-full"><X size={24}/></button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Source (Départ)</label>
                                <select className="w-full p-2 border border-gray-300 rounded bg-gray-50" value={massSourceId} onChange={e => setMassSourceId(e.target.value)}>
                                    <option value="">-- Choisir --</option>
                                    {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Destination (Arrivée)</label>
                                <select className="w-full p-2 border border-gray-300 rounded bg-indigo-50 border-indigo-100" value={massDestId} onChange={e => setMassDestId(e.target.value)}>
                                    <option value="">-- Choisir --</option>
                                    {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 shrink-0">
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-500 mb-1">Article à ajouter</label>
                                    <select className="w-full p-1.5 border border-gray-300 rounded text-sm" value={massTempArticleId} onChange={e => { setMassTempArticleId(e.target.value); setMassTempVariant(''); }}>
                                        <option value="">-- Sélectionner --</option>
                                        {articles.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                                    </select>
                                </div>
                                {massSelectedArticleObj && massSelectedArticleObj.variantes.length > 0 && (
                                    <div className="w-1/3">
                                        <label className="block text-xs text-gray-500 mb-1">Variante</label>
                                        <select className="w-full p-1.5 border border-gray-300 rounded text-sm" value={massTempVariant} onChange={e => setMassTempVariant(e.target.value)}>
                                            <option value="">-- Choisir --</option>
                                            {massSelectedArticleObj.variantes.map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="w-20">
                                    <label className="block text-xs text-gray-500 mb-1">Qté</label>
                                    <input type="number" className="w-full p-1.5 border border-gray-300 rounded text-sm" value={massTempQty} onChange={e => setMassTempQty(parseInt(e.target.value) || 0)} />
                                </div>
                                <button onClick={handleAddToMassList} className="bg-indigo-600 text-white p-1.5 rounded hover:bg-indigo-700"><Plus size={20}/></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg mb-4">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0">
                                    <tr>
                                        <th className="p-2">Article</th>
                                        <th className="p-2">Variante</th>
                                        <th className="p-2 text-center">Quantité</th>
                                        <th className="p-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {massTransferList.map(item => (
                                        <tr key={item.tempId} className="border-b border-gray-100 last:border-0">
                                            <td className="p-2 font-medium">{item.articleNom}</td>
                                            <td className="p-2 text-gray-500">{item.variante}</td>
                                            <td className="p-2 text-center font-bold">{item.quantite} {item.unite}</td>
                                            <td className="p-2 text-center"><button onClick={() => handleRemoveFromMassList(item.tempId)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                    {massTransferList.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400 italic">La liste est vide.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsMassTransferModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={executeMassTransfer} disabled={massTransferList.length === 0} className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold disabled:opacity-50">Confirmer Transfert ({massTransferList.length})</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL BOUTIQUE --- */}
            {isBoutiqueModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                            <Building className="text-gray-700" /> Nouvelle Boutique
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={newBoutique.nom} onChange={e => setNewBoutique({...newBoutique, nom: e.target.value})} placeholder="Ex: Boutique Centre-Ville" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu / Adresse</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={newBoutique.lieu} onChange={e => setNewBoutique({...newBoutique, lieu: e.target.value})} placeholder="Ex: Dakar, Plateau" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsBoutiqueModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleSaveBoutique} className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 font-bold">Créer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockView;