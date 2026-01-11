
import React, { useState, useMemo, useEffect } from 'react';
import { Article, Boutique, Client, Commande, StatutCommande, ModePaiement, CompteFinancier, CompanyAssets, SessionUser } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Search, ShoppingCart, User, Printer, History, X, CheckCircle, AlertTriangle, Plus, Trash2, Wallet, Ban, FileText, Minus, Save, UserX, ClipboardList, Layers, DollarSign, Store, Tag } from 'lucide-react';

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
    currentUser: SessionUser | null;
}

const SalesView: React.FC<SalesViewProps> = ({ 
    articles, boutiques, clients, commandes, onMakeSale, onAddPayment, comptes, onCancelSale, companyAssets, currentUser 
}) => {
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
        if (currentUser?.boutiqueId) {
            setSelectedBoutiqueId(currentUser.boutiqueId);
            const shopAccount = comptes.find(c => c.boutiqueId === currentUser.boutiqueId && c.type === 'CAISSE');
            if (shopAccount) setAccountId(shopAccount.id);
        } else if (boutiques.length > 0 && !selectedBoutiqueId) {
            setSelectedBoutiqueId(boutiques[0].id);
        }
    }, [currentUser, boutiques, comptes]);

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
            .filter(c => currentUser?.role === 'ADMIN' || currentUser?.role === 'GERANT' || c.boutiqueId === currentUser?.boutiqueId)
            .filter(c => c.clientNom.toLowerCase().includes(historySearch.toLowerCase()) || c.id.toLowerCase().includes(historySearch.toLowerCase()))
            .sort((a,b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, historySearch, currentUser]);

    const cartTotal = cart.reduce((acc, item) => acc + (item.prix * item.quantite), 0);
    const tvaAmount = tvaEnabled ? Math.round((cartTotal - remise) * COMPANY_CONFIG.tvaRate) : 0;
    const finalTotal = Math.max(0, cartTotal - remise + tvaAmount);

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
        setSelectedOrderForPayment(order); setPayAmount(order.reste); 
        const shopAccount = comptes.find(c => c.boutiqueId === order.boutiqueId && c.type === 'CAISSE');
        setPayAccount(shopAccount?.id || ''); 
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
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200">
                        <Store size={14} className="text-gray-400"/>
                        <select 
                            className="bg-transparent border-none text-sm font-bold text-gray-700 outline-none" 
                            value={selectedBoutiqueId} 
                            onChange={(e) => { setSelectedBoutiqueId(e.target.value); setCart([]); }}
                            disabled={currentUser?.role === 'VENDEUR' && !!currentUser?.boutiqueId}
                        >
                            {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                        </select>
                    </div>
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
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Client</label>
                                    <select className="text-[10px] p-2 border rounded font-black uppercase w-full bg-white" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                                        <option value="">Client de Passage</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Options</label>
                                    <div className="flex items-center gap-2 bg-white p-2 border rounded h-full">
                                        <input type="checkbox" checked={tvaEnabled} onChange={(e) => setTvaEnabled(e.target.checked)} className="rounded text-brand-600"/>
                                        <span className="text-[10px] font-black uppercase">TVA ({COMPANY_CONFIG.tvaRate*100}%)</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black text-red-500 uppercase ml-1 flex items-center gap-1"><Tag size={10}/> Remise (F)</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2 border border-red-100 rounded text-xs font-black text-red-600 bg-white" 
                                        placeholder="0" 
                                        value={remise || ''} 
                                        onChange={(e) => setRemise(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1 text-right">
                                    <label className="text-[9px] font-black text-gray-400 uppercase mr-1">Total TTC</label>
                                    <div className="text-xl font-black text-brand-600">
                                        {finalTotal.toLocaleString()} F
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-gray-200">
                                <div className="flex gap-2"><select className="flex-1 p-2 border rounded text-xs font-black uppercase" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as ModePaiement)}><option value="ESPECE">Espèce</option><option value="WAVE">Wave</option><option value="ORANGE_MONEY">Orange Money</option></select><input type="number" className="flex-1 p-2 border rounded text-xs font-black text-right bg-white" placeholder="Recu (F)" value={amountPaid || ''} onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)}/></div>
                                <select className="w-full p-2 border border-brand-200 rounded text-[10px] font-black uppercase bg-white text-brand-900" value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">-- Caisse de destination --</option>{comptes.filter(c => currentUser?.role === 'ADMIN' || currentUser?.role === 'GERANT' || c.boutiqueId === currentUser?.boutiqueId).map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>))}</select>
                            </div>
                            <button onClick={handleCheckout} disabled={cart.length === 0 || !selectedBoutiqueId} className="w-full bg-brand-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black disabled:opacity-30 transition-all flex items-center justify-center gap-2">Finaliser la Vente</button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Tab remains unchanged */}
        </div>
    );
};

export default SalesView;
