
import React, { useState, useEffect, useRef } from 'react';
import { Article, TypeArticle } from '../types';
import { Search, Plus, Tag, Edit2, X, Save, Box, Layers, DollarSign, Scissors, ShoppingBag, ArrowRightLeft, Trash2, Image as ImageIcon, Upload, CheckSquare, Square, LayoutGrid, List, QrCode, Archive, RotateCcw, AlertTriangle, Loader } from 'lucide-react';
import { QRGeneratorModal } from './QRTools';
import { uploadImageToCloud } from '../services/storageService'; // Import du service optimisé

interface ArticlesViewProps {
    articles: Article[];
    onAddArticle: (a: Article) => void;
    onUpdateArticle: (a: Article) => void;
}

const ArticlesView: React.FC<ArticlesViewProps> = ({ articles, onAddArticle, onUpdateArticle }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false); // État de chargement

    // QR Code State
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrArticle, setQrArticle] = useState<Article | null>(null);

    // Archive Confirmation State
    const [articleToArchive, setArticleToArchive] = useState<Article | null>(null);

    // --- FORM STATE ---
    const initialFormState: Partial<Article> = {
        nom: '',
        typeArticle: 'MATIERE_PREMIERE',
        categorie: 'Tissu',
        description: '',
        prixAchatDefault: 0,
        prixVenteDefault: 0,
        unite: 'Mètre',
        uniteAchat: '',
        ratioConversion: 1,
        variantes: [],
        seuilAlerte: 5,
        stockParLieu: {},
        images: []
    };

    const [formData, setFormData] = useState<Partial<Article>>(initialFormState);
    
    // --- VARIANT MANAGEMENT STATE ---
    const [hasSizes, setHasSizes] = useState(false);
    const [hasColors, setHasColors] = useState(false);
    
    interface VariantRow {
        id: string;
        size: string;
        color: string;
        quantity: number;
        originalKey?: string;
    }
    const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
    const [simpleQuantity, setSimpleQuantity] = useState(0);

    const filteredArticles = articles.filter(a => {
        const matchesSearch = a.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              a.categorie.toLowerCase().includes(searchTerm.toLowerCase());
        
        const isArchived = a.archived === true;
        
        return matchesSearch && (showArchived ? isArchived : !isArchived);
    });

    // --- HELPERS ---

    const requestArchive = (e: React.MouseEvent, article: Article) => {
        e.preventDefault();
        e.stopPropagation();
        setArticleToArchive(article);
    };

    const confirmArchive = () => {
        if (articleToArchive) {
            const updatedArticle = { ...articleToArchive, archived: !articleToArchive.archived };
            onUpdateArticle(updatedArticle);
            setArticleToArchive(null);
        }
    };

    const parseVariantsToRows = (article: Article): VariantRow[] => {
        if (!article.variantes || article.variantes.length === 0) {
            const total = Object.values(article.stockParLieu).reduce((acc: number, place) => acc + (place['Standard'] || 0), 0);
            setSimpleQuantity(total);
            return [];
        }

        return article.variantes.map((v, idx) => {
            let size = '';
            let color = '';
            if (v.includes(' - ')) {
                const parts = v.split(' - ');
                color = parts[0];
                size = parts[1];
            } else {
                color = v; 
            }

            const qty = Object.values(article.stockParLieu).reduce((acc: number, place) => acc + (place[v] || 0), 0);

            return {
                id: `v_${idx}`,
                size,
                color,
                quantity: qty,
                originalKey: v
            };
        });
    };

    // --- OPTIMIZED IMAGE UPLOAD ---
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setIsUploading(true);
            try {
                // Traitement séquentiel pour ne pas figer le navigateur
                // Surtout important si on est en mode hors ligne (traitement CPU compression)
                const newImages: string[] = [];
                for (let i = 0; i < files.length; i++) {
                    const url = await uploadImageToCloud(files[i], 'articles');
                    newImages.push(url);
                }
                
                setFormData(prev => ({
                    ...prev,
                    images: [...(prev.images || []), ...newImages]
                }));
            } catch (error) {
                console.error(error);
                alert("Erreur lors du traitement des images.");
            } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveImage = (index: number) => {
        if(window.confirm("Supprimer cette image ?")) {
            setFormData(prev => ({
                ...prev,
                images: prev.images?.filter((_, i) => i !== index)
            }));
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const openAddModal = () => {
        setFormData(initialFormState);
        setHasSizes(false);
        setHasColors(false);
        setVariantRows([{ id: 'v_0', size: '', color: '', quantity: 0 }]);
        setSimpleQuantity(0);
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const openEditModal = (a: Article) => {
        setFormData({ ...a });
        setSelectedArticleId(a.id);
        
        const rows = parseVariantsToRows(a);
        setVariantRows(rows);
        
        const detectedSizes = rows.some(r => r.size);
        const detectedColors = rows.some(r => r.color);
        setHasSizes(detectedSizes);
        setHasColors(detectedColors);
        
        if (!detectedSizes && !detectedColors && a.variantes.length === 0) {
            const total = Object.values(a.stockParLieu).reduce((acc: number, place) => acc + (place['Standard'] || 0), 0);
            setSimpleQuantity(total);
        } else if (rows.length === 0) {
             setVariantRows([{ id: 'v_0', size: '', color: '', quantity: 0 }]);
        }

        setIsEditing(true);
        setIsModalOpen(true);
    };

    const openQRModal = (a: Article) => {
        setQrArticle(a);
        setQrModalOpen(true);
    };

    const handleAddRow = () => {
        setVariantRows([...variantRows, { id: `v_${Date.now()}`, size: '', color: '', quantity: 0 }]);
    };

    const handleRemoveRow = (id: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette variante ?")) {
            setVariantRows(variantRows.filter(r => r.id !== id));
        }
    };

    const updateRow = (id: string, field: keyof VariantRow, value: string | number) => {
        setVariantRows(variantRows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const totalStockDisplay = (hasSizes || hasColors) 
        ? variantRows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0)
        : simpleQuantity;

    const handleSave = () => {
        if (!formData.nom) {
            alert("Le nom de l'article est requis");
            return;
        }

        let finalVariants: string[] = [];
        const desiredTotals: Record<string, number> = {};
        const renameMap: Record<string, string> = {}; 

        if (hasSizes || hasColors) {
            variantRows.forEach(row => {
                let key = '';
                if (hasColors && hasSizes) key = `${row.color} - ${row.size}`;
                else if (hasColors) key = row.color;
                else if (hasSizes) key = row.size;
                
                if (!key.trim()) return; 
                key = key.trim();

                finalVariants.push(key);
                desiredTotals[key] = Number(row.quantity) || 0;

                if (row.originalKey && row.originalKey !== key) {
                    renameMap[key] = row.originalKey;
                }
            });
        } else {
            desiredTotals['Standard'] = Number(simpleQuantity) || 0;
        }

        const existingStock = isEditing && selectedArticleId 
            ? articles.find(a => a.id === selectedArticleId)?.stockParLieu 
            : {};
        const newStockParLieu: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(existingStock || {}));
        
        if (!newStockParLieu['ATELIER']) newStockParLieu['ATELIER'] = {};

        Object.entries(renameMap).forEach(([newKey, oldKey]) => {
            Object.keys(newStockParLieu).forEach(lieuId => {
                const lieuStock = newStockParLieu[lieuId];
                if (lieuStock[oldKey] !== undefined) {
                    const qty = lieuStock[oldKey];
                    lieuStock[newKey] = (lieuStock[newKey] || 0) + qty;
                    delete lieuStock[oldKey];
                }
            });
        });

        const keysToProcess = (hasSizes || hasColors) ? finalVariants : ['Standard'];

        keysToProcess.forEach(variantKey => {
            const desiredTotal = desiredTotals[variantKey];
            let currentTotal = 0;
            Object.keys(newStockParLieu).forEach(lieu => {
                currentTotal += (newStockParLieu[lieu][variantKey] || 0);
            });

            const diff = desiredTotal - currentTotal;
            if (diff !== 0) {
                const currentAtelier = newStockParLieu['ATELIER'][variantKey] || 0;
                newStockParLieu['ATELIER'][variantKey] = Math.max(0, currentAtelier + diff);
            }
        });

        Object.keys(newStockParLieu).forEach(lieuId => {
            const lieuStock = newStockParLieu[lieuId];
            Object.keys(lieuStock).forEach(stockKey => {
                if (!keysToProcess.includes(stockKey)) {
                    delete lieuStock[stockKey];
                }
            });
        });

        const baseArticle = { ...formData } as Article;
        baseArticle.variantes = finalVariants;
        baseArticle.stockParLieu = newStockParLieu;

        if (isEditing && selectedArticleId) {
            const updated: Article = { id: selectedArticleId, ...baseArticle };
            onUpdateArticle(updated);
        } else {
            const newArticle: Article = { id: `A${Date.now()}`, ...baseArticle };
            onAddArticle(newArticle);
        }
        setIsModalOpen(false);
    };

    const categoriesMP = ['Tissu', 'Mercerie', 'Emballage', 'Autre'];
    const categoriesPF = ['Produit Fini', 'Accessoire', 'Chaussures', 'Maroquinerie', 'Autre'];

    const getStockTotal = (a: Article) => {
        return Object.values(a.stockParLieu).reduce((acc: number, place) => 
            acc + Object.values(place).reduce((acc2: number, qty) => acc2 + Number(qty), 0)
        , 0);
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Tag className="text-brand-600" /> Catalogue Articles
                </h2>
                
                <div className="flex w-full sm:w-auto items-center gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                        <button 
                            type="button"
                            onClick={() => setViewMode('GRID')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'GRID' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Vue Grille"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button 
                            type="button"
                            onClick={() => setViewMode('LIST')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Vue Liste"
                        >
                            <List size={18} />
                        </button>
                    </div>

                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Chercher un article..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                        />
                    </div>

                    <button 
                        type="button"
                        onClick={() => setShowArchived(!showArchived)} 
                        className={`px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm border ${showArchived ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                        <Archive size={16} />
                        <span className="hidden sm:inline">{showArchived ? 'Voir Actifs' : 'Archives'}</span>
                    </button>

                    {!showArchived && (
                        <button 
                            type="button"
                            onClick={openAddModal}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors whitespace-nowrap"
                        >
                            <Plus size={20} /> <span className="hidden sm:inline">Nouvel Article</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-gray-200">
                {viewMode === 'GRID' ? (
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredArticles.map(article => (
                            <div key={article.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow group relative flex flex-col h-full">
                                <div className="flex items-start gap-4 mb-3 flex-1">
                                    <div className={`p-1 rounded-lg w-20 h-20 flex items-center justify-center overflow-hidden border border-gray-100 ${(!article.images || article.images.length === 0) ? (article.typeArticle === 'MATIERE_PREMIERE' ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-600') : 'bg-gray-50'} shrink-0`}>
                                        {article.images && article.images.length > 0 ? (
                                            <img src={article.images[0]} alt={article.nom} className="w-full h-full object-cover rounded-md" />
                                        ) : (
                                            article.typeArticle === 'MATIERE_PREMIERE' ? <Scissors size={24} /> : <ShoppingBag size={24} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 text-lg truncate">{article.nom}</h3>
                                        <div className="flex flex-col gap-1 mt-1">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 w-fit">
                                                {article.categorie}
                                            </span>
                                            <span className="text-[10px] text-gray-400 uppercase">
                                                {article.typeArticle === 'MATIERE_PREMIERE' ? 'Matière Première' : 'Produit Fini'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[2.5rem]">
                                    {article.description || "Aucune description."}
                                </p>

                                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                        <p className="text-xs text-gray-500">Prix Achat</p>
                                        <p className="font-bold text-gray-800">
                                            {article.prixAchatDefault.toLocaleString()} F
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                        <p className="text-xs text-gray-500">Prix Vente</p>
                                        <p className="font-bold text-green-600">{article.prixVenteDefault.toLocaleString()} F</p>
                                    </div>
                                </div>

                                {article.variantes && article.variantes.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-4">
                                        {article.variantes.slice(0, 5).map((v, i) => (
                                            <span key={i} className="text-[10px] bg-brand-50 text-brand-800 px-2 py-0.5 rounded-full border border-brand-100">
                                                {v}
                                            </span>
                                        ))}
                                        {article.variantes.length > 5 && (
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">+{article.variantes.length - 5}</span>
                                        )}
                                    </div>
                                )}

                                {/* CARD FOOTER ACTIONS */}
                                <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-end gap-2 relative z-10">
                                    <button 
                                        type="button"
                                        onClick={() => openQRModal(article)}
                                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors bg-white shadow-sm"
                                        title="Code QR"
                                    >
                                        <QrCode size={16} />
                                    </button>
                                    {!showArchived ? (
                                        <>
                                            <button 
                                                type="button"
                                                onClick={() => openEditModal(article)}
                                                className="flex-1 py-2 px-3 text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                                                title="Modifier"
                                            >
                                                <Edit2 size={16} /> Modifier
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={(e) => requestArchive(e, article)}
                                                className="p-2 text-red-500 hover:bg-red-50 border border-red-100 rounded-lg transition-colors bg-white shadow-sm hover:text-red-700"
                                                title="Archiver"
                                            >
                                                <Archive size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            type="button"
                                            onClick={(e) => requestArchive(e, article)}
                                            className="flex-1 py-2 px-3 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                                            title="Restaurer"
                                        >
                                            <RotateCcw size={16} /> Restaurer
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredArticles.length === 0 && (
                            <div className="col-span-full py-12 text-center text-gray-400 italic">
                                {showArchived ? "Aucun article archivé." : "Aucun article trouvé."}
                            </div>
                        )}
                    </div>
                ) : (
                    // LIST VIEW (TABLE)
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="py-3 px-4 w-12">Img</th>
                                    <th className="py-3 px-4">Article</th>
                                    <th className="py-3 px-4">Type/Catégorie</th>
                                    <th className="py-3 px-4 text-center">Stock Total</th>
                                    <th className="py-3 px-4 text-right">Prix Achat</th>
                                    <th className="py-3 px-4 text-right">Prix Vente</th>
                                    <th className="py-3 px-4 w-32 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredArticles.map(article => (
                                    <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className={`w-10 h-10 rounded overflow-hidden flex items-center justify-center border border-gray-200 ${(!article.images || article.images.length === 0) ? 'bg-gray-100' : ''}`}>
                                                {article.images && article.images.length > 0 ? (
                                                    <img src={article.images[0]} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    article.typeArticle === 'MATIERE_PREMIERE' ? <Scissors size={16} className="text-amber-600"/> : <ShoppingBag size={16} className="text-purple-600"/>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="font-bold text-gray-800">{article.nom}</p>
                                            {article.variantes && article.variantes.length > 0 && (
                                                <p className="text-xs text-gray-500">{article.variantes.length} variantes</p>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="text-gray-700">{article.categorie}</p>
                                            <p className="text-[10px] text-gray-400 uppercase">{article.typeArticle === 'MATIERE_PREMIERE' ? 'Matière Prem.' : 'Produit Fini'}</p>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`font-bold px-2 py-1 rounded text-xs ${getStockTotal(article) <= article.seuilAlerte ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-800'}`}>
                                                {getStockTotal(article)} {article.unite}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-600">
                                            {article.prixAchatDefault.toLocaleString()} F
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-green-700">
                                            {article.prixVenteDefault.toLocaleString()} F
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button 
                                                    type="button"
                                                    onClick={() => openQRModal(article)}
                                                    className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                                                    title="Code QR"
                                                >
                                                    <QrCode size={16} />
                                                </button>
                                                {!showArchived ? (
                                                    <>
                                                        <button 
                                                            type="button"
                                                            onClick={() => openEditModal(article)}
                                                            className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                                                            title="Modifier"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => requestArchive(e, article)}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors z-10 relative"
                                                            title="Archiver"
                                                        >
                                                            <Archive size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => requestArchive(e, article)}
                                                        className="p-1.5 text-green-500 hover:bg-green-50 rounded transition-colors z-10 relative"
                                                        title="Restaurer"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredArticles.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-gray-400">
                                            {showArchived ? "Aucun article archivé." : "Aucun article trouvé."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Archive Confirmation Modal */}
            {articleToArchive && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-full ${articleToArchive.archived ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {articleToArchive.archived ? <RotateCcw size={24}/> : <AlertTriangle size={24}/>}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">
                                {articleToArchive.archived ? 'Restaurer cet article ?' : 'Archiver cet article ?'}
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">
                            {articleToArchive.archived 
                                ? `L'article "${articleToArchive.nom}" sera de nouveau visible dans le catalogue actif.`
                                : `L'article "${articleToArchive.nom}" sera déplacé dans les archives. Il ne sera plus visible lors des ventes.`}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setArticleToArchive(null)}
                                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={confirmArchive}
                                className={`px-4 py-2 text-white rounded-lg font-bold transition-colors shadow-sm ${articleToArchive.archived ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {articleToArchive.archived ? 'Restaurer' : 'Confirmer Archivage'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            {qrArticle && (
                <QRGeneratorModal
                    isOpen={qrModalOpen}
                    onClose={() => setQrModalOpen(false)}
                    value={qrArticle.id}
                    title={qrArticle.nom}
                    subtitle={qrArticle.categorie}
                    price={qrArticle.prixVenteDefault}
                />
            )}

            {/* Modal - REDESIGNED */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[95vh] flex flex-col">
                         <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                                <Tag size={24} className="text-brand-600"/>
                                {isEditing ? 'Modifier Article' : 'Nouvel Article'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-gray-100 p-1 rounded-full">
                                <X size={24} className="text-gray-500"/>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Section 1: Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type d'Article</label>
                                    <select 
                                        value={formData.typeArticle}
                                        onChange={e => setFormData({...formData, typeArticle: e.target.value as any})}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500"
                                    >
                                        <option value="MATIERE_PREMIERE">Matière Première</option>
                                        <option value="PRODUIT_FINI">Produit Fini / Revente</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                                    <select 
                                        value={formData.categorie}
                                        onChange={e => setFormData({...formData, categorie: e.target.value})}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500"
                                    >
                                        {(formData.typeArticle === 'MATIERE_PREMIERE' ? categoriesMP : categoriesPF).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'article</label>
                                    <input 
                                        type="text" 
                                        value={formData.nom}
                                        onChange={e => setFormData({...formData, nom: e.target.value})}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500"
                                        placeholder="Ex: Tissu Bazin Riche"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Prix d'achat (FCFA)</label>
                                        <input 
                                            type="number" 
                                            value={formData.prixAchatDefault}
                                            onChange={e => setFormData({...formData, prixAchatDefault: parseInt(e.target.value) || 0})}
                                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (FCFA)</label>
                                        <input 
                                            type="number" 
                                            value={formData.prixVenteDefault}
                                            onChange={e => setFormData({...formData, prixVenteDefault: parseInt(e.target.value) || 0})}
                                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Unité Stock</label>
                                        <select 
                                            value={formData.unite}
                                            onChange={e => setFormData({...formData, unite: e.target.value})}
                                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500"
                                        >
                                            <option value="Mètre">Mètre</option>
                                            <option value="Yard">Yard</option>
                                            <option value="Pièce">Pièce</option>
                                            <option value="Paire">Paire</option>
                                            <option value="Kg">Kg</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <hr className="my-6 border-gray-100" />

                            {/* Section 2: Variants */}
                            <div className="mb-6">
                                <div className="flex gap-6 mb-4">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <div 
                                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${hasSizes ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 bg-white'}`}
                                            onClick={() => setHasSizes(!hasSizes)}
                                        >
                                            {hasSizes && <CheckSquare size={14} />}
                                        </div>
                                        <span className="text-sm text-gray-700 font-medium">Ce produit a plusieurs tailles</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <div 
                                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${hasColors ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 bg-white'}`}
                                            onClick={() => setHasColors(!hasColors)}
                                        >
                                            {hasColors && <CheckSquare size={14} />}
                                        </div>
                                        <span className="text-sm text-gray-700 font-medium">Ce produit a plusieurs couleurs</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantité en stock (Total)</label>
                                        <input 
                                            type="number" 
                                            disabled={hasSizes || hasColors} // Read-only if variants
                                            value={totalStockDisplay}
                                            onChange={e => setSimpleQuantity(parseInt(e.target.value) || 0)}
                                            className={`w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 font-bold text-gray-900 ${(hasSizes || hasColors) ? 'bg-gray-100' : 'bg-white'}`}
                                        />
                                        {(hasSizes || hasColors) && <p className="text-xs text-gray-500 mt-1">Calculé via les variantes</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Seuil d'alerte</label>
                                        <input 
                                            type="number" 
                                            value={formData.seuilAlerte}
                                            onChange={e => setFormData({...formData, seuilAlerte: parseInt(e.target.value) || 0})}
                                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500"
                                        />
                                    </div>
                                </div>

                                {(hasSizes || hasColors) && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                                        <h4 className="font-bold text-gray-800 mb-3 text-sm">Variantes</h4>
                                        <div className="space-y-2">
                                            {variantRows.map((row) => (
                                                <div key={row.id} className="flex gap-3 items-end">
                                                    {hasSizes && (
                                                        <div className="flex-1">
                                                            <label className="block text-xs text-gray-500 mb-1">Taille</label>
                                                            <input 
                                                                type="text" 
                                                                value={row.size}
                                                                onChange={e => updateRow(row.id, 'size', e.target.value)}
                                                                placeholder="ex: S, 42"
                                                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-500"
                                                            />
                                                        </div>
                                                    )}
                                                    {hasColors && (
                                                        <div className="flex-1">
                                                            <label className="block text-xs text-gray-500 mb-1">Couleur</label>
                                                            <input 
                                                                type="text" 
                                                                value={row.color}
                                                                onChange={e => updateRow(row.id, 'color', e.target.value)}
                                                                placeholder="ex: Blanc, Rouge"
                                                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-500"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="w-24">
                                                        <label className="block text-xs text-gray-500 mb-1">Quantité</label>
                                                        <input 
                                                            type="number" 
                                                            value={row.quantity}
                                                            onChange={e => updateRow(row.id, 'quantity', parseInt(e.target.value) || 0)}
                                                            className="w-full p-2 border border-gray-300 rounded text-sm font-bold text-center focus:ring-1 focus:ring-brand-500"
                                                        />
                                                    </div>
                                                    <button 
                                                        onClick={() => handleRemoveRow(row.id)}
                                                        className="p-2 mb-[1px] text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        title="Supprimer variante"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button 
                                            onClick={handleAddRow}
                                            className="mt-3 text-sm text-brand-600 font-bold hover:text-brand-700 flex items-center gap-1 bg-brand-50 px-3 py-2 rounded-lg border border-brand-200 hover:bg-brand-100 transition-colors"
                                        >
                                            <Plus size={16} /> Ajouter une variante
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Section 3: Images Uploader (OPTIMIZED) */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Images du produit</label>
                                
                                <div className="grid grid-cols-4 gap-4 mb-4">
                                    {/* Upload Button */}
                                    <div 
                                        className={`w-full aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-600 transition-colors cursor-pointer ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
                                        onClick={!isUploading ? triggerFileInput : undefined}
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader className="animate-spin mb-2" size={24} />
                                                <span className="text-xs font-bold">Traitement...</span>
                                            </>
                                        ) : (
                                            <>
                                                <ImageIcon size={24} className="mb-2" />
                                                <span className="text-xs font-bold">Ajouter</span>
                                            </>
                                        )}
                                    </div>

                                    {/* Existing Images */}
                                    {formData.images?.map((img, index) => (
                                        <div key={index} className="relative w-full aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                                            <img src={img} alt={`Produit ${index + 1}`} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => handleRemoveImage(index)}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                            {index === 0 && (
                                                <div className="absolute bottom-0 left-0 w-full bg-black/50 text-white text-[10px] text-center py-1">
                                                    Couverture
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleImageUpload} 
                                    className="hidden" 
                                    accept="image/*"
                                    multiple 
                                />
                                <p className="text-xs text-gray-500">
                                    Les images sont compressées automatiquement pour garantir un affichage rapide (même hors ligne).
                                </p>
                            </div>
                        </div>

                         <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2 font-bold shadow-sm">
                                <Save size={18} /> Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArticlesView;
