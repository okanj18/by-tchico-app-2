
import React, { useState, useMemo, useEffect } from 'react';
import { Article, Boutique, Client, Commande, StatutCommande, ModePaiement, CompteFinancier } from '../types';
import { COMPANY_CONFIG } from '../config';
import { Search, ShoppingCart, User, Printer, History, X, CheckCircle, AlertTriangle, Plus, Trash2, Wallet, Ban, FileText, Minus, Save, UserX, ClipboardList } from 'lucide-react';

interface SalesViewProps {
    articles: Article[];
    boutiques: Boutique[];
    clients: Client[];
    commandes: Commande[];
    onMakeSale: (saleData: any) => void;
    onAddPayment: (orderId: string, amount: number, method: ModePaiement, note: string, date: string, accountId?: string) => void;
    comptes: CompteFinancier[];
    onCancelSale: (orderId: string, refundAccountId: string) => void;
}

const SalesView: React.FC<SalesViewProps> = ({ 
    articles, boutiques, clients, commandes, onMakeSale, onAddPayment, comptes, onCancelSale 
}) => {
    // --- STATE ---
    // Cart & Sale
    const [cart, setCart] = useState<{ id: string, articleId: string, variante: string, nom: string, prix: number, quantite: number }[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedBoutiqueId, setSelectedBoutiqueId] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [amountPaid, setAmountPaid] = useState<number>(0);
    const [accountId, setAccountId] = useState<string>(''); // Compte destination
    const [tvaEnabled, setTvaEnabled] = useState(false);
    const [remise, setRemise] = useState<number>(0);

    // Navigation & Filters
    const [activeTab, setActiveTab] = useState<'POS' | 'HISTORY'>('POS');
    const [productSearch, setProductSearch] = useState('');
    const [historySearch, setHistorySearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('TOUT');

    // Modals
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Commande | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<Commande | null>(null);
    const [refundAccountId, setRefundAccountId] = useState<string>(''); 

    // --- PAYMENT HISTORY STATE ---
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Commande | null>(null);
    const [payAmount, setPayAmount] = useState(0);
    const [payMethod, setPayMethod] = useState<ModePaiement>('ESPECE');
    const [payAccount, setPayAccount] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    // --- EFFECT ---
    // Set default boutique if available
    useEffect(() => {
        if (boutiques.length > 0 && !selectedBoutiqueId) {
            setSelectedBoutiqueId(boutiques[0].id);
        }
    }, [boutiques]);

    // --- COMPUTED ---
    const filteredArticles = useMemo(() => {
        return articles.filter(a => 
            a.typeArticle === 'PRODUIT_FINI' && // Only finished goods
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
    const changeAmount = Math.max(0, amountPaid - finalTotal);

    // --- HANDLERS ---

    const addToCart = (article: Article, variant: string = 'Standard') => {
        // Check stock if boutique selected
        if (selectedBoutiqueId) {
            const stock = article.stockParLieu[selectedBoutiqueId]?.[variant] || 0;
            const inCart = cart.find(i => i.articleId === article.id && i.variante === variant)?.quantite || 0;
            if (stock <= inCart) {
                alert(`Stock insuffisant pour ${article.nom} (${variant}) à la boutique sélectionnée.`);
                return;
            }
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

    const removeFromCart = (itemId: string) => {
        setCart(cart.filter(i => i.id !== itemId));
    };

    const updateQuantity = (itemId: string, delta: number) => {
        setCart(cart.map(i => {
            if (i.id === itemId) {
                const newQty = i.quantite + delta;
                
                // Check stock
                if (selectedBoutiqueId && delta > 0) {
                    const article = articles.find(a => a.id === i.articleId);
                    if (article) {
                        const stock = article.stockParLieu[selectedBoutiqueId]?.[i.variante] || 0;
                        if (stock < newQty) {
                            alert(`Stock insuffisant.`);
                            return i;
                        }
                    }
                }
                
                if (newQty <= 0) return i; // Don't remove here, let explicit remove handle it
                return { ...i, quantite: newQty };
            }
            return i;
        }));
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;
        if (!selectedBoutiqueId) { alert("Veuillez sélectionner une boutique."); return; }
        if (!accountId && amountPaid > 0) { alert("Veuillez sélectionner un compte de destination pour l'encaissement."); return; }

        const isClientDePassage = !selectedClientId;
        
        // Règle de gestion : Un client de passage doit payer la totalité
        if (isClientDePassage && amountPaid < finalTotal) {
            alert("⚠️ Attention : Un client de passage doit régler la totalité de la commande immédiatement.\n\nVeuillez saisir le montant total ou sélectionner un client enregistré pour faire crédit.");
            return;
        }

        const client = clients.find(c => c.id === selectedClientId);
        const clientName = client ? client.nom : "Client de passage";

        const saleData = {
            clientId: selectedClientId || null,
            clientName: clientName,
            items: cart,
            total: finalTotal,
            tva: tvaAmount,
            tvaRate: tvaEnabled ? (COMPANY_CONFIG.tvaRate * 100) : 0,
            remise: remise,
            montantRecu: amountPaid,
            boutiqueId: selectedBoutiqueId,
            method: paymentMethod,
            accountId: accountId
        };

        onMakeSale(saleData);
        
        // Reset
        setCart([]);
        setAmountPaid(0);
        setRemise(0);
        setSelectedClientId('');
        setActiveTab('HISTORY'); // Switch to history to show success
    };

    const openPaymentModal = (order: Commande) => {
        setSelectedOrderForPayment(order);
        setPayAmount(order.reste);
        setPayAccount(''); // Force user to select
        setPayDate(new Date().toISOString().split('T')[0]);
        setPaymentModalOpen(true);
    };

    const handleConfirmPayment = () => {
        if (!selectedOrderForPayment || payAmount <= 0) return;
        if (!payAccount) {
            alert("Veuillez sélectionner un compte de destination.");
            return;
        }
        onAddPayment(selectedOrderForPayment.id, payAmount, payMethod, "Règlement solde", payDate, payAccount);
        setPaymentModalOpen(false);
        setSelectedOrderForPayment(null);
    };

    const generatePrintContent = (order: Commande, mode: 'TICKET' | 'DEVIS' | 'LIVRAISON' = 'TICKET') => {
        const printWindow = window.open('', '', 'width=400,height=600');
        if (!printWindow) return;

        const dateStr = new Date(order.dateCommande).toLocaleDateString();
        let docTitle = "TICKET DE CAISSE";
        if (mode === 'DEVIS') docTitle = "DEVIS / PROFORMA";
        if (mode === 'LIVRAISON') docTitle = "BON DE LIVRAISON";
        
        const isPaid = order.reste <= 0;
        const stampText = isPaid ? "PAYÉ" : "NON SOLDÉ";
        const stampColor = isPaid ? "#16a34a" : "#dc2626"; 
        const showStamp = mode !== 'DEVIS';

        const itemsHtml = order.detailsVente?.map(item => `
            <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                <span>${item.nomArticle} ${item.variante !== 'Standard' ? '(' + item.variante + ')' : ''} x${item.quantite}</span>
                <span>${(item.quantite * item.prixUnitaire).toLocaleString()}</span>
            </div>
        `).join('') || '';

        // CALCULS FINANCIERS
        const totalTTC = order.prixTotal || 0;
        const tva = order.tva || 0;
        const remise = order.remise || 0;
        const totalHT = totalTTC - tva + remise;

        // Récupération de l'URL de base pour les images (Important pour window.open)
        const baseUrl = window.location.origin;
        const logoUrl = `${baseUrl}${COMPANY_CONFIG.logoUrl}`;
        const stampUrl = `${baseUrl}${COMPANY_CONFIG.stampUrl}`;
        const signatureUrl = `${baseUrl}${COMPANY_CONFIG.signatureUrl}`;

        const html = `
            <html>
            <head>
                <title>${docTitle}</title>
                <style>
                    body { font-family: monospace; padding: 20px; font-size: 12px; position: relative; max-width: 400px; margin: auto; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .logo { text-align: center; margin-bottom: 10px; }
                    .logo img { max-height: 70px; width: auto; }
                    .total { border-top: 1px dashed black; margin-top: 10px; padding-top: 5px; }
                    .footer { text-align:center; margin-top: 20px; font-size: 10px; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                    .bold { font-weight: bold; }
                    .stamp {
                        position: absolute;
                        top: 35%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-15deg);
                        font-size: 32px;
                        font-weight: bold;
                        color: ${stampColor};
                        border: 3px solid ${stampColor};
                        padding: 10px 30px;
                        border-radius: 8px;
                        opacity: 0.3;
                        z-index: 0;
                        pointer-events: none;
                        text-transform: uppercase;
                        font-family: sans-serif;
                    }
                    .signatures { display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 10px; align-items: flex-start; page-break-inside: avoid; }
                    .sign-box { width: 45%; text-align: center; position: relative; min-height: 80px; }
                    .sign-title { font-weight: bold; text-decoration: underline; margin-bottom: 30px; display: block; }
                    .stamp-container { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 100px; height: 70px; display:flex; align-items:center; justify-content:center; }
                    .stamp-img { position: absolute; width: 80px; opacity: 0.7; transform: rotate(-10deg); z-index: 1; }
                    .sig-img { position: absolute; width: 60px; z-index: 2; margin-top: 10px; }
                    /* Fallback si image manquante */
                    .missing-img { border: 2px dashed #ccc; color: #ccc; width: 80px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 9px; }
                    
                    .content { position: relative; z-index: 1; }
                </style>
            </head>
            <body>
                <div class="content">
                    <div class="header">
                        <div class="logo">
                            <img src="${logoUrl}" alt="${COMPANY_CONFIG.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                            <div style="display:none; font-size:20px; font-weight:bold; color:#bf602a;">${COMPANY_CONFIG.name}</div>
                        </div>
                        <h3>${COMPANY_CONFIG.name}</h3>
                        <p>${COMPANY_CONFIG.address}<br/>${COMPANY_CONFIG.phone}</p>
                        <p><strong>${docTitle}</strong></p>
                        <p>Ref: #${order.id.slice(-6)}<br/>Date: ${dateStr}</p>
                        <p>Client: ${order.clientNom}</p>
                    </div>
                    
                    <div class="items">
                        ${itemsHtml}
                    </div>
                    
                    <div class="total">
                        <div class="row">
                            <span>Sous-total HT</span>
                            <span>${totalHT.toLocaleString()}</span>
                        </div>
                        ${remise > 0 ? `
                        <div class="row">
                            <span>Remise</span>
                            <span>-${remise.toLocaleString()}</span>
                        </div>` : ''}
                        ${tva > 0 ? `
                        <div class="row">
                            <span>TVA (${order.tvaRate || 18}%)</span>
                            <span>${tva.toLocaleString()}</span>
                        </div>` : ''}
                        
                        <div class="row bold" style="font-size: 14px; margin-top: 5px; border-top: 1px solid #ddd; padding-top: 5px;">
                            <span>TOTAL TTC</span>
                            <span>${totalTTC.toLocaleString()} ${COMPANY_CONFIG.currency}</span>
                        </div>

                        ${mode === 'TICKET' ? `
                        <div class="row" style="margin-top: 10px;">
                            <span>Montant Versé</span>
                            <span>${order.avance.toLocaleString()}</span>
                        </div>
                        <div class="row bold">
                            <span>Reste à Payer</span>
                            <span>${order.reste.toLocaleString()}</span>
                        </div>
                        ` : ''}
                    </div>

                    <!-- SIGNATURES SECTION -->
                    <div class="signatures">
                        <div class="sign-box">
                            <span class="sign-title">Client</span>
                        </div>
                        <div class="sign-box">
                            <span class="sign-title">Direction</span>
                            <div class="stamp-container">
                                <!-- CACHET -->
                                <img src="${stampUrl}" class="stamp-img" alt="Cachet" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                <div class="missing-img" style="display:none; border:3px double #16a34a; color:#16a34a; border-radius:50%; width:80px; height:80px; transform:rotate(-10deg);">CACHET</div>
                                
                                <!-- SIGNATURE -->
                                <img src="${signatureUrl}" class="sig-img" alt="Signature" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                                <div class="missing-img" style="display:none; border:none; border-bottom:1px solid #000; width:80px; height:30px; margin-top:15px;">Signature</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>Merci de votre visite !<br/>Les articles vendus ne sont ni repris ni échangés.</p>
                    </div>
                </div>

                ${showStamp ? `<div class="stamp">${stampText}</div>` : ''}

                <script>
                    window.onload = function() {
                        var imgs = document.getElementsByTagName('img');
                        var loaded = 0;
                        if (imgs.length === 0) { window.print(); return; }
                        
                        function check() {
                            loaded++;
                            if (loaded === imgs.length) { window.print(); }
                        }
                        
                        for(var i=0; i<imgs.length; i++) {
                            if(imgs[i].complete) loaded++;
                            else {
                                imgs[i].onload = check;
                                imgs[i].onerror = check;
                            }
                        }
                        if(loaded === imgs.length) window.print();
                    };
                </script>
            </body>
            </html>
        `;
        
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrintQuoteFromCart = () => {
        if (cart.length === 0) return;
        
        // Simuler une commande pour l'impression
        const dummyOrder: any = {
            id: 'PROFORMA',
            dateCommande: new Date().toISOString(),
            clientNom: clients.find(c => c.id === selectedClientId)?.nom || 'Client',
            prixTotal: finalTotal,
            avance: 0,
            reste: finalTotal,
            tva: tvaAmount,
            tvaRate: tvaEnabled ? COMPANY_CONFIG.tvaRate * 100 : 0,
            remise: remise,
            detailsVente: cart.map(c => ({
                nomArticle: c.nom,
                variante: c.variante,
                quantite: c.quantite,
                prixUnitaire: c.prix
            }))
        };
        generatePrintContent(dummyOrder, 'DEVIS');
    }

    const openCancelModal = (order: Commande) => {
        setSelectedOrderForCancel(order);
        setRefundAccountId('');
        setIsCancelModalOpen(true);
    };

    const handleConfirmCancel = () => {
        if (!selectedOrderForCancel) return;
        
        // Validation : Si remboursement nécessaire
        if (selectedOrderForCancel.avance > 0) {
            if (!refundAccountId) {
                alert("Veuillez sélectionner un compte pour déduire le remboursement.");
                return;
            }

            // Vérification Solde Suffisant
            const account = comptes.find(c => c.id === refundAccountId);
            if (account) {
                if (account.solde < selectedOrderForCancel.avance) {
                    alert(`🚫 FONDS INSUFFISANTS\n\nLe compte "${account.nom}" ne dispose que de ${account.solde.toLocaleString()} F.\nIl est impossible de rembourser ${selectedOrderForCancel.avance.toLocaleString()} F.\n\nVeuillez choisir un autre compte ou approvisionner la caisse.`);
                    return;
                }
            }
        }

        onCancelSale(selectedOrderForCancel.id, refundAccountId);
        setIsCancelModalOpen(false);
        setSelectedOrderForCancel(null);
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
            {/* Header Tabs */}
            <div className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setActiveTab('POS')} 
                        className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'POS' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <ShoppingCart size={18} /> Point de Vente
                    </button>
                    <button 
                        onClick={() => setActiveTab('HISTORY')} 
                        className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'HISTORY' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <History size={18} /> Historique Ventes
                    </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                    <User size={16} /> 
                    <span>Caisse: {comptes.find(c => c.id === accountId)?.nom || 'Non sélectionnée'}</span>
                </div>
            </div>

            {/* POS VIEW */}
            {activeTab === 'POS' && (
                <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
                    {/* LEFT: PRODUCTS CATALOG */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-gray-100 space-y-2 shrink-0">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 text-sm">Catalogue</h3>
                                <select 
                                    className="p-1.5 border border-gray-300 rounded-lg text-xs bg-gray-50 max-w-[150px]"
                                    value={selectedBoutiqueId} 
                                    onChange={(e) => { setSelectedBoutiqueId(e.target.value); setCart([]); }}
                                >
                                    {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                                </select>
                            </div>
                            
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2 text-gray-400" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="Rechercher produit..." 
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                                <div className="flex overflow-x-auto gap-2 pb-1 max-w-[50%] no-scrollbar items-center">
                                    {categories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setSelectedCategory(cat)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 align-content-start">
                            {filteredArticles.map(article => {
                                const stockAtShop = article.stockParLieu?.[selectedBoutiqueId] as Record<string, number> | undefined;
                                const totalStock = stockAtShop ? Object.values(stockAtShop).reduce((a: number, b: number) => a + b, 0) : 0;

                                return (
                                    <div key={article.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3 hover:shadow-md transition-shadow flex flex-col">
                                        <div className="h-24 bg-white rounded mb-2 flex items-center justify-center overflow-hidden border border-gray-100">
                                            {article.images && article.images.length > 0 ? (
                                                <img src={article.images[0]} alt={article.nom} className="w-full h-full object-cover" />
                                            ) : (
                                                <ShoppingCart className="text-gray-300" size={32} />
                                            )}
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1" title={article.nom}>{article.nom}</h4>
                                        <p className="text-xs text-gray-500 mb-2">{article.categorie}</p>
                                        
                                        <div className="mt-auto">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-bold text-brand-600">{article.prixVenteDefault.toLocaleString()} F</span>
                                                <span className={`text-[10px] px-1 rounded ${totalStock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {totalStock}
                                                </span>
                                            </div>
                                            
                                            {/* Variants or Add Button */}
                                            {article.variantes.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {article.variantes.slice(0, 12).map(v => {
                                                        const s = stockAtShop?.[v] || 0;
                                                        return (
                                                            <button 
                                                                key={v}
                                                                onClick={() => addToCart(article, v)}
                                                                disabled={s <= 0}
                                                                className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${s > 0 ? 'bg-white border-gray-300 hover:border-brand-500 hover:text-brand-600 text-gray-700' : 'bg-gray-100 text-gray-300 border-transparent cursor-not-allowed'}`}
                                                                title={`${v} : ${s} disponible(s)`}
                                                            >
                                                                <span>{v}</span>
                                                                <span className={`font-bold ${s > 0 ? 'text-green-600' : 'text-gray-300'}`}>({s})</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => addToCart(article)}
                                                    disabled={totalStock <= 0}
                                                    className={`w-full py-1.5 rounded text-xs font-bold transition-colors ${totalStock > 0 ? 'bg-gray-800 text-white hover:bg-gray-900' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                                                >
                                                    {totalStock > 0 ? 'Ajouter' : 'Rupture'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT: CART & CHECKOUT */}
                    <div className="w-full lg:w-[400px] bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <ShoppingCart size={20} className="text-brand-600" /> Panier Actuel
                            </h3>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.length === 0 ? (
                                <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                                    <ShoppingCart size={48} className="mb-2 opacity-20"/>
                                    <p>Votre panier est vide.</p>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-sm text-gray-800 line-clamp-1">{item.nom}</h4>
                                            <p className="text-xs text-gray-500">{item.variante} • {item.prix.toLocaleString()} F</p>
                                        </div>
                                        <div className="flex items-center gap-2 bg-gray-100 rounded px-1">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-white rounded"><Minus size={12}/></button>
                                            <span className="text-sm font-bold w-4 text-center">{item.quantite}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-white rounded"><Plus size={12}/></button>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Totals & Options */}
                        <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
                            {/* Options */}
                            <div className="grid grid-cols-2 gap-2">
                                <select 
                                    className="text-xs p-2 border rounded"
                                    value={selectedClientId}
                                    onChange={(e) => setSelectedClientId(e.target.value)}
                                >
                                    <option value="">-- Client (Opt.) --</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                </select>
                                <div className="flex items-center gap-2 bg-white px-2 border rounded">
                                    <input 
                                        type="checkbox" 
                                        checked={tvaEnabled} 
                                        onChange={(e) => setTvaEnabled(e.target.checked)} 
                                        className="rounded text-brand-600"
                                    />
                                    <span className="text-xs font-medium">TVA ({COMPANY_CONFIG.tvaRate*100}%)</span>
                                </div>
                            </div>
                            
                            <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    placeholder="Remise" 
                                    className="text-xs p-2 border rounded w-1/2"
                                    value={remise || ''}
                                    onChange={(e) => setRemise(parseInt(e.target.value) || 0)}
                                />
                                <div className="text-right flex-1">
                                    <p className="text-xs text-gray-500">Sous-Total: {cartTotal.toLocaleString()} F</p>
                                    {tvaEnabled && <p className="text-xs text-gray-500">TVA: {tvaAmount.toLocaleString()} F</p>}
                                    {remise > 0 && <p className="text-xs text-red-500">Remise: -{remise.toLocaleString()} F</p>}
                                </div>
                            </div>

                            <div className="border-t border-gray-200 pt-2 flex justify-between items-end">
                                <span className="text-lg font-bold text-gray-800">TOTAL</span>
                                <span className="text-2xl font-bold text-brand-600">{finalTotal.toLocaleString()} F</span>
                            </div>

                            {/* Payment */}
                            <div className="space-y-2 pt-2 border-t border-gray-200">
                                <div className="flex gap-2">
                                    <select 
                                        className="flex-1 p-2 border rounded text-sm font-medium"
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value as ModePaiement)}
                                    >
                                        <option value="ESPECE">Espèce</option>
                                        <option value="WAVE">Wave</option>
                                        <option value="ORANGE_MONEY">Orange Money</option>
                                        <option value="VIREMENT">Virement</option>
                                        <option value="CHEQUE">Chèque</option>
                                    </select>
                                    <input 
                                        type="number" 
                                        className="flex-1 p-2 border rounded text-sm font-bold text-right"
                                        placeholder="Montant Reçu"
                                        value={amountPaid || ''}
                                        onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <select 
                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                    value={accountId}
                                    onChange={(e) => setAccountId(e.target.value)}
                                >
                                    <option value="">-- Compte d'encaissement --</option>
                                    {comptes.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.nom} ({acc.type})</option>
                                    ))}
                                </select>
                                {changeAmount > 0 && (
                                    <div className="text-center bg-green-100 text-green-800 p-1 rounded font-bold text-sm">
                                        Monnaie à rendre : {changeAmount.toLocaleString()} F
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button 
                                    onClick={handlePrintQuoteFromCart}
                                    disabled={cart.length === 0}
                                    className="px-3 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100"
                                    title="Imprimer Devis"
                                >
                                    <FileText size={18}/>
                                </button>
                                <button 
                                    onClick={handleCheckout}
                                    disabled={cart.length === 0 || !selectedBoutiqueId}
                                    className="flex-1 bg-brand-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={20} /> Valider la Vente
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* HISTORY VIEW */}
            {activeTab === 'HISTORY' && (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex gap-4 bg-gray-50">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Rechercher par client ou ID..." 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Ref</th>
                                    <th className="py-3 px-4">Client</th>
                                    <th className="py-3 px-4">Articles</th>
                                    <th className="py-3 px-4 text-right">Total</th>
                                    <th className="py-3 px-4 text-center">Statut</th>
                                    <th className="py-3 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {salesHistory.map(sale => (
                                    <tr key={sale.id} className={`hover:bg-gray-50 transition-colors ${sale.statut === StatutCommande.ANNULE ? 'opacity-50 bg-red-50' : ''}`}>
                                        <td className="py-3 px-4 text-gray-500">{new Date(sale.dateCommande).toLocaleDateString()} <span className="text-xs">{new Date(sale.dateCommande).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></td>
                                        <td className="py-3 px-4 font-mono text-xs">{sale.id.slice(-6)}</td>
                                        <td className="py-3 px-4 font-medium text-gray-800">{sale.clientNom}</td>
                                        <td className="py-3 px-4 text-gray-600 truncate max-w-xs" title={sale.description}>{sale.description}</td>
                                        <td className="py-3 px-4 text-right font-bold text-brand-600">{sale.prixTotal.toLocaleString()} F</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${sale.statut === StatutCommande.LIVRE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {sale.statut === StatutCommande.LIVRE ? 'Validé' : 'Annulé'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {sale.statut !== StatutCommande.ANNULE && sale.reste > 0 && (
                                                    <button 
                                                        onClick={() => openPaymentModal(sale)}
                                                        className="text-white bg-green-600 hover:bg-green-700 px-2 py-1 rounded flex items-center gap-1 text-xs transition-colors" 
                                                        title="Encaisser"
                                                    >
                                                        <Wallet size={12}/> Encaisser
                                                    </button>
                                                )}
                                                
                                                <button 
                                                    onClick={() => generatePrintContent(sale, 'TICKET')} 
                                                    className="text-gray-500 hover:text-brand-600 p-1.5 hover:bg-gray-100 rounded transition-colors" 
                                                    title="Imprimer Facture"
                                                >
                                                    <Printer size={16}/>
                                                </button>

                                                <button 
                                                    onClick={() => generatePrintContent(sale, 'LIVRAISON')} 
                                                    className="text-gray-500 hover:text-blue-600 p-1.5 hover:bg-gray-100 rounded transition-colors" 
                                                    title="Imprimer Bon de Livraison"
                                                >
                                                    <ClipboardList size={16}/>
                                                </button>

                                                <button 
                                                    onClick={() => setSelectedOrderDetails(sale)} 
                                                    className="text-blue-500 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded transition-colors" 
                                                    title="Détails"
                                                >
                                                    <User size={16} /> {/* Détails Icon fallback to user details or list */}
                                                </button>

                                                {onCancelSale && sale.statut !== StatutCommande.ANNULE && (
                                                    <button onClick={() => openCancelModal(sale)} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded" title="Annuler Vente">
                                                        <Ban size={16}/>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {salesHistory.length === 0 && (
                                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">Aucune vente trouvée.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Paiement Historique */}
            {paymentModalOpen && selectedOrderForPayment && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Wallet className="text-green-600"/> Encaissement</h3>
                            <button onClick={() => setPaymentModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                        </div>
                        <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
                            <p><strong>Commande:</strong> #{selectedOrderForPayment.id}</p>
                            <p><strong>Client:</strong> {selectedOrderForPayment.clientNom}</p>
                            <p><strong>Reste à payer:</strong> <span className="text-red-600 font-bold">{selectedOrderForPayment.reste.toLocaleString()} F</span></p>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Montant</label>
                                <input type="number" className="w-full p-2 border border-gray-300 rounded font-bold" value={payAmount} onChange={e => setPayAmount(parseFloat(e.target.value))} max={selectedOrderForPayment.reste} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mode Paiement</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={payMethod} onChange={e => setPayMethod(e.target.value as ModePaiement)}>
                                    <option value="ESPECE">Espèce</option>
                                    <option value="WAVE">Wave</option>
                                    <option value="ORANGE_MONEY">Orange Money</option>
                                    <option value="VIREMENT">Virement</option>
                                    <option value="CHEQUE">Chèque</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Compte Destination</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={payAccount} onChange={e => setPayAccount(e.target.value)}>
                                    <option value="">-- Choisir --</option>
                                    {comptes.map(acc => <option key={acc.id} value={acc.id}>{acc.nom}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                <input type="date" className="w-full p-2 border border-gray-300 rounded" value={payDate} onChange={e => setPayDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleConfirmPayment} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold">Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirmation Annulation */}
            {isCancelModalOpen && selectedOrderForCancel && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4 text-red-600">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Ban size={24}/> Annuler Vente</h3>
                            <button onClick={() => setIsCancelModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            Voulez-vous vraiment annuler la vente de <strong>{selectedOrderForCancel.clientNom}</strong> d'un montant de <strong>{selectedOrderForCancel.prixTotal.toLocaleString()} F</strong> ?
                        </p>
                        <div className="bg-red-50 border border-red-100 p-3 rounded text-xs text-red-700 mb-4">
                            <p className="font-bold mb-1">Impact :</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Le statut passera à "ANNULÉ".</li>
                                <li>Les articles seront remis en stock.</li>
                                {selectedOrderForCancel.avance > 0 && <li>Le montant reçu ({selectedOrderForCancel.avance.toLocaleString()} F) sera déduit de la caisse.</li>}
                            </ul>
                        </div>

                        {selectedOrderForCancel.avance > 0 && (
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Compte à débiter (Remboursement)</label>
                                <select className="w-full p-2 border border-gray-300 rounded text-sm" value={refundAccountId} onChange={e => setRefundAccountId(e.target.value)}>
                                    <option value="">-- Choisir Caisse/Banque --</option>
                                    {comptes.map(acc => <option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>)}
                                </select>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsCancelModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Retour</button>
                            <button onClick={handleConfirmCancel} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">Confirmer Annulation</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Détails Historique */}
            {selectedOrderDetails && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-in zoom-in duration-200 overflow-hidden">
                        
                        {/* Header Fixe */}
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-800">Détails Vente #{selectedOrderDetails.id.slice(-6)}</h3>
                            <button onClick={() => setSelectedOrderDetails(null)} className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"><X size={20}/></button>
                        </div>

                        {/* Contenu Défilant */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Date</span>
                                    <span className="font-bold">{new Date(selectedOrderDetails.dateCommande).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Client</span>
                                    <span className="font-bold">{selectedOrderDetails.clientNom}</span>
                                </div>
                                {selectedOrderDetails.statut === StatutCommande.ANNULE && (
                                    <div className="bg-red-100 text-red-700 p-2 rounded font-bold border border-red-200 text-xs">
                                        <div className="text-center text-sm mb-1 uppercase">🚫 CETTE VENTE EST ANNULÉE</div>
                                        {selectedOrderDetails.cancelledBy && (
                                            <div className="flex items-center justify-center gap-1 font-normal">
                                                <UserX size={12} />
                                                Par : {selectedOrderDetails.cancelledBy} le {selectedOrderDetails.cancelledAt ? new Date(selectedOrderDetails.cancelledAt).toLocaleString() : ''}
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* --- LISTE DETAILLEE DES ARTICLES --- */}
                                <div className="bg-gray-50 p-3 rounded text-gray-700 border border-gray-100">
                                    <p className="font-bold mb-2 text-sm border-b border-gray-200 pb-1">Articles Achetés</p>
                                    {selectedOrderDetails.detailsVente && selectedOrderDetails.detailsVente.length > 0 ? (
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-gray-500 text-left">
                                                    <th className="pb-1">Article</th>
                                                    <th className="pb-1">Var.</th>
                                                    <th className="pb-1 text-center">Qté</th>
                                                    <th className="pb-1 text-right">Prix U.</th>
                                                    <th className="pb-1 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedOrderDetails.detailsVente.map((line, idx) => (
                                                    <tr key={idx} className="border-t border-gray-200">
                                                        <td className="py-1">{line.nomArticle}</td>
                                                        <td className="py-1 text-gray-500">{line.variante}</td>
                                                        <td className="py-1 text-center font-bold">{line.quantite}</td>
                                                        <td className="py-1 text-right">{line.prixUnitaire.toLocaleString()}</td>
                                                        <td className="py-1 text-right font-medium">{(line.quantite * line.prixUnitaire).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-sm">{selectedOrderDetails.description}</p>
                                    )}
                                </div>
                                
                                {/* Financial Details */}
                                <div className="space-y-1 pt-2">
                                    {(selectedOrderDetails.remise || 0) > 0 && (
                                        <div className="flex justify-between text-xs text-red-500">
                                            <span>Remise</span>
                                            <span>-{selectedOrderDetails.remise?.toLocaleString()} F</span>
                                        </div>
                                    )}
                                    {(selectedOrderDetails.tva || 0) > 0 && (
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>TVA ({(selectedOrderDetails.tvaRate || 18)}%)</span>
                                            <span>{selectedOrderDetails.tva?.toLocaleString()} F</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between pt-1 border-t border-gray-200 mt-1">
                                        <span>Total</span>
                                        <span className="font-bold text-lg">{selectedOrderDetails.prixTotal.toLocaleString()} F</span>
                                    </div>
                                </div>

                                {/* Payment History Section */}
                                <div className="pt-2 border-t border-gray-100">
                                    <h4 className="font-bold text-gray-700 text-xs mb-2">Historique des paiements</h4>
                                    {selectedOrderDetails.paiements && selectedOrderDetails.paiements.length > 0 ? (
                                        <div className="space-y-1">
                                            {selectedOrderDetails.paiements.map((p) => (
                                                <div key={p.id} className="flex justify-between items-center bg-gray-50 p-2 rounded text-xs border border-gray-100">
                                                    <div>
                                                        <span className="font-bold text-gray-800 block">{new Date(p.date).toLocaleDateString()}</span>
                                                        <span className="text-gray-500 text-[10px]">{p.moyenPaiement} {p.note ? `(${p.note})` : ''}</span>
                                                    </div>
                                                    <span className="font-bold text-green-600">{p.montant.toLocaleString()} F</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 italic text-xs">Aucun paiement enregistré.</p>
                                    )}
                                </div>

                                <div className="flex justify-between text-green-600 border-t border-gray-100 pt-2">
                                    <span>Payé Total</span>
                                    <span>{selectedOrderDetails.avance.toLocaleString()} F</span>
                                </div>
                                {selectedOrderDetails.reste > 0 && (
                                    <div className="flex justify-between text-red-600 font-bold">
                                        <span>Reste à payer</span>
                                        <span>{selectedOrderDetails.reste.toLocaleString()} F</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Fixe */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => generatePrintContent(selectedOrderDetails, 'TICKET')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition-colors">
                                <Printer size={16}/> Réimprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesView;
