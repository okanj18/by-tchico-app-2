
import React, { useState, useMemo } from 'react';
import { Client, Commande } from '../types';
import { User, Ruler, Plus, X, Save, Edit2, Share2, Copy, Check, Search, Mic, Share } from 'lucide-react';
import { parseMeasurementsFromText } from '../services/geminiService';

interface ClientsViewProps {
    clients: Client[];
    commandes: Commande[];
    onAddClient: (client: Client) => void;
    onUpdateClient: (client: Client) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ clients, commandes, onAddClient, onUpdateClient }) => {
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<'NAME' | 'LAST_ORDER_DESC'>('NAME');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [clientFormData, setClientFormData] = useState<Partial<Client>>({
        nom: '', telephone: '', notes: '', dateAnniversaire: '', mesures: {}
    });
    
    // Champs de texte pour les mesures multiples (format "v1/v2/v3")
    const [multiStates, setMultiStates] = useState({
        boubou: '',
        manche: '',
        poignet: '',
        poitrine: '',
        genou: ''
    });

    const [isListening, setIsListening] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportContent, setExportContent] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    // DÉFINITION DE L'ORDRE ET DES CHAMPS
    const MEASUREMENT_FIELDS = [
        { key: 'tourCou', label: 'TOUR DE COU', type: 'single' },
        { key: 'epaule', label: 'ÉPAULE', type: 'single' },
        { key: 'poitrine', label: 'TOUR POITRINE', type: 'triple' }, 
        { key: 'longueurManche', label: 'LONG. MANCHE', type: 'triple' },
        { key: 'tourBras', label: 'TOUR DE BRAS', type: 'single' },
        { key: 'tourPoignet', label: 'TOUR DE POIGNET', type: 'triple' },
        { key: 'longueurBoubou1', label: 'L. BOUBOU', type: 'triple' },
        { key: 'longueurChemise', label: 'L. CHEMISE', type: 'single' },
        { key: 'carrureDos', label: 'CARRURE DOS', type: 'single' },
        { key: 'carrureDevant', label: 'CARRURE DEVANT', type: 'single' },
        { key: 'taille', label: 'TAILLE', type: 'single' },
        { key: 'blouse', label: 'BLOUSE', type: 'single' },
        { key: 'ceinture', label: 'CEINTURE', type: 'single' },
        { key: 'tourFesse', label: 'TOUR DE FESSE', type: 'single' },
        { key: 'tourCuisse', label: 'TOUR DE CUISSE', type: 'single' },
        { key: 'entreJambe', label: 'ENTRE JAMBE', type: 'single' },
        { key: 'longueurPantalon', label: 'L. PANTALON', type: 'single' },
        { key: 'genou1', label: 'GENOU', type: 'double' },
        { key: 'bas', label: 'BAS', type: 'single' },
        { key: 'mollet', label: 'MOLLET', type: 'single' },
    ];

    const filteredClients = useMemo(() => {
        return clients
            .filter(c => c.nom.toLowerCase().includes(searchTerm.toLowerCase()) || c.telephone.includes(searchTerm))
            .sort((a, b) => sortOption === 'NAME' ? a.nom.localeCompare(b.nom) : 0);
    }, [clients, searchTerm, sortOption]);

    // Formatage pour affichage (exclut les zéros)
    const formatDisplay = (m: any, fieldKey: string, type: string) => {
        if (type === 'single') return m[fieldKey] || '0';
        
        let values: any[] = [];
        if (fieldKey === 'longueurBoubou1') values = [m.longueurBoubou1, m.longueurBoubou2, m.longueurBoubou3];
        else if (fieldKey === 'longueurManche') values = [m.longueurManche1 || m.longueurManche, m.longueurManche2, m.longueurManche3];
        else if (fieldKey === 'tourPoignet') values = [m.tourPoignet1 || m.tourPoignet, m.tourPoignet2, m.tourPoignet3];
        else if (fieldKey === 'poitrine') values = [m.poitrine1 || m.poitrine, m.poitrine2, m.poitrine3];
        else if (fieldKey === 'genou1') values = [m.genou1, m.genou2];

        const filtered = values.filter(v => v !== undefined && v !== null && v !== 0 && v !== '');
        return filtered.length > 0 ? filtered.join(' / ') : '0';
    };

    const handleShare = (client: Client) => {
        let text = `📋 *MESURES CLIENT : ${client.nom.toUpperCase()}*\n\n`;
        MEASUREMENT_FIELDS.forEach(f => {
            const val = formatDisplay(client.mesures, f.key, f.type);
            if (val && val !== '0') text += `- ${f.label} : ${val} cm\n`;
        });
        setExportContent(text);
        setExportModalOpen(true);
    };

    const openAddModal = () => {
        setClientFormData({ nom: '', telephone: '', notes: '', dateAnniversaire: '', mesures: {} });
        setMultiStates({ boubou: '', manche: '', poignet: '', poitrine: '', genou: '' });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const openEditModal = (client: Client) => {
        setClientFormData({ ...client });
        const m = client.mesures;
        const toS = (...vals: any[]) => vals.filter(v => v && v !== 0).join('/');
        
        setMultiStates({
            boubou: toS(m.longueurBoubou1, m.longueurBoubou2, m.longueurBoubou3),
            manche: toS(m.longueurManche1 || m.longueurManche, m.longueurManche2, m.longueurManche3),
            poignet: toS(m.tourPoignet1 || m.tourPoignet, m.tourPoignet2, m.tourPoignet3),
            poitrine: toS(m.poitrine1 || m.poitrine, m.poitrine2, m.poitrine3),
            genou: toS(m.genou1, m.genou2)
        });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const parseMulti = (val: string) => val.split('/').map(v => parseFloat(v.trim()) || 0);

    const handleSave = () => {
        if (!clientFormData.nom || !clientFormData.telephone) { alert("Nom et téléphone requis."); return; }

        const m = { ...clientFormData.mesures };
        
        const b = parseMulti(multiStates.boubou);
        m.longueurBoubou1 = b[0]; m.longueurBoubou2 = b[1]; m.longueurBoubou3 = b[2];
        
        const ma = parseMulti(multiStates.manche);
        m.longueurManche1 = ma[0]; m.longueurManche = ma[0]; m.longueurManche2 = ma[1]; m.longueurManche3 = ma[2];
        
        const p = parseMulti(multiStates.poitrine);
        m.poitrine1 = p[0]; m.poitrine = p[0]; m.poitrine2 = p[1]; m.poitrine3 = p[2];

        const po = parseMulti(multiStates.poignet);
        m.tourPoignet1 = po[0]; m.tourPoignet = po[0]; m.tourPoignet2 = po[1]; m.tourPoignet3 = po[2];

        const g = parseMulti(multiStates.genou);
        m.genou1 = g[0]; m.genou2 = g[1];

        const finalClient = { ...clientFormData, mesures: m } as Client;

        if (isEditing) onUpdateClient(finalClient);
        else onAddClient({ ...finalClient, id: `C${Date.now()}` });
        
        setSelectedClient(finalClient);
        setIsModalOpen(false);
    };

    const startVoice = () => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const rec = new SR(); rec.lang = 'fr-FR';
        rec.onstart = () => setIsListening(true);
        rec.onresult = async (e: any) => {
            const t = e.results[0][0].transcript;
            setIsListening(false);
            const newM = await parseMeasurementsFromText(t);
            setClientFormData(prev => ({ ...prev, mesures: { ...prev.mesures, ...newM } }));
        };
        rec.onerror = () => setIsListening(false);
        rec.start();
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
            {/* LISTE */}
            <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Répertoire Clients</h3>
                    <button onClick={openAddModal} className="bg-brand-600 text-white p-2 rounded-full"><Plus size={20}/></button>
                </div>
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
                    </div>
                </div>
                <div className="overflow-y-auto flex-1">
                    {filteredClients.map(c => (
                        <div key={c.id} onClick={() => setSelectedClient(c)} className={`p-4 border-b cursor-pointer hover:bg-brand-50 ${selectedClient?.id === c.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''}`}>
                            <p className="font-bold text-gray-800">{c.nom}</p>
                            <p className="text-xs text-gray-500">{c.telephone}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* DETAILS */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-y-auto">
                {selectedClient ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div><h2 className="text-2xl font-bold">{selectedClient.nom}</h2><p className="text-gray-500">{selectedClient.telephone}</p></div>
                            <div className="flex gap-2">
                                <button onClick={() => handleShare(selectedClient)} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-bold border border-indigo-200"><Share2 size={16}/> Exporter</button>
                                <button onClick={() => openEditModal(selectedClient)} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-bold"><Edit2 size={16}/> Modifier</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {MEASUREMENT_FIELDS.map(f => (
                                <div key={f.key} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase">{f.label}</span>
                                    <span className="text-sm font-bold text-gray-800">{formatDisplay(selectedClient.mesures, f.key, f.type)} cm</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : <div className="h-full flex flex-col items-center justify-center text-gray-400"><User size={64} className="opacity-20 mb-2"/><p>Sélectionnez un client</p></div>}
            </div>

            {/* MODAL FORMULAIRE */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="bg-brand-600 text-white p-4 flex justify-between items-center">
                            <h3 className="font-bold">{isEditing ? 'Modifier' : 'Nouveau'} Client</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={24}/></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold mb-1">NOM COMPLET</label><input type="text" value={clientFormData.nom} onChange={e => setClientFormData({...clientFormData, nom: e.target.value})} className="w-full p-2 border rounded"/></div>
                                <div><label className="block text-xs font-bold mb-1">TÉLÉPHONE</label><input type="text" value={clientFormData.telephone} onChange={e => setClientFormData({...clientFormData, telephone: e.target.value})} className="w-full p-2 border rounded"/></div>
                            </div>
                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-brand-600 flex items-center gap-2"><Ruler size={18}/> MESURES (CM)</h4>
                                    <button onClick={startVoice} className={`px-4 py-1.5 rounded-full text-xs font-bold text-white ${isListening ? 'bg-red-500 animate-pulse' : 'bg-brand-600'}`}><Mic size={14} className="inline mr-1"/> {isListening ? 'Écoute...' : 'Dictée Vocale'}</button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {MEASUREMENT_FIELDS.map(f => {
                                        if (f.type === 'triple' || f.type === 'double') {
                                            const stateKey = f.key === 'longueurBoubou1' ? 'boubou' : f.key === 'longueurManche' ? 'manche' : f.key === 'tourPoignet' ? 'poignet' : f.key === 'poitrine' ? 'poitrine' : 'genou';
                                            return (
                                                <div key={f.key}>
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{f.label}</label>
                                                    <input type="text" placeholder={f.type === 'triple' ? "140/145/150" : "40/38"} value={(multiStates as any)[stateKey]} onChange={e => setMultiStates({...multiStates, [stateKey]: e.target.value})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded text-sm font-bold"/>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={f.key}>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{f.label}</label>
                                                <input type="number" step="0.1" value={clientFormData.mesures?.[f.key] || ''} onChange={e => setClientFormData({...clientFormData, mesures: {...clientFormData.mesures, [f.key]: parseFloat(e.target.value) || 0}})} className="w-full p-2 border rounded text-sm font-bold"/>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-white border rounded-lg">Annuler</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EXPORT */}
            {exportModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md animate-in zoom-in duration-200">
                        <div className="p-4 border-b font-bold flex justify-between">Exporter Mesures <button onClick={() => setExportModalOpen(false)}><X size={20}/></button></div>
                        <div className="p-4"><pre className="bg-gray-100 p-4 rounded-lg text-xs whitespace-pre-wrap font-mono">{exportContent}</pre></div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <button onClick={() => { navigator.clipboard.writeText(exportContent); setIsCopied(true); setTimeout(()=>setIsCopied(false), 2000); }} className={`px-4 py-2 rounded-lg text-sm font-bold text-white ${isCopied ? 'bg-green-600' : 'bg-brand-600'}`}>{isCopied ? 'Copié !' : 'Copier Texte'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsView;
