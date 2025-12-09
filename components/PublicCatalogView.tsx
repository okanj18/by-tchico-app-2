
import React, { useState, useMemo } from 'react';
import { Article } from '../types';
import { COMPANY_CONFIG } from '../config';
import { ShoppingBag, X, MessageCircle, Heart, Search, Filter, Image as ImageIcon, ExternalLink, Share2 } from 'lucide-react';

interface PublicCatalogViewProps {
    articles: Article[];
}

const PublicCatalogView: React.FC<PublicCatalogViewProps> = ({ articles }) => {
    const [categoryFilter, setCategoryFilter] = useState('TOUT');
    const [searchTerm, setSearchTerm] = useState('');
    const [wishlist, setWishlist] = useState<Article[]>([]);
    const [showWishlist, setShowWishlist] = useState(false);

    // Filtrer uniquement les produits finis (pas de matière première)
    const catalogArticles = useMemo(() => {
        return articles.filter(a => 
            a.typeArticle === 'PRODUIT_FINI' && // On ne montre que les produits finis
            (categoryFilter === 'TOUT' || a.categorie === categoryFilter) &&
            a.nom.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [articles, categoryFilter, searchTerm]);

    const categories = ['TOUT', ...Array.from(new Set(articles.filter(a => a.typeArticle === 'PRODUIT_FINI').map(a => a.categorie)))];

    const toggleWishlist = (article: Article) => {
        if (wishlist.find(a => a.id === article.id)) {
            setWishlist(wishlist.filter(a => a.id !== article.id));
        } else {
            setWishlist([...wishlist, article]);
        }
    };

    const handleSendOrder = () => {
        if (wishlist.length === 0) return;

        const phone = COMPANY_CONFIG.phone.replace(/\s+/g, '').replace('+', '');
        let message = `Bonjour ${COMPANY_CONFIG.name}, je suis intéressé par ces articles de votre catalogue :\n\n`;
        
        wishlist.forEach(item => {
            message += `▪️ *${item.nom}* (${item.prixVenteDefault.toLocaleString()} ${COMPANY_CONFIG.currency})\n`;
        });
        
        message += `\nEst-ce disponible ? Merci !`;

        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-gray-50 -m-6 relative overflow-hidden">
            {/* Top Bar Showroom */}
            <div className="bg-white px-6 py-4 shadow-sm z-20 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Catalogue {COMPANY_CONFIG.name}</h2>
                    <p className="text-xs text-gray-500">Mode Showroom Client</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative hidden sm:block">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Rechercher..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-brand-500 w-64 transition-all"
                        />
                    </div>
                    <button 
                        onClick={() => setShowWishlist(true)}
                        className="relative p-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-transform hover:scale-105 shadow-lg"
                    >
                        <ShoppingBag size={20} />
                        {wishlist.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-full border-2 border-white">
                                {wishlist.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Categories */}
            <div className="px-6 py-3 bg-white border-b border-gray-100 flex gap-2 overflow-x-auto no-scrollbar z-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                            categoryFilter === cat 
                            ? 'bg-brand-600 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {catalogArticles.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                        {catalogArticles.map(article => {
                            const inWishlist = wishlist.some(a => a.id === article.id);
                            // Image logic: use first available image
                            const coverImage = article.images && article.images.length > 0 ? article.images[0] : null;

                            return (
                                <div key={article.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 group flex flex-col h-[350px]">
                                    {/* Image Area */}
                                    <div className="h-48 bg-gray-100 relative overflow-hidden">
                                        {coverImage ? (
                                            <img src={coverImage} alt={article.nom} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                                <ImageIcon size={48} />
                                                <span className="text-xs mt-2">Pas d'image</span>
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => toggleWishlist(article)}
                                            className={`absolute top-3 right-3 p-2 rounded-full shadow-md transition-all ${inWishlist ? 'bg-red-500 text-white scale-110' : 'bg-white text-gray-400 hover:text-red-500'}`}
                                        >
                                            <Heart size={18} fill={inWishlist ? "currentColor" : "none"} />
                                        </button>
                                        {article.variantes && article.variantes.length > 0 && (
                                            <div className="absolute bottom-3 left-3">
                                                <span className="bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full">
                                                    {article.variantes.length} Variantes
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Area */}
                                    <div className="p-4 flex flex-col flex-1 justify-between">
                                        <div>
                                            <div className="text-xs text-brand-600 font-bold uppercase tracking-wider mb-1">{article.categorie}</div>
                                            <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-1 mb-1">{article.nom}</h3>
                                            <p className="text-gray-500 text-xs line-clamp-2">{article.description || "Collection exclusive."}</p>
                                        </div>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                            <span className="text-xl font-bold text-gray-900">{article.prixVenteDefault.toLocaleString()} <span className="text-xs font-normal text-gray-500">{COMPANY_CONFIG.currency}</span></span>
                                            <button 
                                                onClick={() => toggleWishlist(article)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${inWishlist ? 'bg-gray-100 text-gray-600' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
                                            >
                                                {inWishlist ? 'Retirer' : 'Ajouter'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <ShoppingBag size={64} className="mb-4 opacity-20" />
                        <p className="text-lg">Aucun produit trouvé dans cette catégorie.</p>
                        <button onClick={() => setCategoryFilter('TOUT')} className="mt-4 text-brand-600 font-bold hover:underline">Voir tout le catalogue</button>
                    </div>
                )}
            </div>

            {/* Wishlist Sidebar / Drawer */}
            {showWishlist && (
                <>
                    <div className="absolute inset-0 bg-black/50 z-30 backdrop-blur-sm" onClick={() => setShowWishlist(false)}></div>
                    <div className="absolute top-0 right-0 h-full w-full sm:w-[400px] bg-white z-40 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <ShoppingBag className="text-brand-600" /> Ma Sélection ({wishlist.length})
                            </h3>
                            <button onClick={() => setShowWishlist(false)} className="p-1 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {wishlist.length > 0 ? wishlist.map(item => (
                                <div key={item.id} className="flex gap-3 items-center bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                        {item.images && item.images.length > 0 ? <img src={item.images[0]} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-gray-300"/></div>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-800 text-sm truncate">{item.nom}</h4>
                                        <p className="text-brand-600 text-sm font-bold">{item.prixVenteDefault.toLocaleString()} F</p>
                                    </div>
                                    <button onClick={() => toggleWishlist(item)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><X size={16}/></button>
                                </div>
                            )) : (
                                <div className="text-center py-10 text-gray-400">
                                    <Heart size={48} className="mx-auto mb-3 opacity-20" />
                                    <p>Votre liste est vide.</p>
                                    <button onClick={() => setShowWishlist(false)} className="mt-4 px-4 py-2 bg-gray-100 rounded-lg text-gray-600 text-sm hover:bg-gray-200">Parcourir le catalogue</button>
                                </div>
                            )}
                        </div>

                        <div className="p-5 border-t border-gray-100 bg-gray-50">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-gray-500 text-sm">Total Estimé</span>
                                <span className="text-xl font-bold text-gray-900">
                                    {wishlist.reduce((acc, i) => acc + i.prixVenteDefault, 0).toLocaleString()} {COMPANY_CONFIG.currency}
                                </span>
                            </div>
                            <button 
                                onClick={handleSendOrder}
                                disabled={wishlist.length === 0}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MessageCircle size={20} /> Commander sur WhatsApp
                            </button>
                            <p className="text-[10px] text-center text-gray-400 mt-2">
                                Vous serez redirigé vers WhatsApp pour finaliser avec un vendeur.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PublicCatalogView;
