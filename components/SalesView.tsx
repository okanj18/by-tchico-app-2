
import React, { useState, useMemo, useEffect } from 'react';
import { Article, Boutique, Client, Commande, StatutCommande, ModePaiement, CompteFinancier, CompanyAssets } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Search, ShoppingCart, User, Printer, History, X, CheckCircle, AlertTriangle, Plus, Trash2, Wallet, Ban, FileText, Minus, Save, UserX, ClipboardList, Layers, DollarSign } from 'lucide-react';

interface SalesViewProps {
    articles: Article[];
    boutiques: Boutique[];
    clients: Client[];
    commandes: Commande[];
    onMakeSale: (saleData: any) => void;
    onAddPayment: (orderId: string, amount: number, method: ModePaiement, note: string, date: string, accountId?: string) => void;
    comptes: CompteFinancier[];
    onCancelSale: (orderId: string, refundAccountId: string) => void;
    companyAssets?: CompanyAssets;
}

const SalesView: React.FC<SalesViewProps> = ({ 
    articles, boutiques, clients, commandes, onMakeSale, onAddPayment, comptes, onCancelSale, companyAssets 
}) => {
    // --- STATE ---
    const [cart, setCart] = useState<{ id: string, articleId: string, variante: string, nom: string, prix: number, quantite: number }[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedBoutiqueId, setSelectedBoutiqueId] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [amountPaid, setAmountPaid] = useState<number>(0);
    const [accountId, setAccountId] = useState<string>(''); 
    const [tvaEnabled, setTvaEnabled] = useState(false);
    const [remise, setRemise] = useState<number>(0);

    const [activeTab, setActiveTab] = useState<'POS' | 'HISTORY'>('POS');
    const [productSearch, setProductSearch] = useState('');
    const [historySearch, setHistorySearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('TOUT');

    // Modal States
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Commande | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<Commande | null>(null);
    const [refundAccountId, setRefundAccountId] = useState<string>(''); 

    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payAccount, setPayAccount] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (boutiques.length > 0 && !selectedBoutiqueId) {
            setSelectedBoutiqueId(boutiques[0].id);
        }
    }, [boutiques]);

    const filteredArticles = useMemo(() => {
        return articles.filter(a => 
            a.typeArticle === 'PRODUIT_FINI' && 
            (selectedCategory === 'TOUT' || a.categorie === selectedCategory) &&
            (a.nom.toLowerCase().includes(productSearch.toLowerCase()) || a.categorie.toLowerCase().includes(productSearch.toLowerCase())) &&
            !a.archived
        );
    }, [articles, productSearch, selectedCategory]);

    const categories = ['TOUT', ...Array.from(new Set(articles.filter(a => a.typeArticle === 'PRODUIT_FINI').map(a => a.categorie)))];

    const salesHistory = useMemo(() => {
        return commandes
            .filter(c => c.type === 'PRET_A_PORTER')
            .filter(c => c.clientNom.toLowerCase().includes(historySearch.toLowerCase()) || c.id.toLowerCase().includes(historySearch.toLowerCase()))
            .sort((a,b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, historySearch]);

    const cartTotal = cart.reduce((acc, item) => acc + (item.prix * item.quantite), 0);
    const tvaAmount = tvaEnabled ? Math.round((cartTotal - remise) * COMPANY_CONFIG.tvaRate) : 0;
    const finalTotal = Math.max(0, cartTotal - remise + tvaAmount);

    // --- ACTIONS ---
    const addToCart = (article: Article, variant: string = 'Standard') => {
        if (!selectedBoutiqueId) {
            alert("Veuillez sélectionner une boutique avant d'ajouter des produits.");
            return;
        }

        const shopStock = (article.stockParLieu[selectedBoutiqueId] || {}) as Record<string, number>;
        const stock = shopStock[variant] || 0;
        const inCart = cart.find(i => i.articleId === article.id && i.variante === variant)?.quantite || 0;

        if (stock <= inCart) {
            alert(`Stock insuffisant pour ${article.nom} (${variant}) à la boutique sélectionnée. Disponible: ${stock}`);
            return;
        }

        const existingItem = cart.find(i => i.articleId === article.id && i.variante === variant);
        if (existingItem) {
            setCart(cart.map(i => i.articleId === article.id && i.variante === variant ? { ...i, quantite: i.quantite + 1 } : i));
        } else {
            setCart([...cart, { 
                id: `item_${Date.now()}_${Math.random()}`,
                articleId: article.id, 
                variante: variant, 
                nom: article.nom, 
                prix: article.prixVenteDefault, 
                quantite: 1 
            }]);
        }
    };

    const removeFromCart = (itemId: string) => setCart(cart.filter(i => i.id !== itemId));

    const updateQuantity = (itemId: string, delta: number) => {
        setCart(cart.map(i => {
            if (i.id === itemId) {
                const newQty = i.quantite + delta;
                if (selectedBoutiqueId && delta > 0) {
                    const article = articles.find(a => a.id === i.articleId);
                    if (article) {
                        const shopStock = (article.stockParLieu[selectedBoutiqueId] || {}) as Record<string, number>;
                        const stock = shopStock[i.variante] || 0;
                        if (stock < newQty) {
                            alert(`Stock insuffisant pour cette quantité.`);
                            return i;
                        }
                    }
                }
                if (newQty <= 0) return i; 
                return { ...i, quantite: newQty };
            }
            return i;
        }));
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;
        if (!selectedBoutiqueId) { alert("Veuillez sélectionner une boutique."); return; }
        if (!accountId && amountPaid > 0) { alert("Veuillez sélectionner un compte d'encaissement."); return; }

        if (!selectedClientId && amountPaid < finalTotal) {
            alert("⚠️ Un client de passage doit régler la totalité immédiatement.");
            return;
        }

        const client = clients.find(c => c.id === selectedClientId);
        onMakeSale({
            clientId: selectedClientId || null, clientName: client ? client.nom : "Client de passage",
            items: cart, total: finalTotal, tva: tvaAmount, tvaRate: tvaEnabled ? (COMPANY_CONFIG.tvaRate * 100) : 0,
            remise: remise, montantRecu: amountPaid, boutiqueId: selectedBoutiqueId, method: paymentMethod, accountId: accountId
        });
        setCart([]); setAmountPaid(0); setRemise(0); setSelectedClientId(''); setActiveTab('HISTORY'); 
    };

    const openPaymentModal = (order: Commande) => {
        setSelectedOrderForPayment(order); setPayAmount(order.reste); setPayAccount(''); 
        setPayDate(new Date().toISOString().split('T')[0]); setPaymentModalOpen(true);
    };

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || payAmount <= 0 || !payAccount) return;
        onAddPayment(selectedOrderForPayment.id, payAmount, payMethod, "Règlement solde vente boutique", payDate, payAccount);
        setPaymentModalOpen(false); setSelectedOrderForPayment(null);
    };

    const generatePrintContent = (order: Commande, mode: 'TICKET' | 'DEVIS' | 'LIVRAISON' = 'TICKET') => {
        const printWindow = window.open('', '', 'width=400,height=600');
        if (!printWindow) return;
        const itemsHtml = order.detailsVente?.map(item => `<div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>${item.nomArticle} ${item.variante !== 'Standard' ? '(' + item.variante + ')' : ''} x${item.quantite}</span><span>${(item.quantite * item.prixUnitaire).toLocaleString()}</span></div>`).join('') || '';
        const logoUrl = companyAssets?.logoStr || `${window.location.origin}${COMPANY_CONFIG.logoUrl}`;
        const html = `<html><head><title>Impression Doc</style></head><body><div style="font-family:monospace; font-size:12px;"><div style="text-align:center"><img src="${logoUrl}" style="max-height:60px"/><br/><h3>${COMPANY_CONFIG.name}</h3><p>${COMPANY_CONFIG.address}</p><h4>${mode} #${order.id.slice(-6)}</h4></div><div style="border-top:1px dashed #000; padding:10px 0">${itemsHtml}</div><div style="border-top:1px dashed #000; padding:10px 0; font-weight:bold; font-size:14px;"><div style="display:flex; justify-content:space-between"><span>TOTAL TTC</span><span>${order.prixTotal.toLocaleString()} F</span></div></div></div><script>window.print();</script></body></html>`;
        printWindow.document.write(html); printWindow.document.close();
    };

    const openCancelModal = (order: Commande) => {
        setSelectedOrderForCancel(order); setRefundAccountId(''); setIsCancelModalOpen(true);
    };

    const handleConfirmCancel = () => {
        if (!selectedOrderForCancel) return;
        if (selectedOrderForCancel.avance > 0 && !refundAccountId) { alert("Choisir compte source pour le remboursement."); return; }
        onCancelSale(selectedOrderForCancel.id, refundAccountId);
        setIsCancelModalOpen(false); setSelectedOrderForCancel(null);
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
            <div className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('POS')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'POS' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}><ShoppingCart size={18} /> Point de Vente</button>
                    <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'HISTORY' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}><History size={18} /> Historique</button>
                </div>
                <div className="flex items-center gap-4">
                    <select className="p-2 border border-brand-200 rounded-lg text-sm bg-brand-50 font-bold text-brand-900" value={selectedBoutiqueId} onChange={(e) => { setSelectedBoutiqueId(e.target.value); setCart([]); }}>{boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}</select>
                </div>
            </div>

            {activeTab === 'POS' && (
                <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-gray-100 space-y-2 shrink-0">
                            <div className="flex gap-2">
                                <div className="relative flex-1"><Search className="absolute left-3 top-2 text-gray-400" size={16} /><input type="text" placeholder="Rechercher produit..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm"/></div>
                                <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar items-center">{categories.map(cat => (<button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategory === cat ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{cat}</button>))}</div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 align-content-start">
                            {filteredArticles.map(article => {
                                const hasVariants = article.variantes && article.variantes.length > 0;
                                const shopStockRec = (article.stockParLieu[selectedBoutiqueId] || {}) as Record<string, number>;
                                const totalStockInShop = (Object.values(shopStockRec) as number[]).reduce((acc: number, q: number) => acc + q, 0);

                                return (
                                    <div key={article.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3 hover:shadow-md transition-shadow flex flex-col">
                                        <div className="h-24 bg-white rounded mb-2 flex items-center justify-center overflow-hidden border border-gray-100 relative">
                                            {article.images && article.images.length > 0 ? (<img src={article.images[0]} alt={article.nom} className="w-full h-full object-cover" />) : (<ShoppingCart className="text-gray-300" size={32} />)}
                                            <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-brand-900 text-white text-[10px] font-black rounded-md shadow-sm">STOCK: {totalStockInShop}</div>
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-xs line-clamp-1 mb-1">{article.nom}</h4>
                                        <div className="mt-auto">
                                            <p className="font-black text-brand-600 text-sm mb-2">{article.prixVenteDefault.toLocaleString()} F</p>
                                            
                                            {hasVariants ? (
                                                <div className="grid grid-cols-2 gap-1">
                                                    {article.variantes.map(v => {
                                                        const vStock = shopStockRec[v] || 0;
                                                        return (
                                                            <button 
                                                                key={v} 
                                                                onClick={() => addToCart(article, v)} 
                                                                disabled={vStock <= 0}
                                                                className={`py-1 rounded-[4px] text-[9px] font-bold border transition-all ${vStock > 0 ? 'bg-white border-brand-200 text-brand-900 hover:bg-brand-900 hover:text-white' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`}
                                                            >
                                                                {v} ({vStock})
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <button onClick={() => addToCart(article)} disabled={totalStockInShop <= 0} className="w-full py-1.5 rounded text-[10px] font-bold bg-gray-800 text-white disabled:opacity-30">Ajouter (Standard)</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="w-full lg:w-[380px] bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><ShoppingCart size={20} className="text-brand-600" /> Panier</h3><button onClick={() => setCart([])} className="text-[10px] font-black text-red-500 uppercase">Vider</button></div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                    <div className="flex-1"><h4 className="font-bold text-xs text-gray-800 line-clamp-1">{item.nom}</h4><p className="text-[10px] text-gray-500">{item.variante} • {item.prix.toLocaleString()} F</p></div>
                                    <div className="flex items-center gap-1.5 bg-gray-100 rounded px-1"><button onClick={() => updateQuantity(item.id, -1)} className="w-5 h-5 flex items-center justify-center text-gray-600 hover:bg-white rounded"><Minus size={10}/></button><span className="text-xs font-black w-4 text-center">{item.quantite}</span><button onClick={() => updateQuantity(item.id, 1)} className="w-5 h-5 flex items-center justify-center text-gray-600 hover:bg-white rounded"><Plus size={10}/></button></div>
                                    <button onClick={() => removeFromCart(item.id)} className="text-red-400"><Trash2 size={16} /></button>
                                </div>
                            ))}
                            {cart.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50 py-20"><ShoppingCart size={48}/><p className="text-xs font-black uppercase mt-4">Panier vide</p></div>}
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3 shrink-0">
                            <div className="grid grid-cols-2 gap-2"><select className="text-[10px] p-2 border rounded font-black uppercase" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}><option value="">Client de Passage</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select><div className="flex items-center gap-2 bg-white px-2 border rounded"><input type="checkbox" checked={tvaEnabled} onChange={(e) => setTvaEnabled(e.target.checked)} className="rounded text-brand-600"/><span className="text-[10px] font-black uppercase">TVA ({COMPANY_CONFIG.tvaRate*100}%)</span></div></div>
                            <div className="border-t border-gray-200 pt-2 flex justify-between items-end"><span className="text-sm font-black text-gray-500 uppercase">Total à payer</span><span className="text-xl font-black text-brand-600">{finalTotal.toLocaleString()} F</span></div>
                            <div className="space-y-2 pt-2 border-t border-gray-200">
                                <div className="flex gap-2"><select className="flex-1 p-2 border rounded text-xs font-black uppercase" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as ModePaiement)}><option value="ESPECE">Espèce</option><option value="WAVE">Wave</option><option value="ORANGE_MONEY">Orange Money</option></select><input type="number" className="flex-1 p-2 border rounded text-xs font-black text-right bg-white" placeholder="Recu (F)" value={amountPaid || ''} onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)}/></div>
                                <select className="w-full p-2 border border-brand-200 rounded text-[10px] font-black uppercase bg-white text-brand-900" value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">-- Caisse de destination --</option>{comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>))}</select>
                            </div>
                            <button onClick={handleCheckout} disabled={cart.length === 0 || !selectedBoutiqueId} className="w-full bg-brand-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black disabled:opacity-30 transition-all flex items-center justify-center gap-2">Finaliser la Vente</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'HISTORY' && (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex gap-4 bg-gray-50"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-gray-400" size={18} /><input type="text" placeholder="Rechercher par client ou ID..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}/></div></div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 uppercase text-[10px] tracking-widest"><tr><th className="py-3 px-4">Date</th><th className="py-3 px-4">Client</th><th className="py-3 px-4">Articles</th><th className="py-3 px-4 text-right">Total</th><th className="py-3 px-4 text-center">Actions</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {salesHistory.map(sale => {
                                    const isCancelled = sale.statut === StatutCommande.ANNULE;
                                    return (
                                        <tr key={sale.id} className={`hover:bg-gray-50 transition-colors ${isCancelled ? 'opacity-50 grayscale bg-gray-50' : ''}`}>
                                            <td className="py-3 px-4 text-gray-500 text-xs">
                                                {new Date(sale.dateCommande).toLocaleDateString()}
                                                {isCancelled && <span className="block text-[8px] font-black text-red-600 uppercase">Annulé</span>}
                                            </td>
                                            <td className="py-3 px-4 font-bold text-gray-800 uppercase text-xs">{sale.clientNom}</td>
                                            <td className="py-3 px-4 text-gray-400 text-xs truncate max-w-xs">{sale.description}</td>
                                            <td className="py-3 px-4 text-right font-black text-brand-900">{sale.prixTotal.toLocaleString()} F</td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => generatePrintContent(sale, 'TICKET')} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="Imprimer Ticket"><Printer size={16}/></button>
                                                    <button onClick={() => setSelectedOrderDetails(sale)} className="p-1.5 hover:bg-gray-100 rounded text-blue-600" title="Voir Détails et Versements"><FileText size={16} /></button>
                                                    {!isCancelled && sale.reste > 0 && (
                                                        <button onClick={() => openPaymentModal(sale)} className="p-1.5 hover:bg-gray-100 rounded text-green-600" title="Encaisser le solde"><Wallet size={16}/></button>
                                                    )}
                                                    {!isCancelled && (
                                                        <button onClick={() => openCancelModal(sale)} className="p-1.5 text-red-400 hover:text-red-600" title="Annuler la vente"><Ban size={16}/></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL DETAILS VENTE & HISTORIQUE VERSEMENTS */}
            {selectedOrderDetails && (
                <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col h-[80vh] overflow-hidden">
                        <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 uppercase">Détails Vente #{selectedOrderDetails.id.slice(-6)}</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{new Date(selectedOrderDetails.dateCommande).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setSelectedOrderDetails(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={24}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* Recap Client */}
                            <div className="bg-brand-50 p-4 rounded-xl border border-brand-100">
                                <h4 className="text-[10px] font-black text-brand-800 uppercase mb-2">Client</h4>
                                <p className="font-black text-brand-900 uppercase text-sm">{selectedOrderDetails.clientNom}</p>
                            </div>

                            {/* Liste Articles */}
                            <div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Articles vendus</h4>
                                <div className="space-y-2">
                                    {selectedOrderDetails.detailsVente?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 text-xs font-bold">
                                            <span>{item.nomArticle} ({item.variante}) x{item.quantite}</span>
                                            <span className="text-gray-900">{(item.quantite * item.prixUnitaire).toLocaleString()} F</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* HISTORIQUE DES VERSEMENTS */}
                            <div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <History size={14} className="text-brand-600"/> Historique des versements
                                </h4>
                                <div className="space-y-3">
                                    {selectedOrderDetails.paiements && selectedOrderDetails.paiements.length > 0 ? (
                                        selectedOrderDetails.paiements.map((p, idx) => (
                                            <div key={p.id || idx} className="flex justify-between items-center p-3 bg-green-50 border-l-4 border-green-600 rounded-r-lg">
                                                <div>
                                                    <p className="text-[10px] font-black text-green-900 uppercase">{p.moyenPaiement} {p.note && `• ${p.note}`}</p>
                                                    <p className="text-[9px] text-green-700 font-bold">{new Date(p.date).toLocaleDateString()} à {new Date(p.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                                </div>
                                                <span className="font-black text-green-700">+{p.montant.toLocaleString()} F</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-gray-400 text-[10px] italic py-4">Aucun versement enregistré.</p>
                                    )}
                                </div>
                            </div>

                            {/* Recap Finance */}
                            <div className="pt-6 border-t border-gray-100 space-y-2">
                                <div className="flex justify-between text-xs font-black text-gray-400 uppercase"><span>Total Facturé</span><span>{selectedOrderDetails.prixTotal.toLocaleString()} F</span></div>
                                <div className="flex justify-between text-xs font-black text-green-600 uppercase"><span>Montant Encaissé</span><span>{selectedOrderDetails.avance.toLocaleString()} F</span></div>
                                <div className={`flex justify-between text-lg font-black p-4 rounded-xl mt-4 ${selectedOrderDetails.reste > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                                    <span className="uppercase text-xs tracking-widest">Reste à percevoir</span>
                                    <span>{selectedOrderDetails.reste.toLocaleString()} F</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex justify-end">
                            <button onClick={() => setSelectedOrderDetails(null)} className="px-8 py-3 bg-gray-800 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg">Fermer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PAIEMENT SOLDE */}
            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-black/60 z-[400] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
                        <div className="flex justify-between items-center mb-8 border-b pb-4">
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3">
                                <Wallet size={24} className="text-green-600"/> Encaisser Solde
                            </h3>
                            <button onClick={() => setPaymentModalOpen(false)}><X size={24} className="text-gray-400"/></button>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex justify-between items-center">
                                <span className="text-xs font-black text-orange-800 uppercase tracking-widest">Reste Dû</span>
                                <span className="text-xl font-black text-orange-900">{selectedOrderForPayment.reste.toLocaleString()} F</span>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Montant perçu</label>
                                <input type="number" className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black text-2xl bg-gray-50 focus:border-green-600 outline-none transition-all" value={payAmount} onChange={e => setPayAmount(Math.min(selectedOrderForPayment.reste, parseInt(e.target.value) || 0))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Caisse de Destination</label>
                                <select className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-gray-50 text-sm font-bold" value={payAccount} onChange={e => setPayAccount(e.target.value)}>
                                    <option value="">-- Choisir un compte --</option>
                                    {comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Mode de Paiement</label>
                                <select className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-gray-50 text-sm font-bold uppercase" value={payMethod} onChange={e => setPayMethod(e.target.value as ModePaiement)}>
                                    <option value="ESPECE">Espèce</option>
                                    <option value="WAVE">Wave</option>
                                    <option value="ORANGE_MONEY">Orange Money</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10">
                            <button onClick={() => setPaymentModalOpen(false)} className="px-6 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-gray-600">Annuler</button>
                            <button onClick={handleConfirmPayment} disabled={!payAccount || payAmount <= 0} className="px-10 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ANNULATION VENTE */}
            {isCancelModalOpen && selectedOrderForCancel && (
                <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-10 text-center border-t-8 border-red-500">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6"><Ban size={40}/></div>
                        <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tighter">Annulation Vente</h3>
                        <p className="text-sm text-gray-500 mb-8 font-bold">Confirmer l'annulation de la vente pour <span className="text-gray-900 uppercase">{selectedOrderForCancel.clientNom}</span> ?</p>
                        
                        {selectedOrderForCancel.avance > 0 && (
                            <div className="mb-8 text-left bg-red-50 p-6 rounded-2xl border border-red-100">
                                <label className="block text-[10px] font-black text-red-800 uppercase tracking-widest mb-3 text-center">Compte de remboursement ({selectedOrderForCancel.avance.toLocaleString()} F)</label>
                                <select className="w-full p-4 border-2 border-white rounded-xl text-xs font-bold shadow-sm" value={refundAccountId} onChange={e => setRefundAccountId(e.target.value)}>
                                    <option value="">-- Choisir Caisse Source --</option>
                                    {comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>))}
                                </select>
                            </div>
                        )}
                        
                        <div className="flex flex-col gap-3">
                            <button onClick={handleConfirmCancel} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95">Confirmer l'Annulation</button>
                            <button onClick={() => { setIsCancelModalOpen(false); setSelectedOrderForCancel(null); }} className="w-full py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Garder la vente</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesView;
