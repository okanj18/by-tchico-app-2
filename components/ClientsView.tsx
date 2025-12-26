
import React, { useState, useMemo } from 'react';
import { Client, Commande } from '../types';
import { User, Ruler, Plus, X, Save, Edit2, Share2, Copy, Check, Search, Mic, Share, Trash2, Mail, Cake, MessageCircle, ClipboardList, Send } from 'lucide-react';
import { parseMeasurementsFromText } from '../services/geminiService';
import { COMPANY_CONFIG } from '../config';

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
    const [copySuccess, setCopySuccess] = useState(false);

    const [clientFormData, setClientFormData] = useState<Partial<Client>>({
        nom: '', telephone: '', email: '', dateAnniversaire: '', notes: '', mesures: {}
    });

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

    const maskPhone = (phone: string) => {
        if (!phone) return "";
        let clean = phone.replace(/\s/g, "");
        if (clean.startsWith("+221")) clean = clean.substring(4);
        if (clean.startsWith("00221")) clean = clean.substring(5);
        if (clean.length < 2) return phone;
        // Format masqué strict : 77 ••• •• ••
        return `${clean.substring(0, 2)} ••• •• ••`;
    };

    const formatMeasurementsText = (client: Client) => {
        const maskedPhone = maskPhone(client.telephone);
        let text = `*MESURES : ${client.nom}*\n`;
        text += `📞 Client : ${maskedPhone}\n\n`;
        
        let hasMesures = false;
        MEASUREMENT_FIELDS.forEach(f => {
            const val = client.mesures?.[f.key];
            if (val && val !== 0 && val !== '0' && val !== '') {
                text += `• ${f.label}: ${val} cm\n`;
                hasMesures = true;
            }
        });
        
        if (!hasMesures) text += "_Aucune mesure enregistrée._\n";
        if (client.notes) text += `\n*Notes:* ${client.notes}`;
        
        text += `\n\n_Généré par ${COMPANY_CONFIG.name} Manager_`;
        return text;
    };

    const handleCopyToClipboard = async () => {
        if (!selectedClient) return;
        const text = formatMeasurementsText(selectedClient);
        try {
            await navigator.clipboard.writeText(text);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            alert("Erreur lors de la copie.");
        }
    };

    const handleShareWhatsApp = () => {
        if (!selectedClient) return;
        const text = formatMeasurementsText(selectedClient);
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

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
        if (window.confirm("Supprimer définitivement ce client ?")) {
            onDeleteClient(id); 
            setSelectedClient(null);
        }
    };

    const startVoice = () => {
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
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
            {/* Colonne Gauche : Liste */}
            <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Répertoire Clients</h3>
                    <button onClick={openAddModal} className="bg-brand-900 text-white p-2 rounded-full hover:bg-black shadow-md transition-all active:scale-95"><Plus size={18}/></button>
                </div>
                <div className="p-4 border-b shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-brand-500 outline-none font-bold" />
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {filteredClients.map(c => (
                        <div key={c.id} onClick={() => setSelectedClient(c)} className={`p-4 border-b cursor-pointer transition-colors hover:bg-brand-50 ${selectedClient?.id === c.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''}`}>
                            <p className="font-bold text-gray-800 uppercase text-xs">{c.nom}</p>
                            <p className="text-[10px] text-gray-400 mt-1 font-mono">{c.telephone}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Colonne Droite : Fiche et EXPORTATION */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-y-auto custom-scrollbar">
                {selectedClient ? (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        {/* Header Client */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                            <div className="flex-1">
                                <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter leading-none">{selectedClient.nom}</h2>
                                <div className="flex flex-wrap gap-3 mt-4 text-[11px] font-black text-gray-500 uppercase tracking-widest">
                                    <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-gray-200"><Search size={14} className="text-brand-600"/> {selectedClient.telephone}</span>
                                    {selectedClient.email && <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-gray-200"><Mail size={14} className="text-brand-600"/> {selectedClient.email}</span>}
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 w-full md:w-auto shrink-0">
                                <button onClick={() => openEditModal(selectedClient)} className="p-3 bg-white text-gray-400 border border-gray-200 rounded-2xl hover:text-brand-600 transition-all shadow-sm"><Edit2 size={20}/></button>
                                <button onClick={() => handleDelete(selectedClient.id)} className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl hover:bg-red-100 transition-all shadow-sm"><Trash2 size={20}/></button>
                            </div>
                        </div>

                        {/* SECTION EXPORTATION - TRÈS VISIBLE */}
                        <div className="bg-brand-900 text-white p-6 rounded-[2rem] shadow-xl border-4 border-brand-100 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg"><Send size={20}/></div>
                                <div>
                                    <h3 className="font-black uppercase text-sm tracking-widest">Partager la fiche mesures</h3>
                                    <p className="text-[10px] text-brand-200 font-bold uppercase">Envoi sécurisé (téléphone masqué)</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button onClick={handleShareWhatsApp} className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg">
                                    <MessageCircle size={20}/> WhatsApp
                                </button>
                                <button onClick={handleCopyToClipboard} className={`py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 transition-all active:scale-95 border-2 shadow-lg ${copySuccess ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-brand-900 border-white hover:bg-brand-50'}`}>
                                    {copySuccess ? <Check size={20}/> : <Copy size={20}/>} {copySuccess ? 'Copié !' : 'Copier pour l\'Atelier'}
                                </button>
                            </div>
                        </div>

                        {/* Grille des mesures */}
                        <div>
                            <h3 className="text-xs font-black text-brand-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3"><Ruler size={20}/> Détails Anthropométriques (CM)</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {MEASUREMENT_FIELDS.map(f => {
                                    const val = selectedClient.mesures?.[f.key];
                                    const hasValue = val && val !== 0 && val !== '0' && val !== '';
                                    return (
                                        <div key={f.key} className={`p-4 rounded-2xl border transition-all ${hasValue ? 'bg-brand-50/50 border-brand-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                            <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">{f.label}</span>
                                            <span className={`text-sm font-black ${hasValue ? 'text-brand-900' : 'text-gray-300'}`}>{val || '-'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {selectedClient.notes && (
                            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                                <h4 className="text-[10px] font-black text-amber-800 uppercase mb-2 flex items-center gap-2 tracking-widest"><ClipboardList size={16}/> Notes</h4>
                                <p className="text-sm text-amber-900 leading-relaxed font-medium">{selectedClient.notes}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4"><User size={40} className="opacity-20"/></div>
                        <p className="font-black text-xs uppercase tracking-widest text-center">Sélectionnez un client pour voir sa fiche</p>
                    </div>
                )}
            </div>

            {/* Modal de création/édition */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in duration-300 border border-gray-200">
                        <div className="bg-brand-900 text-white p-6 flex justify-between items-center shrink-0">
                            <h3 className="font-black uppercase text-xl tracking-tight flex items-center gap-3"><Ruler size={28}/> {isEditing ? 'Mise à jour' : 'Nouveau Client'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-2 rounded-full"><X size={32}/></button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto flex-1 space-y-10 custom-scrollbar">
                            <section>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6 border-b pb-2">Informations de Contact</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase">Nom Complet</label><input type="text" value={clientFormData.nom} onChange={e => setClientFormData({...clientFormData, nom: e.target.value.toUpperCase()})} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50 focus:border-brand-600 outline-none uppercase" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase">Téléphone</label><input type="text" value={clientFormData.telephone} onChange={e => setClientFormData({...clientFormData, telephone: e.target.value})} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase">Email</label><input type="email" value={clientFormData.email} onChange={e => setClientFormData({...clientFormData, email: e.target.value})} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50" /></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase">Anniversaire</label><input type="date" value={clientFormData.dateAnniversaire} onChange={e => setClientFormData({...clientFormData, dateAnniversaire: e.target.value})} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black bg-gray-50" /></div>
                                </div>
                            </section>

                            <section>
                                <div className="flex justify-between items-end mb-6 border-b pb-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Mesures (Format libre autorisé)</h4>
                                    <button onClick={startVoice} className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase text-white transition-all ${isListening ? 'bg-red-600 animate-pulse' : 'bg-brand-600'}`}><Mic size={16}/> {isListening ? 'ÉCOUTE...' : 'DICTER MESURES'}</button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
                                    {MEASUREMENT_FIELDS.map(f => (
                                        <div key={f.key} className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-500 uppercase">{f.label}</label>
                                            <input type="text" value={clientFormData.mesures?.[f.key] || ''} onChange={e => setClientFormData({...clientFormData, mesures: { ...(clientFormData.mesures||{}), [f.key]: e.target.value }})} className="w-full p-4 border-2 border-brand-50 bg-brand-50/30 rounded-2xl text-center font-black text-brand-900 focus:border-brand-600 focus:bg-white outline-none" />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] block mb-2">Notes & Observations</label>
                                <textarea rows={3} value={clientFormData.notes} onChange={e => setClientFormData({...clientFormData, notes: e.target.value})} className="w-full p-5 border-2 border-gray-100 rounded-[2rem] bg-gray-50 outline-none" placeholder="Ex: Préfère une coupe cintrée..."></textarea>
                            </section>
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-gray-400 font-black uppercase text-xs">Annuler</button>
                            <button onClick={handleSave} className="px-12 py-4 bg-brand-900 text-white rounded-[1.5rem] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all">ENREGISTRER</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsView;
