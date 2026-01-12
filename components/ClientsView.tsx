
import React, { useState, useMemo, useRef } from 'react';
import { Client, Commande, MesureHistorique, ModeleRealise } from '../types';
import { User, Ruler, Plus, X, Save, Edit2, Copy, Check, Search, Mic, Trash2, Mail, ClipboardList, Send, Trophy, Medal, Award, Users, AlertCircle, Calendar, Sparkles, BookOpen, History, Scissors, Camera, Image as ImageIcon, Loader, Download, FileText, ChevronLeft, Cake } from 'lucide-react';
import { parseMeasurementsFromText, recommendFabricMeterage } from '../services/geminiService';
import { COMPANY_CONFIG } from '../config';
import { uploadImageToCloud } from '../services/storageService';

interface ClientsViewProps {
    clients: Client[];
    commandes: Commande[];
    onAddClient: (client: Client) => void;
    onUpdateClient: (client: Client) => void;
    onDeleteClient: (id: string) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ clients, commandes, onAddClient, onUpdateClient, onDeleteClient }) => {
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [activeDetailTab, setActiveDetailTab] = useState<'MESURES' | 'STYLE' | 'HISTO' | 'MODELES'>('MESURES');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const selectedClient = useMemo(() => 
        clients.find(c => c.id === selectedClientId) || null
    , [clients, selectedClientId]);

    const [isAddingModeleModal, setIsAddingModeleModal] = useState(false);
    const [pendingModeleFile, setPendingModeleFile] = useState<File | null>(null);
    const [pendingModelePreview, setPendingModelePreview] = useState<string | null>(null);
    const [pendingDescription, setPendingDescription] = useState('');
    const [editingModeleIdx, setEditingModeleIdx] = useState<number | null>(null);

    const [aiGarmentType, setAiGarmentType] = useState('');
    const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const [clientFormData, setClientFormData] = useState<Partial<Client>>({
        nom: '', telephone: '', email: '', dateAnniversaire: '', notes: '', stylePreferences: '', mesures: {}
    });

    const MEASUREMENT_FIELDS = [
        { key: 'epaule', label: 'ÉPAULE' },
        { key: 'longueurManche', label: 'LONG. MANCHE' },
        { key: 'tourBras', label: 'TOUR DE BRAS' },
        { key: 'tourPoignet', label: 'TOUR POIGNET' },
        { key: 'tourCou', label: 'TOUR DE COU' },
        { key: 'poitrine', label: 'POITRINE' },
        { key: 'taille', label: 'TAILLE' },
        { key: 'blouse', label: 'BLOUSE' },
        { key: 'carrureDevant', label: 'CARRURE DEVANT' },
        { key: 'carrureDos', label: 'CARRURE DOS' },
        { key: 'longueurBoubou', label: 'LONG. BOUBOU' },
        { key: 'longueurChemise', label: 'LONG. CHEMISE' },
        { key: 'ceinture', label: 'CEINTURE' },
        { key: 'tourFesse', label: 'TOUR DE FESSE' },
        { key: 'tourCuisse', label: 'TOUR DE CUISSE' },
        { key: 'entreJambe', label: 'ENTRE JAMBE' },
        { key: 'longueurPantalon', label: 'LONG. PANTALON' },
        { key: 'genou', label: 'GENOU' },
        { key: 'mollet', label: 'MOLLET' },
        { key: 'bas', label: 'BAS' }
    ];

    const filteredClients = useMemo(() => {
        return clients.filter(c => 
            c.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.telephone.includes(searchTerm)
        ).sort((a, b) => a.nom.localeCompare(b.nom));
    }, [clients, searchTerm]);

    const getClientRank = (clientId: string) => {
        const count = commandes.filter(cmd => cmd.clientId === clientId && cmd.statut !== 'Annulé').length;
        if (count >= 10) return { label: 'OR', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: <Trophy size={14} className="text-yellow-600"/>, border: 'border-yellow-200' };
        if (count >= 5) return { label: 'ARGENT', color: 'text-slate-400', bg: 'bg-slate-50', icon: <Medal size={14} className="text-slate-500"/>, border: 'border-slate-200' };
        if (count >= 1) return { label: 'BRONZE', color: 'text-orange-600', bg: 'bg-orange-50', icon: <Award size={14} className="text-orange-600"/>, border: 'border-orange-200' };
        return null;
    };

    const handleSave = () => {
        if (!clientFormData.nom || !clientFormData.telephone) { alert("Le nom et le téléphone sont obligatoires."); return; }
        
        if (isEditing && selectedClient) {
            const oldMesures = JSON.stringify(selectedClient.mesures);
            const newMesures = JSON.stringify(clientFormData.mesures);
            
            let updatedHistory = [...(selectedClient.mesuresHistorique || [])];
            if (oldMesures !== newMesures) {
                updatedHistory = [
                    { date: new Date().toISOString(), valeurs: selectedClient.mesures },
                    ...updatedHistory
                ].slice(0, 10);
            }

            const finalClient = { 
                ...selectedClient, 
                ...clientFormData, 
                mesuresHistorique: updatedHistory,
                lastOrderDate: Date.now() 
            } as Client;
            onUpdateClient(finalClient);
        } else {
            const finalClient = { 
                ...clientFormData, 
                id: `C${Date.now()}`, 
                lastOrderDate: Date.now(),
                mesuresHistorique: [],
                modelesCousus: []
            } as Client;
            onAddClient(finalClient);
            setSelectedClientId(finalClient.id);
        }
        setIsModalOpen(false);
    };

    const handleAiRecommendation = async () => {
        if (!selectedClient || !aiGarmentType) return;
        setIsAiLoading(true);
        const rec = await recommendFabricMeterage(selectedClient.mesures, aiGarmentType);
        setAiRecommendation(rec);
        setIsAiLoading(false);
    };

    const handleCopyMeasurements = () => {
        if (!selectedClient) return;
        const measurementsText = MEASUREMENT_FIELDS
            .map(f => {
                const val = selectedClient.mesures?.[f.key];
                return val ? `${f.label}: ${val} cm` : null;
            })
            .filter(x => x !== null)
            .join('\n');
        
        const fullText = `FICHE DE MESURES - ${COMPANY_CONFIG.name}\nClient: ${selectedClient.nom}\n\n${measurementsText}`;
        
        navigator.clipboard.writeText(fullText).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const handleSendToWhatsApp = () => {
        if (!selectedClient) return;
        const measurementsText = MEASUREMENT_FIELDS
            .map(f => {
                const val = selectedClient.mesures?.[f.key];
                return val ? `*${f.label}*: ${val} cm` : null;
            })
            .filter(x => x !== null)
            .join('\n');

        const message = `Bonjour ${selectedClient.nom}, voici votre fiche de mesures chez *${COMPANY_CONFIG.name}* :\n\n${measurementsText}`;
        const phone = selectedClient.telephone.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setPendingModeleFile(file);
        setPendingDescription('');
        setEditingModeleIdx(null);
        
        const reader = new FileReader();
        reader.onloadend = () => {
            setPendingModelePreview(reader.result as string);
            setIsAddingModeleModal(true);
        };
        reader.readAsDataURL(file);
    };

    const handleSaveNewModele = async () => {
        if (!pendingModeleFile || !selectedClient) return;

        setIsUploading(true);
        try {
            const url = await uploadImageToCloud(pendingModeleFile, `clients/${selectedClient.id}/modeles`);
            const nouveauModele: ModeleRealise = {
                url,
                date: new Date().toISOString(),
                description: pendingDescription.trim()
            };

            const updatedClient = {
                ...selectedClient,
                modelesCousus: [nouveauModele, ...(selectedClient.modelesCousus || [])]
            };
            
            onUpdateClient(updatedClient);
            setIsAddingModeleModal(false);
            setPendingModeleFile(null);
            setPendingModelePreview(null);
        } catch (error) {
            console.error("Erreur upload modèle:", error);
            alert("Erreur lors de l'enregistrement de la photo.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleOpenEditDescription = (idx: number) => {
        if (!selectedClient?.modelesCousus) return;
        const mod = selectedClient.modelesCousus[idx];
        setEditingModeleIdx(idx);
        setPendingModelePreview(mod.url);
        setPendingDescription(mod.description || '');
        setPendingModeleFile(null);
        setIsAddingModeleModal(true);
    };

    const handleUpdateDescription = () => {
        if (!selectedClient?.modelesCousus || editingModeleIdx === null) return;
        
        const newList = [...selectedClient.modelesCousus];
        newList[editingModeleIdx] = {
            ...newList[editingModeleIdx],
            description: pendingDescription.trim()
        };

        onUpdateClient({ ...selectedClient, modelesCousus: newList });
        setIsAddingModeleModal(false);
        setEditingModeleIdx(null);
    };

    const deleteModele = (idx: number) => {
        if (!selectedClient || !window.confirm("Supprimer cette réalisation de l'historique ?")) return;
        const newList = [...(selectedClient.modelesCousus || [])];
        newList.splice(idx, 1);
        onUpdateClient({ ...selectedClient, modelesCousus: newList });
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
            {/* SIDEBAR RÉPERTOIRE - Caché sur mobile si un client est sélectionné */}
            <div className={`w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden ${selectedClientId ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-black text-gray-700 uppercase text-[10px] tracking-widest">Répertoire Clients</h3>
                        <p className="text-[10px] font-bold text-brand-600 uppercase flex items-center gap-1 mt-0.5"><Users size={12}/> {clients.length} au total</p>
                    </div>
                    <button onClick={() => { setClientFormData({ nom: '', telephone: '', email: '', dateAnniversaire: '', notes: '', stylePreferences: '', mesures: {} }); setIsEditing(false); setIsModalOpen(true); }} className="bg-brand-900 text-white p-2 rounded-full hover:bg-black shadow-md transition-all active:scale-95"><Plus size={18}/></button>
                </div>
                <div className="p-4 border-b shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input type="text" placeholder="Rechercher un client..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-brand-500 outline-none font-bold" />
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {filteredClients.map(c => {
                        const rank = getClientRank(c.id);
                        return (
                            <div key={c.id} onClick={() => { setSelectedClientId(c.id); setActiveDetailTab('MESURES'); }} className={`p-4 border-b cursor-pointer transition-colors hover:bg-brand-50 flex items-center justify-between ${selectedClientId === c.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''}`}>
                                <div>
                                    <p className="font-bold text-gray-800 uppercase text-xs">{c.nom}</p>
                                    <p className="text-[10px] text-gray-400 mt-1 font-mono">{c.telephone}</p>
                                </div>
                                {rank && (
                                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${rank.bg} ${rank.border} ${rank.color} text-[8px] font-black uppercase tracking-tighter shadow-sm`}>
                                        {rank.icon} {rank.label}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* VUE DÉTAILLÉE - Affiché sur mobile uniquement si un client est sélectionné */}
            <div className={`flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden ${!selectedClientId ? 'hidden lg:flex' : 'flex'}`}>
                {selectedClient ? (
                    <>
                        {/* Header Client */}
                        <div className="p-4 md:p-6 border-b bg-gray-50/50 shrink-0">
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setSelectedClientId(null)} className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-brand-900 transition-colors"><ChevronLeft size={24}/></button>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-lg md:text-2xl font-black text-gray-800 uppercase tracking-tighter truncate max-w-[150px] md:max-w-none">{selectedClient.nom}</h2>
                                                {(() => {
                                                    const rank = getClientRank(selectedClient.id);
                                                    return rank && <div className={`${rank.bg} ${rank.color} ${rank.border} border px-2 py-0.5 rounded-full hidden sm:flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest shadow-sm`}>{rank.icon} VIP {rank.label}</div>;
                                                })()}
                                            </div>
                                            <div className="flex gap-4 mt-1 text-[10px] font-black text-gray-500 uppercase">
                                                <span className="flex items-center gap-1">{selectedClient.telephone}</span>
                                                {selectedClient.dateAnniversaire && (
                                                    <span className="flex items-center gap-1 text-pink-600">
                                                        <Cake size={12}/> {new Date(selectedClient.dateAnniversaire).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setClientFormData({ ...selectedClient }); setIsEditing(true); setIsModalOpen(true); }} className="p-2 bg-white text-gray-400 border border-gray-200 rounded-lg hover:text-brand-600 transition-all shadow-sm"><Edit2 size={16}/></button>
                                        <button onClick={() => { if(window.confirm("Supprimer ce client ?")) { onDeleteClient(selectedClient.id); setSelectedClientId(null); } }} className="p-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-all shadow-sm"><Trash2 size={16}/></button>
                                    </div>
                                </div>

                                {/* Tabs Détails */}
                                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 border-b border-gray-100">
                                    <button onClick={() => setActiveDetailTab('MESURES')} className={`pb-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeDetailTab === 'MESURES' ? 'border-brand-600 text-brand-900' : 'border-transparent text-gray-400'}`}>Fiche Technique</button>
                                    <button onClick={() => setActiveDetailTab('MODELES')} className={`pb-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeDetailTab === 'MODELES' ? 'border-brand-600 text-brand-900' : 'border-transparent text-gray-400'}`}>Modèles Réalisés</button>
                                    <button onClick={() => setActiveDetailTab('STYLE')} className={`pb-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeDetailTab === 'STYLE' ? 'border-brand-600 text-brand-900' : 'border-transparent text-gray-400'}`}>Carnet de Style</button>
                                    <button onClick={() => setActiveDetailTab('HISTO')} className={`pb-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeDetailTab === 'HISTO' ? 'border-brand-600 text-brand-900' : 'border-transparent text-gray-400'}`}>Historique Mesures</button>
                                </div>
                            </div>
                        </div>

                        {/* Contenu Detail */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                            {activeDetailTab === 'MESURES' && (
                                <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
                                    {/* AI METERAGE TOOL */}
                                    <div className="bg-brand-900 text-white p-4 md:p-6 rounded-2xl shadow-xl border-b-4 border-brand-700 relative overflow-hidden">
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2"><Sparkles size={16} className="text-brand-300"/> Assistant IA</h4>
                                                <div className="flex gap-2">
                                                    <button onClick={handleCopyMeasurements} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all">
                                                        {copySuccess ? <Check size={16} className="text-green-400"/> : <Copy size={16}/>}
                                                    </button>
                                                    <button onClick={handleSendToWhatsApp} className="p-2 bg-green-600/50 hover:bg-green-600 rounded-lg transition-all">
                                                        <Send size={16}/>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-col md:flex-row gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Type de vêtement..." 
                                                    className="flex-1 p-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold focus:bg-white/20 outline-none"
                                                    value={aiGarmentType}
                                                    onChange={e => setAiGarmentType(e.target.value)}
                                                />
                                                <button 
                                                    onClick={handleAiRecommendation}
                                                    disabled={isAiLoading || !aiGarmentType}
                                                    className="w-full md:w-auto px-6 py-3 bg-brand-400 hover:bg-brand-300 text-brand-900 font-black uppercase text-[10px] rounded-xl transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    {isAiLoading ? '...' : 'Métrage'}
                                                </button>
                                            </div>
                                            {aiRecommendation && (
                                                <div className="mt-4 p-4 bg-white/10 rounded-xl border border-white/10 animate-in slide-in-from-top-2 text-[10px] italic">
                                                    {aiRecommendation}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Grille des mesures */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 pb-10">
                                        {MEASUREMENT_FIELDS.map(f => {
                                            const val = selectedClient.mesures?.[f.key];
                                            const hasValue = val && val !== 0 && val !== '0' && val !== '';
                                            return (
                                                <div key={f.key} className={`p-3 md:p-4 rounded-xl border transition-all ${hasValue ? 'bg-white border-brand-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                                    <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">{f.label}</span>
                                                    <span className={`text-xs md:text-sm font-black ${hasValue ? 'text-brand-900' : 'text-gray-300'}`}>{val || '-'}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'MODELES' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="text-[10px] font-black text-gray-800 uppercase tracking-widest flex items-center gap-2"><Camera size={16} className="text-brand-600"/> Album</h4>
                                        </div>
                                        <button 
                                            onClick={() => fileInputRef.current?.click()} 
                                            className="bg-brand-900 text-white px-3 py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase flex items-center gap-2 shadow-lg"
                                        >
                                            <Plus size={14}/> Photo
                                        </button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileSelection} className="hidden" accept="image/*" />
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 pb-10">
                                        {(selectedClient.modelesCousus || []).length > 0 ? (
                                            selectedClient.modelesCousus?.map((m, idx) => (
                                                <div key={idx} className="group relative aspect-[3/4] bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                                                    <img src={m.url} alt={m.description} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 lg:group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 md:p-4">
                                                        <p className="text-[8px] text-white font-bold mb-1">{new Date(m.date).toLocaleDateString()}</p>
                                                        <div className="flex gap-1 md:gap-2">
                                                            <button onClick={() => window.open(m.url, '_blank')} className="p-1.5 md:p-2 bg-white/20 rounded-lg text-white"><ImageIcon size={12}/></button>
                                                            <button onClick={() => handleOpenEditDescription(idx)} className="p-1.5 md:p-2 bg-brand-500/50 rounded-lg text-white"><Edit2 size={12}/></button>
                                                            <button onClick={() => deleteModele(idx)} className="p-1.5 md:p-2 bg-red-500/50 rounded-lg text-white"><Trash2 size={12}/></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-full py-10 md:py-20 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed rounded-3xl">
                                                <Camera size={32} className="opacity-10 mb-4"/>
                                                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">Aucun modèle</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'STYLE' && (
                                <div className="space-y-6 animate-in fade-in duration-300 pb-10">
                                    <div className="bg-amber-50 p-4 md:p-6 rounded-2xl border-l-4 md:border-l-8 border-amber-400 shadow-sm">
                                        <h4 className="text-[10px] font-black text-amber-800 uppercase mb-4 flex items-center gap-2 tracking-widest"><BookOpen size={16}/> Carnet de Style</h4>
                                        <div className="bg-white p-4 md:p-6 rounded-xl border border-amber-100 min-h-[150px]">
                                            {selectedClient.stylePreferences ? (
                                                <p className="text-xs md:text-sm text-amber-900 leading-relaxed font-medium whitespace-pre-wrap">{selectedClient.stylePreferences}</p>
                                            ) : (
                                                <p className="text-xs text-amber-200 text-center font-black uppercase py-10">Vide</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'HISTO' && (
                                <div className="space-y-4 animate-in fade-in duration-300 pb-10">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><History size={16}/> Archives</h4>
                                    {(selectedClient.mesuresHistorique || []).length > 0 ? (
                                        selectedClient.mesuresHistorique?.map((h, idx) => (
                                            <div key={idx} className="bg-white border rounded-2xl p-3 md:p-4 shadow-sm">
                                                <span className="text-[10px] font-black text-brand-900 uppercase">Le {new Date(h.date).toLocaleDateString()}</span>
                                                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-1 mt-2">
                                                    {Object.entries(h.valeurs).slice(0, 10).map(([k, v]) => (
                                                        <div key={k} className="text-center">
                                                            <p className="text-[6px] font-black text-gray-300 uppercase truncate">{k}</p>
                                                            <p className="text-[8px] font-bold text-gray-600">{v as string || '-'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-10 text-center text-gray-300">
                                            <p className="text-[10px] font-black uppercase tracking-widest">Aucun historique</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100 shadow-inner"><User size={32} className="opacity-20"/></div>
                        <p className="font-black text-[10px] uppercase tracking-[0.2em] text-center">Sélectionnez un client</p>
                    </div>
                )}
            </div>

            {/* MODALS */}
            {isAddingModeleModal && (
                <div className="fixed inset-0 bg-brand-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 max-h-[90vh] flex flex-col border border-brand-100">
                        <div className="bg-white p-6 border-b flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3">
                                <FileText className="text-brand-600" /> 
                                {editingModeleIdx !== null ? 'Détails' : 'Nouveau Modèle'}
                            </h3>
                            <button onClick={() => { setIsAddingModeleModal(false); setPendingModeleFile(null); setEditingModeleIdx(null); }} className="p-1 hover:bg-gray-100 rounded-full"><X size={28}/></button>
                        </div>
                        <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="w-full aspect-[3/4] bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 shadow-inner flex items-center justify-center">
                                {pendingModelePreview ? (
                                    <img src={pendingModelePreview} className="w-full h-full object-cover" alt="Aperçu" />
                                ) : (
                                    <Loader className="animate-spin text-brand-600" size={32}/>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</label>
                                <textarea 
                                    rows={3} 
                                    value={pendingDescription}
                                    onChange={e => setPendingDescription(e.target.value)}
                                    className="w-full p-4 border-2 border-gray-100 rounded-2xl font-bold bg-gray-50 focus:border-brand-600 outline-none transition-all resize-none shadow-sm text-sm"
                                    placeholder="Libellé du modèle..."
                                />
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3 shrink-0">
                            <button onClick={() => { setIsAddingModeleModal(false); setPendingModeleFile(null); setEditingModeleIdx(null); }} className="px-6 py-3 text-gray-400 font-black uppercase text-xs tracking-widest">Annuler</button>
                            <button onClick={editingModeleIdx !== null ? handleUpdateDescription : handleSaveNewModele} disabled={isUploading || (!pendingModeleFile && editingModeleIdx === null)} className="px-10 py-3 bg-brand-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2">
                                {isUploading ? <Loader className="animate-spin" size={14}/> : <Save size={14}/>} {isUploading ? '...' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-0 md:p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white md:rounded-[2rem] shadow-2xl w-full max-w-5xl h-full md:max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in duration-300 border border-gray-200">
                        <div className="bg-brand-900 text-white p-6 flex justify-between items-center shrink-0 shadow-lg">
                            <h3 className="font-black uppercase text-lg md:text-xl tracking-tight flex items-center gap-3"><Ruler size={24}/> {isEditing ? 'Édition' : 'Nouveau'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-2 rounded-full"><X size={32}/></button>
                        </div>
                        
                        <div className="p-4 md:p-8 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
                            <section>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 border-b pb-2">Contact & Informations</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase">Nom</label><input type="text" value={clientFormData.nom} onChange={e => setClientFormData({...clientFormData, nom: e.target.value.toUpperCase()})} className="w-full p-3 md:p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50 focus:border-brand-600 outline-none uppercase shadow-sm text-sm" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase">Téléphone</label><input type="text" value={clientFormData.telephone} onChange={e => setClientFormData({...clientFormData, telephone: e.target.value})} className="w-full p-3 md:p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50 shadow-sm text-sm" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase text-pink-600 flex items-center gap-1"><Cake size={10}/> Date d'Anniversaire</label><input type="date" value={clientFormData.dateAnniversaire} onChange={e => setClientFormData({...clientFormData, dateAnniversaire: e.target.value})} className="w-full p-3 md:p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50 focus:border-brand-600 outline-none shadow-sm text-sm text-pink-700" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase">Email</label><input type="email" value={clientFormData.email} onChange={e => setClientFormData({...clientFormData, email: e.target.value})} className="w-full p-3 md:p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50 shadow-sm text-sm" /></div>
                                </div>
                            </section>

                            <section>
                                <div className="flex justify-between items-end mb-6 border-b pb-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Mesures (CM)</h4>
                                    <button onClick={() => {
                                        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                                        if (!SR) { alert("Dictée vocale non supportée."); return; }
                                        const rec = new SR(); rec.lang = 'fr-FR';
                                        rec.onstart = () => setIsListening(true);
                                        rec.onresult = async (e: any) => {
                                            const t = e.results[0][0].transcript;
                                            setIsListening(false);
                                            const newM = await parseMeasurementsFromText(t);
                                            setClientFormData(prev => ({ ...prev, mesures: { ...(prev.mesures||{}), ...newM } }));
                                        };
                                        rec.onerror = () => setIsListening(false);
                                        rec.start();
                                    }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-[8px] font-black uppercase text-white transition-all ${isListening ? 'bg-red-600 animate-pulse' : 'bg-brand-600'}`}><Mic size={14}/> Dictée</button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-3">
                                    {MEASUREMENT_FIELDS.map(f => (
                                        <div key={f.key} className="space-y-1">
                                            <label className="text-[8px] font-black text-gray-400 uppercase">{f.label}</label>
                                            <input type="text" value={clientFormData.mesures?.[f.key] || ''} onChange={e => setClientFormData({...clientFormData, mesures: { ...(clientFormData.mesures||{}), [f.key]: e.target.value }})} className="w-full p-3 border-2 border-brand-50 bg-brand-50/30 rounded-xl text-center font-black text-brand-900 text-xs" />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="pb-10">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 border-b pb-2">Style</h4>
                                <div className="space-y-4">
                                    <textarea rows={4} value={clientFormData.stylePreferences} onChange={e => setClientFormData({...clientFormData, stylePreferences: e.target.value})} className="w-full p-4 border-2 border-brand-50 rounded-2xl bg-brand-50/30 outline-none focus:border-brand-500 shadow-sm text-xs" placeholder="Préférences, carnet de style..."></textarea>
                                </div>
                            </section>
                        </div>

                        <div className="p-4 md:p-6 bg-gray-50 border-t flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-400 font-black uppercase text-xs">Annuler</button>
                            <button onClick={handleSave} className="px-8 md:px-12 py-3 md:py-4 bg-brand-900 text-white rounded-xl md:rounded-[1.5rem] font-black uppercase text-xs shadow-2xl">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsView;
