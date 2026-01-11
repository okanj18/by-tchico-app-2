
import React, { useState, useMemo, useEffect } from 'react';
import { Article, Boutique, Client, Commande, StatutCommande, ModePaiement, CompteFinancier, CompanyAssets, SessionUser, Consommation } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Search, ShoppingCart, User, Printer, History, X, CheckCircle, AlertTriangle, Plus, Trash2, Wallet, Ban, FileText, Minus, Save, UserX, ClipboardList, Layers, DollarSign, Store, Tag, Scissors, Eye, Clock } from 'lucide-react';

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
    onCreateCustomOrder?: (o: Commande, cons: Consommation[], method: ModePaiement, accId?: string) => void;
}

const SalesView: React.FC<SalesViewProps> = ({ 
    articles, boutiques, clients, commandes, onMakeSale, onAddPayment, comptes, onCancelSale, companyAssets, currentUser, onCreateCustomOrder
}) => {
    const [cart, setCart] = useState<{ id: string, articleId: string, variante: string, nom: string, prix: number, quantite: number }[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedBoutiqueId, setSelectedBoutiqueId] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [amountPaid, setAmountPaid] = useState<number>(0);
    const [accountId, setAccountId] = useState<string>(''); 
    const [tvaEnabled, setTvaEnabled] = useState(false);
    const [remise, setRemise] = useState<number>(0);

    const [activeTab, setActiveTab] = useState<'POS' | 'CUSTOM' | 'HISTORY'>('POS');
    const [productSearch, setProductSearch] = useState('');
    const [historySearch, setHistorySearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('TOUT');

    // State pour création commande sur mesure
    const [isCustomOrderModalOpen, setIsCustomOrderModalOpen] = useState(false);
    const [newCustomOrder, setNewCustomOrder] = useState<Partial<Commande>>({
        clientId: '', prixTotal: 0, avance: 0, elements: [], description: '', dateLivraisonPrevue: ''
    });
    const [tempElement, setTempElement] = useState({ nom: '', quantite: 1 });

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

    // --- FIX: Missing name generatePrintContent ---
    /**
     * Génère un ticket de caisse imprimable pour une vente.
     */
    const generatePrintContent = (sale: Commande) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const itemsHtml = (sale.detailsVente || []).map(item => `
            <tr>
                <td style="padding: 5px 0;">${item.nomArticle} (${item.variante}) x${item.quantite}</td>
                <td style="text-align: right; padding: 5px 0;">${(item.prixUnitaire * item.quantite).toLocaleString()} F</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Ticket de Caisse - ${COMPANY_CONFIG.name}</title>
                    <style>
                        body { font-family: 'Courier New', Courier, monospace; padding: 10px; width: 280px; margin: auto; }
                        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                        .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; font-size: 10px; color: #666; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        .total { font-weight: bold; border-top: 1px solid #000; margin-top: 10px; padding-top: 5px; font-size: 14px; }
                        .info { font-size: 10px; margin-bottom: 5px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2 style="margin: 0;">${COMPANY_CONFIG.name}</h2>
                        <p style="margin: 2px 0; font-size: 10px;">${COMPANY_CONFIG.tagline}</p>
                        <p style="margin: 2px 0; font-size: 10px;">${COMPANY_CONFIG.address}</p>
                        <p style="margin: 2px 0; font-size: 10px;">${COMPANY_CONFIG.phone}</p>
                    </div>
                    <div class="info">
                        <p style="margin: 2px 0;">Date: ${new Date(sale.dateCommande).toLocaleString()}</p>
                        <p style="margin: 2px 0;">Ticket: #${sale.id.slice(-6)}</p>
                        <p style="margin: 2px 0;">Client: ${sale.clientNom}</p>
                    </div>
                    <table>
                        <thead>
                            <tr style="border-bottom: 1px solid #eee;">
                                <th style="text-align: left; padding: 5px 0;">Article</th>
                                <th style="text-align: right; padding: 5px 0;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                    <div class="total">
                        <div style="display: flex; justify-content: space-between;">
                            <span>TOTAL TTC</span>
                            <span>${sale.prixTotal.toLocaleString()} F</span>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Merci de votre visite !</p>
                        <p>v${COMPANY_CONFIG.version}</p>
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // --- FIX: Missing name openCancelModal ---
    /**
     * Ouvre le modal de confirmation d'annulation pour une vente.
     */
    const openCancelModal = (sale: Commande) => {
        setSelectedOrderForCancel(sale);
        setIsCancelModalOpen(true);
    };

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

    const customOrders = useMemo(() => {
        return commandes
            .filter(c => c.type === 'SUR_MESURE' && !c.archived)
            .filter(c => currentUser?.role === 'ADMIN' || currentUser?.role === 'GERANT' || c.boutiqueId === currentUser?.boutiqueId)
            .sort((a,b) => new Date(b.dateCommande).getTime() - new Date(a.dateCommande).getTime());
    }, [commandes, currentUser]);

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

    const handleSaveCustomOrder = () => {
        if (!newCustomOrder.clientId || !newCustomOrder.prixTotal || !newCustomOrder.elements?.length) {
            alert("Veuillez remplir les informations obligatoires (Client, Composition, Prix).");
            return;
        }

        const client = clients.find(c => c.id === newCustomOrder.clientId);
        const order: Commande = {
            id: `CMD_SM_${Date.now()}`,
            clientId: newCustomOrder.clientId!,
            clientNom: client?.nom || 'Inconnu',
            boutiqueId: selectedBoutiqueId,
            description: newCustomOrder.description || 'Commande Sur-Mesure',
            dateCommande: new Date().toISOString(),
            dateLivraisonPrevue: newCustomOrder.dateLivraisonPrevue || '',
            statut: StatutCommande.EN_ATTENTE,
            tailleursIds: [],
            prixTotal: newCustomOrder.prixTotal!,
            avance: newCustomOrder.avance || 0,
            reste: Math.max(0, newCustomOrder.prixTotal! - (newCustomOrder.avance || 0)),
            type: 'SUR_MESURE',
            quantite: newCustomOrder.elements!.reduce((acc, el) => acc + el.quantiteTotal, 0),
            elements: newCustomOrder.elements,
            paiements: [],
            consommations: [],
            taches: []
        };

        if (onCreateCustomOrder) {
            onCreateCustomOrder(order, [], 'ESPECE', accountId);
            setIsCustomOrderModalOpen(false);
            setNewCustomOrder({ clientId: '', prixTotal: 0, avance: 0, elements: [], description: '', dateLivraisonPrevue: '' });
            setActiveTab('CUSTOM');
        }
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

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
            <div className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('POS')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'POS' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}><ShoppingCart size={18} /> Point de Vente</button>
                    <button onClick={() => setActiveTab('CUSTOM')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'CUSTOM' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}><Scissors size={18} /> Commandes Sur-Mesure</button>
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

            {/* TAB POINT DE VENTE DIRECT */}
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
                                            
                                            {article.variantes && article.variantes.length > 0 ? (
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
                                    <input type="number" className="w-full p-2 border border-red-100 rounded text-xs font-black text-red-600 bg-white" placeholder="0" value={remise || ''} onChange={(e) => setRemise(parseInt(e.target.value) || 0)} />
                                </div>
                                <div className="flex flex-col gap-1 text-right">
                                    <label className="text-[9px] font-black text-gray-400 uppercase mr-1">Total TTC</label>
                                    <div className="text-xl font-black text-brand-600">{finalTotal.toLocaleString()} F</div>
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

            {/* TAB COMMANDES SUR MESURE (POUR VENDEURS) */}
            {activeTab === 'CUSTOM' && (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden animate-in fade-in">
                    <div className="p-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 uppercase text-xs tracking-widest"><Scissors size={18} className="text-brand-600"/> Gestion Sur-Mesure</h3>
                        <button onClick={() => { setIsCustomOrderModalOpen(true); }} className="bg-brand-900 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all"><Plus size={16}/> Nouvelle Commande</button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white border-b sticky top-0 z-10 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <tr><th className="p-4">Date & Réf</th><th className="p-4">Client</th><th className="p-4">Composition</th><th className="p-4 text-center">État Atelier</th><th className="p-4 text-right">Finances</th><th className="p-4 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {customOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-brand-50/20">
                                        <td className="p-4">
                                            <p className="font-bold text-gray-800">{new Date(order.dateCommande).toLocaleDateString()}</p>
                                            <p className="text-[10px] text-gray-400 font-mono">#{order.id.slice(-6)}</p>
                                        </td>
                                        <td className="p-4 font-black text-gray-700 uppercase">{order.clientNom}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {order.elements?.map((el, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold uppercase">{el.nom} ({el.quantiteTotal})</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="px-3 py-1 bg-white border border-gray-100 rounded-full text-[10px] font-black uppercase text-gray-500 shadow-sm">{order.statut}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <p className="font-bold text-gray-800">{order.prixTotal.toLocaleString()} F</p>
                                            <p className={`text-[10px] font-black ${order.reste > 0 ? 'text-red-500' : 'text-green-600'}`}>{order.reste > 0 ? `Reste: ${order.reste.toLocaleString()} F` : 'Payé'}</p>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => { setSelectedOrderDetails(order); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={16}/></button>
                                                {order.reste > 0 && <button onClick={() => openPaymentModal(order)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Encaisser Versement"><DollarSign size={16}/></button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {customOrders.length === 0 && (
                                    <tr><td colSpan={6} className="p-20 text-center text-gray-300 font-black uppercase text-xs">Aucune commande sur-mesure enregistrée pour cette boutique.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB HISTORIQUE VENTES DIRECTES */}
            {activeTab === 'HISTORY' && (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden animate-in fade-in">
                    <div className="p-4 bg-gray-50 border-b flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 uppercase text-xs tracking-widest"><History size={18}/> Ventes Réalisées</h3>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-2 text-gray-400" size={16} />
                            <input type="text" placeholder="Chercher vente..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm"/>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white border-b sticky top-0 z-10 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <tr><th className="p-4">Date</th><th className="p-4">Client</th><th className="p-4">Articles</th><th className="p-4 text-right">Montant</th><th className="p-4 text-center">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {salesHistory.map(sale => (
                                    <tr key={sale.id} className="hover:bg-gray-50">
                                        <td className="p-4 text-gray-600">{new Date(sale.dateCommande).toLocaleDateString()}</td>
                                        <td className="p-4 font-bold text-gray-800">{sale.clientNom}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {sale.detailsVente?.map((item, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">{item.nomArticle} x{item.quantite}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-black text-brand-700">{sale.prixTotal.toLocaleString()} F</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => generatePrintContent(sale)} className="p-1.5 text-gray-500 hover:text-brand-600 rounded" title="Imprimer Ticket"><Printer size={16}/></button>
                                                <button onClick={() => openCancelModal(sale)} className="p-1.5 text-red-300 hover:text-red-500 rounded" title="Annuler Vente"><Ban size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL NOUVELLE COMMANDE SUR MESURE */}
            {isCustomOrderModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-brand-100 overflow-hidden">
                        <div className="p-6 bg-white border-b flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Nouvelle Commande Sur-Mesure</h3>
                            <button onClick={() => setIsCustomOrderModalOpen(false)}><X size={28} className="text-gray-400"/></button>
                        </div>
                        <div className="p-8 space-y-6 overflow-y-auto flex-1 bg-gray-50/30 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Client</label>
                                    <select className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-white" value={newCustomOrder.clientId} onChange={e => setNewCustomOrder({...newCustomOrder, clientId: e.target.value})}>
                                        <option value="">-- Sélectionner Client --</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Date Livraison Souhaitée</label>
                                    <input type="date" className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold" value={newCustomOrder.dateLivraisonPrevue} onChange={e => setNewCustomOrder({...newCustomOrder, dateLivraisonPrevue: e.target.value})}/>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Description Globale (Modèle/Tissu)</label>
                                <textarea className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-white h-24" value={newCustomOrder.description} onChange={e => setNewCustomOrder({...newCustomOrder, description: e.target.value})} placeholder="Ex: Robe de soirée en soie, Grand Boubou Bazin..."/>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4 shadow-inner">
                                <h4 className="text-[10px] font-black text-brand-700 uppercase tracking-widest flex items-center gap-2"><Scissors size={14}/> Composition de la commande</h4>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Pièce (ex: Veste)" className="flex-1 p-3 border-2 border-gray-100 rounded-xl text-xs font-black uppercase" value={tempElement.nom} onChange={e => setTempElement({...tempElement, nom: e.target.value})} />
                                    <input type="number" placeholder="Qté" className="w-20 p-3 border-2 border-gray-100 rounded-xl text-center font-black" value={tempElement.quantite} onChange={e => setTempElement({...tempElement, quantite: parseInt(e.target.value)||1})} />
                                    <button onClick={() => { if(!tempElement.nom) return; setNewCustomOrder({...newCustomOrder, elements: [...(newCustomOrder.elements||[]), { id: `EL_${Date.now()}`, nom: tempElement.nom.toUpperCase(), quantiteTotal: tempElement.quantite }]}); setTempElement({nom:'', quantite:1}); }} className="p-3 bg-brand-900 text-white rounded-xl hover:bg-black transition-all"><Plus size={20}/></button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {newCustomOrder.elements?.map((el, idx) => (
                                        <div key={idx} className="bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                            <span className="text-[10px] font-black text-brand-900 uppercase">{el.nom} ({el.quantiteTotal})</span>
                                            <button onClick={() => setNewCustomOrder({...newCustomOrder, elements: newCustomOrder.elements?.filter((_,i) => i!==idx)})} className="text-red-300 hover:text-red-500"><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Prix Total de la prestation (F)</label><input type="number" className="w-full p-4 border-2 border-brand-100 rounded-2xl font-black text-brand-700 text-xl" value={newCustomOrder.prixTotal || ''} onChange={e => setNewCustomOrder({...newCustomOrder, prixTotal: parseInt(e.target.value)||0})} placeholder="0"/></div>
                                <div><label className="text-[10px] font-black text-brand-600 uppercase mb-2 block">Acompte Immédiat (F)</label><input type="number" className="w-full p-4 border-2 border-brand-100 rounded-2xl font-black text-brand-600 text-xl bg-brand-50/50" value={newCustomOrder.avance || ''} onChange={e => setNewCustomOrder({...newCustomOrder, avance: parseInt(e.target.value)||0})} placeholder="0"/></div>
                            </div>
                            { (newCustomOrder.avance || 0) > 0 && (
                                <div>
                                    <label className="text-[10px] font-black text-gray-900 uppercase mb-2 block">Caisse d'encaissement</label>
                                    <select className="w-full p-3 border-2 border-brand-300 rounded-xl font-black bg-white" value={accountId} onChange={e => setAccountId(e.target.value)}>
                                        <option value="">-- Choisir Caisse --</option>
                                        {comptes.filter(c => c.boutiqueId === selectedBoutiqueId).map(c => <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-white border-t flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsCustomOrderModalOpen(false)} className="px-6 py-3 text-gray-400 font-black uppercase text-xs">Annuler</button>
                            <button onClick={handleSaveCustomOrder} disabled={!newCustomOrder.clientId || !newCustomOrder.prixTotal || !newCustomOrder.elements?.length || ((newCustomOrder.avance||0)>0 && !accountId)} className="px-12 py-3 bg-brand-900 text-white rounded-xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center gap-2"><Save size={18}/> Enregistrer Commande</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ENCAISSEMENT RELIQUAT */}
            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-brand-900/80 z-[700] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] p-10 w-full max-sm shadow-2xl border border-brand-100 animate-in zoom-in">
                        <div className="flex justify-between items-center mb-8 border-b pb-5 shrink-0"><h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><DollarSign className="text-green-600"/> Encaisser Versement</h3><button onClick={()=>setPaymentModalOpen(false)}><X size={28} className="text-gray-400"/></button></div>
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-6 rounded-3xl text-center border shadow-inner"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Reste à percevoir</p><p className="text-3xl font-black text-gray-900">{selectedOrderForPayment.reste.toLocaleString()} F</p></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Montant à encaisser (F)</label><input type="number" className="w-full p-5 border-2 border-brand-100 rounded-2xl text-2xl font-black text-brand-600 focus:border-brand-600 outline-none transition-all shadow-sm" value={payAmount||''} placeholder="0" onChange={e=>setPayAmount(parseInt(e.target.value)||0)}/></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Mode de règlement</label><select className="w-full p-4 border-2 border-brand-100 rounded-2xl font-black bg-white outline-none" value={payMethod} onChange={e=>setPayMethod(e.target.value as any)}><option value="ESPECE">Espèce</option><option value="WAVE">Wave</option><option value="ORANGE_MONEY">Orange Money</option></select></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Caisse de réception</label><select className="w-full p-4 border-2 border-brand-100 rounded-2xl font-black bg-white outline-none" value={payAccount} onChange={e=>setPayAccount(e.target.value)}><option value="">-- Choisir Caisse --</option>{comptes.filter(c => c.boutiqueId === selectedBoutiqueId).map(c=><option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>)}</select></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10 pt-5 border-t"><button onClick={()=>setPaymentModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button><button onClick={handleConfirmPayment} disabled={!payAccount || payAmount <= 0} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Confirmer Encaissement</button></div>
                    </div>
                </div>
            )}

            {/* DETAILS COMMANDE SUR MESURE */}
            {selectedOrderDetails && (
                <div className="fixed inset-0 bg-brand-900/90 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in border border-brand-100">
                        <div className="p-8 border-b flex justify-between items-center bg-white shrink-0">
                            <div><h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Suivi Commande</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Réf: #{selectedOrderDetails.id.slice(-6)}</p></div>
                            <button onClick={() => setSelectedOrderDetails(null)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100"><X size={24}/></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="flex justify-between items-center bg-gray-50 p-6 rounded-3xl border">
                                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">État actuel à l'Atelier</p><p className="text-lg font-black text-brand-900 uppercase tracking-widest">{selectedOrderDetails.statut}</p></div>
                                <Clock size={32} className="text-brand-300"/>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Articles en fabrication</h4>
                                <div className="space-y-2">
                                    {selectedOrderDetails.elements?.map((el, i) => (
                                        <div key={i} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                                            <span className="font-black text-gray-800 uppercase text-xs">{el.nom}</span>
                                            <span className="text-xs font-black text-gray-400">Qté: {el.quantiteTotal}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-brand-900 text-white p-6 rounded-3xl flex justify-between items-center">
                                <div><p className="text-[10px] font-black text-brand-300 uppercase mb-1">Reste à payer</p><p className="text-3xl font-black">{selectedOrderDetails.reste.toLocaleString()} F</p></div>
                                <button onClick={() => { setSelectedOrderDetails(null); openPaymentModal(selectedOrderDetails); }} className="px-6 py-3 bg-brand-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Encaisser</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ANNULATION VENTE */}
            {isCancelModalOpen && selectedOrderForCancel && (
                <div className="fixed inset-0 bg-brand-900/80 z-[700] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border border-brand-100 animate-in zoom-in">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3 text-red-600"><AlertTriangle /> Annuler Vente</h3>
                            <button onClick={() => setIsCancelModalOpen(false)}><X size={28} className="text-gray-400"/></button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500 text-center mb-4">Voulez-vous vraiment annuler la vente de <strong>{selectedOrderForCancel.clientNom}</strong> ?<br/>Le stock sera réintégré.</p>
                            
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Compte pour le remboursement</label>
                                <select 
                                    className="w-full p-4 border-2 border-brand-100 rounded-2xl font-black bg-white outline-none" 
                                    value={refundAccountId} 
                                    onChange={e => setRefundAccountId(e.target.value)}
                                >
                                    <option value="">-- Choisir Source --</option>
                                    {comptes.filter(c => c.boutiqueId === selectedOrderForCancel.boutiqueId).map(c => (
                                        <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString()} F)</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                            <button onClick={() => setIsCancelModalOpen(false)} className="px-6 py-3 text-gray-400 font-black uppercase text-[10px]">Abandonner</button>
                            <button 
                                onClick={() => {
                                    if (!refundAccountId) return;
                                    onCancelSale(selectedOrderForCancel.id, refundAccountId);
                                    setIsCancelModalOpen(false);
                                }} 
                                disabled={!refundAccountId}
                                className="px-10 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 disabled:opacity-30"
                            >
                                Confirmer Annulation
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesView;
