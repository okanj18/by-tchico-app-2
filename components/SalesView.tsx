
import React, { useState, useMemo } from 'react';
import { Article, Boutique, Client, Commande, CompteFinancier, ModePaiement, CompanyAssets } from '../types';
import { COMPANY_CONFIG } from '../config';
import { ShoppingBag, Search, Trash2, Tag, Plus, Minus, X, Wallet, CreditCard, ChevronRight } from 'lucide-react';

interface SalesViewProps {
    articles: Article[];
    boutiques: Boutique[];
    clients: Client[];
    commandes: Commande[];
    onMakeSale: (saleData: any) => void;
    onAddPayment: (orderId: string, amount: number, method: ModePaiement, note: string, date: string, accountId?: string) => void;
    comptes: CompteFinancier[];
    onCancelSale: (orderId: string, refundAccountId: string) => void;
    companyAssets: CompanyAssets;
}

const SalesView: React.FC<SalesViewProps> = ({ articles, boutiques, clients, onMakeSale, comptes }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [tvaEnabled, setTvaEnabled] = useState(false);
    const [remise, setRemise] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<ModePaiement>('ESPECE');
    const [amountPaid, setAmountPaid] = useState(0);
    const [accountId, setAccountId] = useState('');
    const [selectedBoutiqueId, setSelectedBoutiqueId] = useState(boutiques[0]?.id || '');

    const filteredArticles = articles.filter(a => 
        a.typeArticle === 'PRODUIT_FINI' && 
        !a.archived &&
        (a.nom.toLowerCase().includes(searchTerm.toLowerCase()) || a.categorie.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const addToCart = (article: Article, variante: string) => {
        const existing = cart.find(item => item.articleId === article.id && item.variante === variante);
        if (existing) {
            setCart(cart.map(item => item === existing ? { ...item, quantite: item.quantite + 1 } : item));
        } else {
            setCart([...cart, {
                articleId: article.id,
                nom: article.nom,
                variante,
                prix: article.prixVenteDefault,
                quantite: 1
            }]);
        }
    };

    const updateQty = (index: number, delta: number) => {
        const newCart = [...cart];
        newCart[index].quantite = Math.max(1, newCart[index].quantite + delta);
        setCart(newCart);
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.prix * item.quantite), 0), [cart]);
    const tvaAmount = tvaEnabled ? Math.round(cartTotal * COMPANY_CONFIG.tvaRate) : 0;
    const finalTotal = cartTotal + tvaAmount - remise;

    const handleCheckout = () => {
        if (cart.length === 0) return;
        if (!accountId) { alert("Veuillez choisir un compte d'encaissement."); return; }
        if (amountPaid < finalTotal && !selectedClientId) {
            alert("Pour un paiement partiel (crédit), vous devez sélectionner un client identifié.");
            return;
        }

        const client = clients.find(c => c.id === selectedClientId);
        onMakeSale({
            items: cart,
            total: finalTotal,
            montantRecu: amountPaid,
            method: paymentMethod,
            clientId: selectedClientId,
            clientName: client?.nom || 'Client de passage',
            boutiqueId: selectedBoutiqueId,
            accountId,
            tva: tvaAmount,
            tvaRate: tvaEnabled ? COMPANY_CONFIG.tvaRate : 0,
            remise
        });

        // Reset
        setCart([]); setRemise(0); setAmountPaid(0); setSelectedClientId(''); setAccountId('');
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] gap-4 overflow-hidden">
            {/* Catalogue à gauche */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                        <input 
                            type="text" 
                            placeholder="Rechercher article..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-white" 
                        />
                    </div>
                    <select 
                        className="border rounded-lg px-3 py-2 text-sm bg-white font-bold text-brand-800" 
                        value={selectedBoutiqueId} 
                        onChange={e => setSelectedBoutiqueId(e.target.value)}
                    >
                        {boutiques.map(b => <option key={b.id} value={b.id}>📍 {b.nom}</option>)}
                    </select>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredArticles.map(a => (
                        <div 
                            key={a.id} 
                            className="border rounded-xl p-3 hover:border-brand-500 cursor-pointer transition-all flex flex-col bg-white group shadow-sm hover:shadow-md" 
                            onClick={() => addToCart(a, a.variantes[0] || 'Standard')}
                        >
                            <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                                {a.images && a.images[0] ? (
                                    <img src={a.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                ) : (
                                    <Tag size={32} className="text-gray-300"/>
                                )}
                            </div>
                            <h4 className="font-bold text-xs sm:text-sm text-gray-800 line-clamp-1">{a.nom}</h4>
                            <p className="text-[10px] text-gray-500 uppercase">{a.categorie}</p>
                            <p className="text-brand-600 font-black mt-auto pt-2">{a.prixVenteDefault.toLocaleString()} F</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Panier à droite */}
            <div className="w-full lg:w-[400px] flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-brand-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={20}/>
                        <h3 className="font-bold">Panier de Vente</h3>
                    </div>
                    <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">{cart.length} articles</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex-1 min-w-0 mr-2">
                                <p className="font-bold text-xs text-gray-800 truncate">{item.nom}</p>
                                <p className="text-[10px] text-gray-500">{item.variante}</p>
                                <p className="text-xs font-bold text-brand-600">{item.prix.toLocaleString()} F</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => updateQty(idx, -1)} className="p-1 border rounded bg-gray-50 hover:bg-gray-100"><Minus size={12}/></button>
                                <span className="font-bold text-sm w-4 text-center">{item.quantite}</span>
                                <button onClick={() => updateQty(idx, 1)} className="p-1 border rounded bg-gray-50 hover:bg-gray-100"><Plus size={12}/></button>
                                <button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600 ml-1 p-1"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="text-center py-20 text-gray-400 italic flex flex-col items-center">
                            <ShoppingBag size={48} className="opacity-10 mb-2"/>
                            <p>Le panier est vide</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white border-t border-gray-200 space-y-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                    {/* Options */}
                    <div className="grid grid-cols-2 gap-2">
                        <select className="text-xs p-2 border rounded-lg font-medium" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                            <option value="">-- Client de passage --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                        </select>
                        <div className="flex items-center gap-2 bg-gray-50 px-3 border rounded-lg">
                            <input type="checkbox" id="tva" checked={tvaEnabled} onChange={(e) => setTvaEnabled(e.target.checked)} className="rounded text-brand-600"/>
                            <label htmlFor="tva" className="text-[10px] font-bold text-gray-600 cursor-pointer uppercase">TVA ({COMPANY_CONFIG.tvaRate*100}%)</label>
                        </div>
                    </div>
                    
                    {/* Remise & Totaux */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Remise</label>
                            <input 
                                type="number" 
                                className="text-sm p-2 border rounded-lg w-full font-bold text-red-600" 
                                value={remise || ''} 
                                placeholder="0" 
                                onChange={(e) => setRemise(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="text-right flex flex-col justify-end">
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Sous-Total: {cartTotal.toLocaleString()} F</p>
                            {tvaEnabled && <p className="text-[10px] text-gray-500">TVA: +{tvaAmount.toLocaleString()} F</p>}
                            {remise > 0 && <p className="text-[10px] text-red-500">Remise: -{remise.toLocaleString()} F</p>}
                        </div>
                    </div>

                    <div className="border-t border-dashed border-gray-200 pt-2 flex justify-between items-end">
                        <span className="text-lg font-black text-gray-900">TOTAL</span>
                        <span className="text-2xl font-black text-brand-600">{finalTotal.toLocaleString()} F</span>
                    </div>

                    {/* Paiement */}
                    <div className="space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex gap-2">
                            <select className="flex-1 p-2 border rounded-lg text-xs font-bold bg-white" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as ModePaiement)}>
                                <option value="ESPECE">💵 ESPÈCE</option>
                                <option value="WAVE">📱 WAVE</option>
                                <option value="ORANGE_MONEY">🍊 OM</option>
                                <option value="VIREMENT">🏦 VIREMENT</option>
                            </select>
                            <div className="flex-1 relative">
                                <input 
                                    type="number" 
                                    className="w-full p-2 border rounded-lg text-sm font-black text-right pr-2 bg-white" 
                                    value={amountPaid || ''} 
                                    placeholder="0" 
                                    onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)}
                                />
                                <span className="absolute left-2 top-2.5 text-[10px] text-gray-400 font-bold">REÇU</span>
                            </div>
                        </div>
                        <select 
                            className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white font-medium" 
                            value={accountId} 
                            onChange={(e) => setAccountId(e.target.value)}
                        >
                            <option value="">-- Compte d'encaissement --</option>
                            {comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.solde.toLocaleString()} F)</option>))}
                        </select>
                    </div>

                    <button 
                        onClick={handleCheckout} 
                        disabled={cart.length === 0} 
                        className="w-full bg-brand-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-brand-700 transition-all disabled:bg-gray-200 disabled:shadow-none flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                    >
                        Valider la Vente <ChevronRight size={18}/>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesView;
