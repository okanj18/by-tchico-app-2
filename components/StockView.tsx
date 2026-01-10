
import React, { useState, useMemo } from 'react';
import { Article, Boutique, MouvementStock, TypeMouvement, RoleEmploye } from '../types';
import { Box, ArrowRightLeft, History, AlertTriangle, Building, Search, Package, X, Save, TrendingUp, TrendingDown, BarChart2, Filter, Edit, Layers, Plus, Trash2, LayoutGrid, List, CheckCircle, AlertOctagon, ArrowRight, Eye, Settings2 } from 'lucide-react';

interface StockViewProps {
    articles: Article[];
    boutiques: Boutique[];
    mouvements: MouvementStock[];
    userRole: RoleEmploye;
    onAddMouvement: (m: MouvementStock) => void;
    onAddBoutique: (b: Boutique) => void;
    onUpdateBoutique?: (b: Boutique) => void;
    onDeleteBoutique?: (id: string) => void;
}

const StockView: React.FC<StockViewProps> = ({ articles, boutiques, mouvements, userRole, onAddMouvement, onAddBoutique, onUpdateBoutique, onDeleteBoutique }) => {
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
    const [isManageBoutiquesModalOpen, setIsManageBoutiquesModalOpen] = useState(false);
    const [selectedArticleForDetail, setSelectedArticleForDetail] = useState<Article | null>(null); 

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
    const [editingBoutiqueId, setEditingBoutiqueId] = useState<string | null>(null);

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
        return Object.values(variants).reduce((acc: number, qty: any) => acc + (qty as number), 0);
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
            alert("Veuillez remplir tous les champs.");
            return;
        }
        if (selectedSourceId === selectedDestId) {
            alert("Source et destination identiques.");
            return;
        }
        const article = articles.find(a => a.id === selectedArticleId);
        if (!article) return;
        const variantToMove = selectedVariant || 'Standard';
        const stockSource = article.stockParLieu[selectedSourceId]?.[variantToMove] || 0;

        if (stockSource < quantity) {
            alert(`Stock insuffisant (${stockSource} dispo).`);
            return;
        }

        const mTransfer: MouvementStock = {
            id: `M${Date.now()}_TR_${Math.random().toString(36).substr(2, 5)}`,
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
        onAddMouvement(mTransfer);
        setIsTransferModalOpen(false);
        resetForm();
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
                alert(`Stock insuffisant.`);
                return;
            }
        }
        const mAdj: MouvementStock = {
            id: `M${Date.now()}_ADJ_${Math.random().toString(36).substr(2, 5)}`,
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

    const selectedArticleObj = articles.find(a => a.id === selectedArticleId);
    const massSelectedArticleObj = articles.find(a => a.id === massTempArticleId);

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
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

            {viewMode === 'LEVELS' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between"><div><p className="text-xs text-gray-500 uppercase font-bold">Total Références</p><p className="text-2xl font-bold text-gray-900">{articles.length}</p></div><Box size={24} className="text-gray-300"/></div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm flex items-center justify-between"><div><p className="text-xs text-green-700 uppercase font-bold">En Stock</p><p className="text-2xl font-bold text-green-800">{stats.available}</p></div><CheckCircle size={24} className="text-green-300"/></div>
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 shadow-sm flex items-center justify-between"><div><p className="text-xs text-orange-700 uppercase font-bold">Stock Faible</p><p className="text-2xl font-bold text-orange-800">{stats.low}</p></div><AlertTriangle size={24} className="text-orange-300"/></div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm flex items-center justify-between"><div><p className="text-xs text-red-700 uppercase font-bold">Rupture Stock</p><p className="text-2xl font-bold text-red-800">{stats.out}</p></div><AlertOctagon size={24} className="text-red-300"/></div>
                </div>
            )}

            <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                    <div className="relative flex-1 sm:min-w-[250px]">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input type="text" placeholder={viewMode === 'LEVELS' ? "Rechercher un article..." : "Rechercher un mouvement..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500" />
                    </div>
                </div>

                {canManageStock && (
                    <div className="flex gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                        <button onClick={() => { resetForm(); setIsTransferModalOpen(true); }} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm"><ArrowRightLeft size={16} /> Transfert</button>
                        <button onClick={() => { resetForm(); setIsAdjustmentModalOpen(true); }} className="flex-1 sm:flex-none bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm"><AlertTriangle size={16} /> Ajustement</button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-gray-200">
                {viewMode === 'LEVELS' ? (
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
                                    <th className="py-3 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredArticles.map(article => {
                                    const total = getArticleTotal(article);
                                    const statusColor = total === 0 ? 'text-red-500' : total <= article.seuilAlerte ? 'text-orange-500' : 'text-green-600';
                                    return (
                                        <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3 px-4 font-bold text-gray-800 uppercase tracking-tighter">{article.nom}</td>
                                            <td className="py-3 px-4 text-gray-500 text-[10px] font-black uppercase">{article.categorie}</td>
                                            <td className={`py-3 px-4 text-center font-black ${statusColor} bg-gray-50/50`}>{total} {article.unite}</td>
                                            {boutiques.map(b => {
                                                const shopTotal = getArticleTotalInShop(article, b.id);
                                                return (
                                                    <td key={b.id} className="py-3 px-4 text-center border-l border-gray-100 text-gray-700 font-bold">
                                                        {shopTotal > 0 ? shopTotal : <span className="text-gray-200">-</span>}
                                                    </td>
                                                );
                                            })}
                                            <td className="py-3 px-4 text-center">
                                                <button 
                                                    onClick={() => setSelectedArticleForDetail(article)}
                                                    className="p-2 text-brand-600 hover:bg-brand-50 rounded-xl transition-all border border-transparent hover:border-brand-100"
                                                    title="Détails par variante"
                                                >
                                                    <Eye size={18}/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0 z-10 border-b border-gray-200">
                                <tr>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Article</th>
                                    <th className="py-3 px-4">Action</th>
                                    <th className="py-3 px-4">Quantité</th>
                                    <th className="py-3 px-4">Lieu</th>
                                    <th className="py-3 px-4">Commentaire</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredMouvements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (
                                    <tr key={m.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 text-[10px] font-bold text-gray-400">{new Date(m.date).toLocaleDateString()}</td>
                                        <td className="py-3 px-4 font-bold text-gray-800 uppercase text-xs">{m.articleNom} <span className="text-[10px] text-gray-400 font-normal">({m.variante})</span></td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border 
                                                ${m.type === TypeMouvement.VENTE || m.type === TypeMouvement.CONSOMMATION ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                                                  m.type === TypeMouvement.ACHAT || m.type === TypeMouvement.PRODUCTION ? 'bg-green-50 text-green-700 border-green-100' : 
                                                  'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                {m.type}
                                            </span>
                                        </td>
                                        <td className={`py-3 px-4 font-black ${m.quantite > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {m.quantite > 0 ? '+' : ''}{m.quantite}
                                        </td>
                                        <td className="py-3 px-4 text-gray-600 text-xs font-bold uppercase">
                                            {boutiques.find(b => b.id === m.lieuId)?.nom || 'Inconnu'} 
                                            {m.lieuDestinationId && <span className="text-gray-300"> → {boutiques.find(b => b.id === m.lieuDestinationId)?.nom}</span>}
                                        </td>
                                        <td className="py-3 px-4 text-gray-400 text-[10px] font-medium italic">{m.commentaire}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL DÉTAILS PAR VARIANTE - ACTIVÉ */}
            {selectedArticleForDetail && (
                <div className="fixed inset-0 bg-brand-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in border border-brand-100">
                        <div className="p-8 border-b flex justify-between items-center bg-white shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">{selectedArticleForDetail.nom}</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">{selectedArticleForDetail.categorie}</p>
                            </div>
                            <button onClick={() => setSelectedArticleForDetail(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={28} className="text-gray-400"/></button>
                        </div>
                        <div className="p-8 overflow-y-auto max-h-[70vh] custom-scrollbar bg-gray-50/30">
                            <div className="space-y-4">
                                {selectedArticleForDetail.variantes.length > 0 ? (
                                    selectedArticleForDetail.variantes.map(variant => (
                                        <div key={variant} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm group hover:border-brand-300 transition-all">
                                            <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-3">
                                                <span className="font-black text-brand-900 uppercase text-xs tracking-widest">{variant}</span>
                                                <span className="text-lg font-black text-gray-800">
                                                    {Object.values(selectedArticleForDetail.stockParLieu).reduce((acc: number, p: any) => acc + (p[variant] || 0), 0)} {selectedArticleForDetail.unite}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {boutiques.map(b => {
                                                    const q = selectedArticleForDetail.stockParLieu[b.id]?.[variant] || 0;
                                                    return (
                                                        <div key={b.id} className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 text-center">
                                                            <p className="text-[8px] font-black text-gray-400 uppercase mb-1 truncate">{b.nom}</p>
                                                            <p className={`text-sm font-black ${q > 0 ? 'text-gray-800' : 'text-gray-200'}`}>{q}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                                            <span className="font-black text-brand-900 uppercase text-xs tracking-widest">STOCK STANDARD</span>
                                            <span className="text-2xl font-black text-gray-800">
                                                {Object.values(selectedArticleForDetail.stockParLieu).reduce((acc: number, p: any) => acc + (p['Standard'] || 0), 0)} {selectedArticleForDetail.unite}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {boutiques.map(b => {
                                                const q = selectedArticleForDetail.stockParLieu[b.id]?.['Standard'] || 0;
                                                return (
                                                    <div key={b.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1 truncate">{b.nom}</p>
                                                        <p className={`text-xl font-black ${q > 0 ? 'text-brand-900' : 'text-gray-200'}`}>{q}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex justify-end shrink-0">
                            <button onClick={() => setSelectedArticleForDetail(null)} className="px-10 py-3 bg-brand-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Fermer la fiche</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TRANSFERT */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-brand-100">
                        <div className="flex justify-between items-center mb-6 shrink-0 border-b pb-4">
                            <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3 text-blue-600"><ArrowRightLeft /> Transfert de Stock</h3>
                            <button onClick={() => setIsTransferModalOpen(false)}><X size={28} className="text-gray-300"/></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Article</label>
                                <select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black uppercase text-xs" value={selectedArticleId} onChange={e => setSelectedArticleId(e.target.value)}><option value="">-- Choisir Article --</option>{articles.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>
                            </div>
                            {selectedArticleObj && selectedArticleObj.variantes.length > 0 && (
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Variante / Taille</label>
                                    <select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black uppercase text-xs" value={selectedVariant} onChange={e => setSelectedVariant(e.target.value)}><option value="">-- Choisir Variante --</option>{selectedArticleObj.variantes.map(v => <option key={v} value={v}>{v}</option>)}</select>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Origine</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-black uppercase text-[10px]" value={selectedSourceId} onChange={e => setSelectedSourceId(e.target.value)}><option value="">-- De --</option>{boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}</select></div>
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Destination</label><select className="w-full p-3 border-2 border-gray-100 rounded-xl font-black uppercase text-[10px]" value={selectedDestId} onChange={e => setSelectedDestId(e.target.value)}><option value="">-- Vers --</option>{boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}</select></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Quantité</label><input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-brand-600" value={quantity || ''} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} /></div>
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Motif</label><input type="text" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold text-xs" value={reason} onChange={e => setReason(e.target.value)} placeholder="Réassort..."/></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t shrink-0">
                            <button onClick={() => setIsTransferModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button>
                            <button onClick={handleTransfer} disabled={!selectedArticleId || !selectedSourceId || !selectedDestId || quantity <= 0} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-30">Confirmer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL AJUSTEMENT */}
            {isAdjustmentModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-brand-100">
                        <div className="flex justify-between items-center mb-6 shrink-0 border-b pb-4">
                            <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3 text-orange-600"><AlertTriangle /> Ajustement de Stock</h3>
                            <button onClick={() => setIsAdjustmentModalOpen(false)}><X size={28} className="text-gray-300"/></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setAdjustmentType('ADD')} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${adjustmentType === 'ADD' ? 'bg-green-50 border-green-600 text-green-700 shadow-sm' : 'bg-white border-gray-100 text-gray-300'}`}>Ajouter (+)</button>
                                <button onClick={() => setAdjustmentType('REMOVE')} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${adjustmentType === 'REMOVE' ? 'bg-red-50 border-red-600 text-red-700 shadow-sm' : 'bg-white border-gray-100 text-gray-300'}`}>Retirer (-)</button>
                            </div>
                            <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Article</label>
                                <select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black uppercase text-xs" value={selectedArticleId} onChange={e => setSelectedArticleId(e.target.value)}><option value="">-- Choisir Article --</option>{articles.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</select>
                            </div>
                            {selectedArticleObj && selectedArticleObj.variantes.length > 0 && (
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Variante spécifique</label>
                                    <select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black uppercase text-xs" value={selectedVariant} onChange={e => setSelectedVariant(e.target.value)}><option value="">-- Choisir Variante --</option>{selectedArticleObj.variantes.map(v => <option key={v} value={v}>{v}</option>)}</select>
                                </div>
                            )}
                            <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Lieu concerné</label>
                                <select className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black uppercase text-xs" value={selectedSourceId} onChange={e => setSelectedSourceId(e.target.value)}><option value="">-- Choisir Emplacement --</option>{boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}</select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Quantité</label><input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-orange-600" value={quantity || ''} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} /></div>
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block ml-1">Raison (Requis)</label><input type="text" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold text-xs" value={reason} onChange={e => setReason(e.target.value)} placeholder="Perte, Inventaire..."/></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t shrink-0">
                            <button onClick={() => setIsAdjustmentModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button>
                            <button onClick={handleAdjustment} disabled={!selectedArticleId || !selectedSourceId || !reason || quantity <= 0} className="px-10 py-4 bg-orange-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-30">Valider</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockView;
