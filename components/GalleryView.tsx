
import React, { useState, useRef } from 'react';
import { GalleryItem } from '../types';
import { Image as ImageIcon, Plus, X, Search, Filter, Trash2, Tag, Upload, Calendar, Loader, Save, Edit2 } from 'lucide-react';
import { uploadImageToCloud } from '../services/storageService';

interface GalleryViewProps {
    items: GalleryItem[];
    onAddItem: (item: GalleryItem) => void;
    onUpdateItem: (item: GalleryItem) => void;
    onDeleteItem: (id: string) => void;
}

const GalleryView: React.FC<GalleryViewProps> = ({ items, onAddItem, onUpdateItem, onDeleteItem }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('TOUT');
    const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [newItem, setNewItem] = useState<Partial<GalleryItem>>({
        title: '',
        category: 'Homme',
        tags: [],
        description: ''
    });
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [tagInput, setTagInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const categories = ['TOUT', 'Homme', 'Femme', 'Enfant', 'Accessoire', 'Inspiration', 'Tissu'];

    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (item.tags && item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
        const matchesCategory = filterCategory === 'TOUT' || item.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPendingFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddTag = () => {
        if (tagInput.trim()) {
            setNewItem(prev => ({
                ...prev,
                tags: [...(prev.tags || []), tagInput.trim()]
            }));
            setTagInput('');
        }
    };

    const handleRemoveTag = (index: number) => {
        setNewItem(prev => ({
            ...prev,
            tags: prev.tags?.filter((_, i) => i !== index)
        }));
    };

    const openEditModal = () => {
        if (!selectedImage) return;
        setNewItem({
            id: selectedImage.id,
            title: selectedImage.title,
            category: selectedImage.category,
            tags: [...(selectedImage.tags || [])],
            description: selectedImage.description || '',
            imageUrl: selectedImage.imageUrl,
            dateAdded: selectedImage.dateAdded
        });
        setPreviewUrl(selectedImage.imageUrl);
        setIsEditing(true);
        setIsAddModalOpen(true);
    };

    const handleSave = async () => {
        if (!newItem.title || (!pendingFile && !isEditing)) {
            alert("Veuillez donner un titre et choisir une photo.");
            return;
        }

        setIsSaving(true);
        try {
            let imageUrl = newItem.imageUrl || '';

            if (pendingFile) {
                const uploadedUrl = await uploadImageToCloud(pendingFile, 'gallery');
                if (!uploadedUrl) {
                    throw new Error("Échec du traitement de l'image.");
                }
                imageUrl = uploadedUrl;
            }

            if (isEditing && newItem.id) {
                const updatedItem: GalleryItem = {
                    ...newItem as GalleryItem,
                    imageUrl,
                    tags: newItem.tags || []
                };
                onUpdateItem(updatedItem);
                setSelectedImage(updatedItem);
            } else {
                const item: GalleryItem = {
                    id: `IMG_${Date.now()}`,
                    title: newItem.title,
                    category: newItem.category || 'Autre',
                    imageUrl,
                    dateAdded: new Date().toISOString(),
                    tags: newItem.tags || [],
                    description: newItem.description || ''
                };
                onAddItem(item);
            }

            setIsAddModalOpen(false);
            setNewItem({ title: '', category: 'Homme', tags: [], description: '' });
            setPendingFile(null);
            setPreviewUrl(null);
            setIsEditing(false);
        } catch (error) {
            console.error(error);
            alert("Erreur lors de l'enregistrement.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ImageIcon className="text-brand-600" /> Galerie & Modèles
                </h2>
                
                <div className="flex gap-2 w-full sm:w-auto items-center">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Rechercher modèle, tag..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-bold"
                        />
                    </div>
                    <button 
                        onClick={() => {
                            setIsEditing(false);
                            setNewItem({ title: '', category: 'Homme', tags: [], description: '' });
                            setPendingFile(null);
                            setPreviewUrl(null);
                            setIsAddModalOpen(true);
                        }}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors whitespace-nowrap shadow-md active:scale-95"
                    >
                        <Plus size={20} /> Ajouter Photo
                    </button>
                </div>
            </div>

            {/* Filtres Catégories */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar shrink-0">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter whitespace-nowrap transition-all shadow-sm ${
                            filterCategory === cat 
                            ? 'bg-brand-900 text-white shadow-lg scale-105' 
                            : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Grille Images */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded-xl border border-gray-200 custom-scrollbar">
                {filteredItems.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredItems.map(item => (
                            <div 
                                key={item.id} 
                                className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer aspect-[3/4] border border-gray-100"
                                onClick={() => setSelectedImage(item)}
                            >
                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                    <h3 className="text-white font-black uppercase text-xs truncate tracking-tighter">{item.title}</h3>
                                    <p className="text-brand-300 text-[10px] font-bold uppercase">{item.category}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                        <ImageIcon size={64} className="mb-4 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-center">Aucun modèle trouvé<br/>dans cette catégorie</p>
                    </div>
                )}
            </div>

            {/* Lightbox Modal */}
            {selectedImage && (
                <div className="fixed inset-0 bg-brand-900/95 z-[500] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setSelectedImage(null)}>
                    <div className="relative max-w-4xl max-h-[95vh] w-full flex flex-col md:flex-row bg-white rounded-3xl overflow-hidden animate-in zoom-in duration-300 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex-1 bg-gray-900 flex items-center justify-center relative">
                            <img src={selectedImage.imageUrl} alt={selectedImage.title} className="max-w-full max-h-[60vh] md:max-h-[90vh] object-contain" />
                            <button onClick={() => setSelectedImage(null)} className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white md:hidden shadow-lg backdrop-blur-sm"><X size={24}/></button>
                        </div>
                        <div className="w-full md:w-80 bg-white p-8 flex flex-col border-l border-gray-100 h-full max-h-[95vh]">
                            <div className="flex justify-between items-start mb-6 shrink-0">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-tight">{selectedImage.title}</h3>
                                    <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest bg-brand-50 px-2 py-1 rounded mt-2 inline-block shadow-sm">#{selectedImage.category}</span>
                                </div>
                                <button onClick={() => setSelectedImage(null)} className="p-2 hover:bg-gray-100 rounded-full hidden md:block transition-colors"><X size={28} className="text-gray-400"/></button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2 mb-6">
                                {selectedImage.description && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</p>
                                        <p className="text-sm text-gray-600 leading-relaxed font-medium bg-gray-50 p-3 rounded-xl border border-gray-100">{selectedImage.description}</p>
                                    </div>
                                )}
                                
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Étiquettes</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedImage.tags?.map((tag, i) => (
                                            <span key={i} className="text-[10px] font-bold bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full border border-gray-100">#{tag}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100 text-[10px] text-gray-400 font-bold uppercase flex items-center gap-2 tracking-widest">
                                    <Calendar size={14} /> Ajouté le {new Date(selectedImage.dateAdded).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="pt-4 shrink-0 flex flex-col gap-2">
                                <button 
                                    onClick={openEditModal}
                                    className="w-full py-4 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm border border-blue-100 active:scale-95"
                                >
                                    <Edit2 size={16} /> Modifier les libellés
                                </button>
                                <button 
                                    onClick={() => {
                                        if (window.confirm("Supprimer cette image de la galerie ?")) {
                                            onDeleteItem(selectedImage.id);
                                            setSelectedImage(null);
                                        }
                                    }}
                                    className="w-full py-4 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm border border-red-100 active:scale-95"
                                >
                                    <Trash2 size={16} /> Supprimer Définitivement
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal - CORRIGÉ POUR L'AFFICHAGE */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-brand-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in zoom-in duration-300 border border-brand-100 overflow-hidden">
                        {/* Header Modal */}
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3">
                                {isEditing ? <Edit2 size={28} className="text-brand-600" /> : <ImageIcon size={28} className="text-brand-600" />}
                                {isEditing ? 'Modifier les infos' : 'Ajouter à la Galerie'}
                            </h3>
                            <button onClick={() => !isSaving && setIsAddModalOpen(false)} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><X size={28} className="text-gray-400"/></button>
                        </div>

                        {/* Contenu - Scrollable */}
                        <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Image Preview / Upload Section */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Photo du modèle</label>
                                <div 
                                    className="group border-4 border-dashed border-gray-100 rounded-3xl h-52 flex flex-col items-center justify-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-all relative overflow-hidden shadow-inner bg-gray-50"
                                    onClick={() => !isSaving && fileInputRef.current?.click()}
                                >
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <div className="bg-white p-4 rounded-full mb-3 text-brand-600 shadow-md group-hover:scale-110 transition-transform"><Upload size={28} /></div>
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest text-center">Cliquez ici pour choisir<br/>ou changer la photo</p>
                                        </>
                                    )}
                                    {isSaving && (
                                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                            <Loader className="animate-spin text-brand-600 mb-2" size={32}/>
                                            <p className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Optimisation...</p>
                                        </div>
                                    )}
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                    {isEditing && !pendingFile && !isSaving && (
                                        <div className="absolute bottom-0 left-0 w-full bg-black/40 text-white text-[9px] py-1 text-center font-bold uppercase backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">Modifier l'image</div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nom du modèle</label>
                                    <input type="text" disabled={isSaving} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-gray-50 focus:border-brand-600 focus:bg-white outline-none transition-all shadow-sm" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value.toUpperCase()})} placeholder="EX: TUNIQUE BAZIN LUXE" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Catégorie</label>
                                        <select disabled={isSaving} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50 focus:border-brand-600 focus:bg-white outline-none text-[10px] uppercase shadow-sm transition-all" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                                            {categories.filter(c => c !== 'TOUT').map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Mots-clés rapides</label>
                                        <div className="flex gap-2">
                                            <input type="text" disabled={isSaving} className="flex-1 p-4 border-2 border-gray-100 rounded-2xl text-[10px] font-bold bg-gray-50 focus:border-brand-600 focus:bg-white outline-none shadow-sm transition-all" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Tag..." onKeyPress={e => e.key === 'Enter' && handleAddTag()} />
                                            <button onClick={handleAddTag} disabled={isSaving} className="bg-brand-900 text-white p-4 rounded-2xl hover:bg-black transition-all shadow-md active:scale-95"><Plus size={20}/></button>
                                        </div>
                                    </div>
                                </div>

                                {newItem.tags && newItem.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                        {newItem.tags.map((tag, i) => (
                                            <span key={i} className="text-[9px] font-black bg-white text-brand-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-brand-100 shadow-sm">
                                                #{tag.toUpperCase()} <button onClick={() => handleRemoveTag(i)} className="text-red-400 hover:text-red-600"><X size={12}/></button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Description détaillée</label>
                                    <textarea disabled={isSaving} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-gray-50 focus:border-brand-600 focus:bg-white outline-none transition-all resize-none h-24 shadow-sm" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="Détails sur la coupe, le tissu, les broderies..." />
                                </div>
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="p-8 bg-gray-50 border-t flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsAddModalOpen(false)} disabled={isSaving} className="px-8 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Annuler</button>
                            <button onClick={handleSave} disabled={isSaving || !newItem.title || (!previewUrl && !isEditing)} className="px-12 py-4 bg-brand-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-brand-100 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                                {isSaving ? <Loader className="animate-spin" size={16}/> : <Save size={16}/>}
                                {isSaving ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Enregistrer')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GalleryView;
