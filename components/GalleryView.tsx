
import React, { useState, useRef } from 'react';
import { GalleryItem } from '../types';
import { Image as ImageIcon, Plus, X, Search, Filter, Trash2, Tag, Upload, Calendar } from 'lucide-react';

interface GalleryViewProps {
    items: GalleryItem[];
    onAddItem: (item: GalleryItem) => void;
    onDeleteItem: (id: string) => void;
}

const GalleryView: React.FC<GalleryViewProps> = ({ items, onAddItem, onDeleteItem }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('TOUT');
    const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form State
    const [newItem, setNewItem] = useState<Partial<GalleryItem>>({
        title: '',
        category: 'Homme',
        tags: [],
        description: ''
    });
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
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewItem(prev => ({ ...prev, imageUrl: reader.result as string }));
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

    const handleSave = () => {
        if (!newItem.title || !newItem.imageUrl) {
            alert("Titre et image sont requis.");
            return;
        }

        const item: GalleryItem = {
            id: `IMG_${Date.now()}`,
            title: newItem.title,
            category: newItem.category || 'Autre',
            imageUrl: newItem.imageUrl,
            dateAdded: new Date().toISOString(),
            tags: newItem.tags || [],
            description: newItem.description || ''
        };

        onAddItem(item);
        setIsAddModalOpen(false);
        setNewItem({ title: '', category: 'Homme', tags: [], description: '' });
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
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                        />
                    </div>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors whitespace-nowrap"
                    >
                        <Plus size={20} /> Ajouter Photo
                    </button>
                </div>
            </div>

            {/* Filtres Catégories */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                            filterCategory === cat 
                            ? 'bg-gray-800 text-white' 
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Grille Images */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded-xl border border-gray-200">
                {filteredItems.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredItems.map(item => (
                            <div 
                                key={item.id} 
                                className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer aspect-[3/4]"
                                onClick={() => setSelectedImage(item)}
                            >
                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                    <h3 className="text-white font-bold text-sm truncate">{item.title}</h3>
                                    <p className="text-gray-300 text-xs">{item.category}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <ImageIcon size={64} className="mb-4 opacity-20" />
                        <p>Aucune image trouvée.</p>
                    </div>
                )}
            </div>

            {/* Lightbox Modal */}
            {selectedImage && (
                <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col md:flex-row bg-white rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex-1 bg-black flex items-center justify-center relative">
                            <img src={selectedImage.imageUrl} alt={selectedImage.title} className="max-w-full max-h-[60vh] md:max-h-[85vh] object-contain" />
                        </div>
                        <div className="w-full md:w-80 bg-white p-6 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">{selectedImage.title}</h3>
                                    <span className="text-sm text-brand-600 font-medium">{selectedImage.category}</span>
                                </div>
                                <button onClick={() => setSelectedImage(null)} className="p-1 hover:bg-gray-100 rounded-full"><X size={24}/></button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-4">
                                {selectedImage.description && (
                                    <p className="text-gray-600 text-sm">{selectedImage.description}</p>
                                )}
                                
                                <div className="flex flex-wrap gap-2">
                                    {selectedImage.tags?.map((tag, i) => (
                                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">#{tag}</span>
                                    ))}
                                </div>

                                <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-2">
                                    <Calendar size={14} /> Ajouté le {new Date(selectedImage.dateAdded).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 mt-auto">
                                <button 
                                    onClick={() => {
                                        if (window.confirm("Supprimer cette image ?")) {
                                            onDeleteItem(selectedImage.id);
                                            setSelectedImage(null);
                                        }
                                    }}
                                    className="w-full py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Trash2 size={16} /> Supprimer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Upload size={20} className="text-brand-600" /> Ajouter Photo
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="hover:bg-gray-100 p-1 rounded-full"><X size={24}/></button>
                        </div>

                        <div className="space-y-4">
                            {/* Image Preview / Upload */}
                            <div 
                                className="border-2 border-dashed border-gray-300 rounded-lg h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-brand-400 transition-colors relative overflow-hidden"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {newItem.imageUrl ? (
                                    <img src={newItem.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <div className="bg-brand-50 p-3 rounded-full mb-2 text-brand-600"><Upload size={24} /></div>
                                        <p className="text-sm text-gray-500 font-medium">Cliquez pour choisir une image</p>
                                    </>
                                )}
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} placeholder="Ex: Robe Soirée Rouge" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                                <select className="w-full p-2 border border-gray-300 rounded" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                                    {categories.filter(c => c !== 'TOUT').map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                                <div className="flex gap-2 mb-2">
                                    <input type="text" className="flex-1 p-2 border border-gray-300 rounded text-sm" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Ex: Bazin, Broderie..." onKeyPress={e => e.key === 'Enter' && handleAddTag()} />
                                    <button onClick={handleAddTag} className="bg-gray-100 px-3 rounded hover:bg-gray-200"><Plus size={18}/></button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {newItem.tags?.map((tag, i) => (
                                        <span key={i} className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full flex items-center gap-1">
                                            {tag} <button onClick={() => handleRemoveTag(i)}><X size={12}/></button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea rows={2} className="w-full p-2 border border-gray-300 rounded" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="Détails sur le tissu, la coupe..." />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 font-bold">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GalleryView;
