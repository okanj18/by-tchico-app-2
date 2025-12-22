
import React, { useState, useMemo } from 'react';
import { Client, Commande } from '../types';
import { User, Ruler, Plus, X, Save, Edit2, Share2, Copy, Check, Search, Mic, Share, Trash2, Mail, Cake } from 'lucide-react';
import { parseMeasurementsFromText } from '../services/geminiService';

interface ClientsViewProps {
    clients: Client[];
    commandes: Commande[];
    onAddClient: (client: Client) => void;
    onUpdateClient: (client: Client) => void;
    onDeleteClient: (id: string) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ clients, commandes, onAddClient, onUpdateClient, onDeleteClient }) => {
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const [clientFormData, setClientFormData] = useState<Partial<Client>>({
        nom: '', telephone: '', email: '', dateAnniversaire: '', notes: '', mesures: {}
    });

    // Liste complète et restaurée de tous les champs de mesure
    const MEASUREMENT_FIELDS = [
        { key: 'tourCou', label: 'TOUR DE COU' },
        { key: 'epaule', label: 'ÉPAULE' },
        { key: 'poitrine', label: 'POITRINE' },
        { key: 'longueurManche', label: 'LONG. MANCHE' },
        { key: 'tourBras', label: 'TOUR DE BRAS' },
        { key: 'tourPoignet', label: 'TOUR POIGNET' },
        { key: 'carrureDos', label: 'CARRURE DOS' },
        { key: 'carrureDevant', label: 'CARRURE DEVANT' },
        { key: 'taille', label: 'TAILLE' },
        { key: 'blouse', label: 'BLOUSE' },
        { key: 'ceinture', label: 'CEINTURE' },
        { key: 'tourFesse', label: 'TOUR DE FESSE' },
        { key: 'tourCuisse', label: 'TOUR DE CUISSE' },
        { key: 'genou', label: 'GENOU' },
        { key: 'mollet', label: 'MOLLET' },
        { key: 'bas', label: 'BAS' },
        { key: 'entreJambe', label: 'ENTRE JAMBE' },
        { key: 'longueurPantalon', label: 'LONG. PANTALON' },
        { key: 'longueurBoubou', label: 'LONG. BOUBOU' },
        { key: 'longueurChemise', label: 'LONG. CHEMISE' }
    ];

    const filteredClients = useMemo(() => {
        return clients.filter(c => c.nom.toLowerCase().includes(searchTerm.toLowerCase()) || c.telephone.includes(searchTerm)).sort((a, b) => a.nom.localeCompare(b.nom));
    }, [clients, searchTerm]);

    const openAddModal = () => { 
        setClientFormData({ nom: '', telephone: '', email: '', dateAnniversaire: '', notes: '', mesures: {} }); 
        setIsEditing(false); 
        setIsModalOpen(true); 
    };

    const openEditModal = (client: Client) => { 
        setClientFormData({ ...client }); 
        setIsEditing(true); 
        setIsModalOpen(true); 
    };

    const handleSave = () => {
        if (!clientFormData.nom || !clientFormData.telephone) { 
            alert("Le nom et le téléphone sont obligatoires."); 
            return; 
        }
        
        const finalClient = { ...clientFormData } as Client;
        
        if (isEditing) onUpdateClient(finalClient);
        else onAddClient({ ...finalClient, id: `C${Date.now()}` });
        
        setSelectedClient(finalClient);
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Supprimer définitivement ce client et toutes ses mesures ?")) {
            onDeleteClient(id); 
            setSelectedClient(null);
        }
    };

    const startVoice = () => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            alert("La dictée vocale n'est pas supportée par votre navigateur.");
            return;
        }
        const rec = new SR(); 
        rec.lang = 'fr-FR';
        rec.onstart = () => setIsListening(true);
        rec.onresult = async (e: any) => {
            const t = e.results[0][0].transcript;
            setIsListening(false);
            // On envoie le texte à l'IA pour extraire les mesures
            const newM = await parseMeasurementsFromText(t);
            setClientFormData(prev => ({ 
                ...prev, 
                mesures: { ...(prev.mesures||{}), ...newM } 
            }));
        };
        rec.onerror = () => setIsListening(false);
        rec.start();
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
            {/* Liste Latérale */}
            <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-gray-700">Répertoire Clients</h3>
                    <button onClick={openAddModal} className="bg-brand-600 text-white p-2 rounded-full hover:bg-brand-700 shadow-md transition-all">
                        <Plus size={20}/>
                    </button>
                </div>
                <div className="p-4 border-b shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <input type="text" placeholder="Rechercher client..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {filteredClients.map(c => (
                        <div key={c.id} onClick={() => setSelectedClient(c)} className={`p-4 border-b cursor-pointer transition-colors hover:bg-brand-50 ${selectedClient?.id === c.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''}`}>
                            <p className="font-bold text-gray-800 uppercase text-xs">{c.nom}</p>
                            <p className="text-[10px] text-gray-500 mt-1">📞 {c.telephone}</p>
                        </div>
                    ))}
                    {filteredClients.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm italic">Aucun client trouvé.</div>
                    )}
                </div>
            </div>

            {/* Fiche Détails */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-y-auto custom-scrollbar">
                {selectedClient ? (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div>
                                <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">{selectedClient.nom}</h2>
                                <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2 font-medium">
                                    <span className="flex items-center gap-1.5"><Search size={14} className="text-brand-600"/> {selectedClient.telephone}</span>
                                    {selectedClient.email && (
                                        <span className="flex items-center gap-1.5"><Mail size={14} className="text-brand-600"/> {selectedClient.email}</span>
                                    )}
                                    {selectedClient.dateAnniversaire && (
                                        <span className="flex items-center gap-1.5"><Cake size={14} className="text-brand-600"/> Anniv: {new Date(selectedClient.dateAnniversaire).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button onClick={() => openEditModal(selectedClient)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-brand-50 text-brand-700 border border-brand-200 px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-brand-100 transition-all shadow-sm">
                                    <Edit2 size={16}/> Modifier
                                </button>
                                <button onClick={() => handleDelete(selectedClient.id)} className="p-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-all" title="Supprimer">
                                    <Trash2 size={20}/>
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-6">
                            <h3 className="text-xs font-black text-brand-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Ruler size={18}/> Mesures Enregistrées (CM)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {MEASUREMENT_FIELDS.map(f => (
                                    <div key={f.key} className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-brand-200 transition-all group">
                                        <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-brand-600">{f.label}</span>
                                        <span className="text-sm font-black text-gray-800 break-all">
                                            {selectedClient.mesures?.[f.key] || '-'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {selectedClient.notes && (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                <h4 className="text-[10px] font-black text-amber-800 uppercase mb-1">Notes Particulières</h4>
                                <p className="text-sm text-amber-900 leading-relaxed">{selectedClient.notes}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <User size={40} className="opacity-20"/>
                        </div>
                        <p className="font-bold text-sm">Veuillez sélectionner un client dans le répertoire</p>
                    </div>
                )}
            </div>

            {/* Modal de Saisie (Tous les champs restaurés et multi-valeurs) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in duration-300 border border-gray-200">
                        <div className="bg-brand-900 text-white p-6 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-black uppercase text-lg tracking-tight flex items-center gap-2">
                                    <Ruler size={24}/> {isEditing ? 'Mise à jour Fiche' : 'Nouvelle Fiche Client'}
                                </h3>
                                <p className="text-[10px] text-brand-300 font-bold uppercase mt-1">Saisie complète des mesures anthropométriques</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-all">
                                <X size={28}/>
                            </button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto flex-1 space-y-10 custom-scrollbar">
                            {/* Infos Générales */}
                            <section>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 border-b pb-2">Informations de Contact</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Nom Complet</label>
                                        <input type="text" value={clientFormData.nom} onChange={e => setClientFormData({...clientFormData, nom: e.target.value.toUpperCase()})} className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50 focus:border-brand-600 outline-none text-sm transition-all uppercase" placeholder="EX: AMADOU DIOP" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Téléphone</label>
                                        <input type="text" value={clientFormData.telephone} onChange={e => setClientFormData({...clientFormData, telephone: e.target.value})} className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50 focus:border-brand-600 outline-none text-sm transition-all" placeholder="+221 ..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Email</label>
                                        <input type="email" value={clientFormData.email} onChange={e => setClientFormData({...clientFormData, email: e.target.value})} className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50 focus:border-brand-600 outline-none text-sm transition-all" placeholder="exemple@mail.com" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Date Anniversaire</label>
                                        <input type="date" value={clientFormData.dateAnniversaire} onChange={e => setClientFormData({...clientFormData, dateAnniversaire: e.target.value})} className="w-full p-3 border-2 border-gray-100 rounded-xl font-bold bg-gray-50 focus:border-brand-600 outline-none text-sm transition-all" />
                                    </div>
                                </div>
                            </section>

                            {/* Section Mesures */}
                            <section>
                                <div className="flex justify-between items-end mb-6 border-b pb-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Tableau des Mesures (Format libre autorisé)</h4>
                                    <button onClick={startVoice} className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase text-white transition-all shadow-lg ${isListening ? 'bg-red-600 animate-pulse' : 'bg-brand-600 hover:bg-brand-700'}`}>
                                        <Mic size={14}/> {isListening ? 'ÉCOUTE EN COURS...' : 'DICTER LES MESURES'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
                                    {MEASUREMENT_FIELDS.map(f => (
                                        <div key={f.key} className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1">{f.label}</label>
                                            <input 
                                                type="text" 
                                                value={clientFormData.mesures?.[f.key] || ''} 
                                                onChange={e => setClientFormData({
                                                    ...clientFormData, 
                                                    mesures: { ...(clientFormData.mesures||{}), [f.key]: e.target.value }
                                                })} 
                                                className="w-full p-3 border-2 border-brand-50 bg-brand-50/30 rounded-xl text-center text-sm font-black text-brand-900 focus:border-brand-600 focus:bg-white transition-all outline-none"
                                                placeholder="ex: 42/44"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest block mb-2">Notes & Observations</label>
                                <textarea rows={3} value={clientFormData.notes} onChange={e => setClientFormData({...clientFormData, notes: e.target.value})} className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-gray-50 focus:border-brand-600 outline-none text-sm font-medium" placeholder="Ex: Préfère les coupes cintrées, allergique à la laine..."></textarea>
                            </section>
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex flex-col md:flex-row justify-end gap-3 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 bg-white border-2 border-gray-200 rounded-xl font-black text-xs uppercase text-gray-500 hover:bg-gray-100 transition-all">
                                Annuler
                            </button>
                            <button onClick={handleSave} className="px-12 py-3 bg-brand-900 text-white rounded-xl font-black uppercase text-xs tracking-[0.1em] shadow-xl hover:bg-black transition-all transform active:scale-95">
                                ENREGISTRER LA FICHE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsView;
