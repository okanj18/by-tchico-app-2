
import React, { useState, useMemo } from 'react';
import { Article, Boutique, Client, Commande, CompteFinancier, ModePaiement, CompanyAssets } from '../types';
import { COMPANY_CONFIG } from '../config';
import { ShoppingBag, Search, Trash2, CreditCard, User, Tag, Plus, Minus, X } from 'lucide-react';

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
        a.nom.toLowerCase().includes(searchTerm.toLowerCase())
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

        setCart([]);
        setRemise(0);
        setAmountPaid(0);
        setSelectedClientId('');
    };

    return (
        <div className="flex h-full gap-4">
            {/* Catalog */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                        <input type="text" placeholder="Rechercher article..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
                    </div>
                    <select className="border rounded-lg px-3 py-2 text-sm" value={selectedBoutiqueId} onChange={e => setSelectedBoutiqueId(e.target.value)}>
                        {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                    </select>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredArticles.map(a => (
                        <div key={a.id} className="border rounded-lg p-3 hover:border-brand-500 cursor-pointer transition-colors flex flex-col" onClick={() => addToCart(a, a.variantes[0] || 'Standard')}>
                            <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center">
                                {a.images && a.images[0] ? <img src={a.images[0]} className="w-full h-full object-cover rounded" /> : <Tag size={24} className="text-gray-300"/>}
                            </div>
                            <h4 className="font-bold text-sm truncate">{a.nom}</h4>
                            <p className="text-brand-600 font-bold mt-auto">{a.prixVenteDefault.toLocaleString()} F</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cart & Checkout */}
            <div className="w-96 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-brand-900 text-white flex items-center gap-2">
                    <ShoppingBag size={20}/>
                    <h3 className="font-bold">Panier de Vente</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                            <div className="flex-1 min-w-0 mr-2">
                                <p className="font-bold text-xs truncate">{item.nom}</p>
                                <p className="text-[10px] text-gray-500">{item.variante}</p>
                                <p className="text-xs font-bold text-brand-600">{item.prix.toLocaleString()} F</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => updateQty(idx, -1)} className="p-1 border rounded"><Minus size={12}/></button>
                                <span className="font-bold text-sm">{item.quantite}</span>
                                <button onClick={() => updateQty(idx, 1)} className="p-1 border rounded"><Plus size={12}/></button>
                                <button onClick={() => removeFromCart(idx)} className="text-red-500 ml-1"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && <div className="text-center py-10 text-gray-400 italic">Le panier est vide.</div>}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <select className="text-xs p-2 border rounded" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                            <option value="">-- Client (Opt.) --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                        </select>
                        <div className="flex items-center gap-2 bg-white px-2 border rounded">
                            <input type="checkbox" checked={tvaEnabled} onChange={(e) => setTvaEnabled(e.target.checked)} className="rounded text-brand-600"/>
                            <span className="text-xs font-medium">TVA ({COMPANY_CONFIG.tvaRate*100}%)</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <input type="number" placeholder="Remise" className="text-xs p-2 border rounded w-1/2" value={remise || ''} onChange={(e) => setRemise(parseInt(e.target.value) || 0)}/>
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

                    <div className="space-y-2 pt-2 border-t border-gray-200">
                        <div className="flex gap-2">
                            <select className="flex-1 p-2 border rounded text-sm font-medium" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as ModePaiement)}>
                                <option value="ESPECE">Espèce</option>
                                <option value="WAVE">Wave</option>
                                <option value="ORANGE_MONEY">Orange Money</option>
                                <option value="VIREMENT">Virement</option>
                                <option value="CHEQUE">Chèque</option>
                            </select>
                            <input type="number" className="flex-1 p-2 border rounded text-sm font-bold text-right" placeholder="Montant Reçu" value={amountPaid || ''} onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)}/>
                        </div>
                        <select className="w-full p-2 border border-gray-300 rounded text-sm" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                            <option value="">-- Compte d'encaissement --</option>
                            {comptes.map(acc => (<option key={acc.id} value={acc.id}>{acc.nom} ({acc.type})</option>))}
                        </select>
                    </div>

                    <button onClick={handleCheckout} disabled={cart.length === 0} className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-brand-700 transition-colors disabled:bg-gray-300">
                        Valider la Vente
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesView;
