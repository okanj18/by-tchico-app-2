
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

    const MEASUREMENT_FIELDS = [
        { key: 'tourCou', label: 'TOUR DE COU' }, { key: 'epaule', label: 'ÉPAULE' }, { key: 'poitrine', label: 'POITRINE' }, 
        { key: 'longueurManche', label: 'LONG. MANCHE' }, { key: 'tourBras', label: 'TOUR DE BRAS' }, { key: 'tourPoignet', label: 'POIGNET' },
        { key: 'longueurBoubou1', label: 'L. BOUBOU' }, { key: 'longueurChemise', label: 'L. CHEMISE' }, { key: 'taille', label: 'TAILLE' },
        { key: 'ceinture', label: 'CEINTURE' }, { key: 'tourFesse', label: 'TOUR DE FESSE' }, { key: 'longueurPantalon', label: 'L. PANTALON' }
    ];

    const filteredClients = useMemo(() => {
        return clients.filter(c => c.nom.toLowerCase().includes(searchTerm.toLowerCase()) || c.telephone.includes(searchTerm)).sort((a, b) => a.nom.localeCompare(b.nom));
    }, [clients, searchTerm]);

    const openAddModal = () => { setClientFormData({ nom: '', telephone: '', email: '', dateAnniversaire: '', notes: '', mesures: {} }); setIsEditing(false); setIsModalOpen(true); };
    const openEditModal = (client: Client) => { setClientFormData({ ...client }); setIsEditing(true); setIsModalOpen(true); };

    const handleSave = () => {
        if (!clientFormData.nom || !clientFormData.telephone) { alert("Nom et téléphone requis."); return; }
        if (isEditing) onUpdateClient(clientFormData as Client);
        else onAddClient({ ...clientFormData, id: `C${Date.now()}` } as Client);
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        onDeleteClient(id); setSelectedClient(null);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
            <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">Répertoire Clients</h3><button onClick={openAddModal} className="bg-brand-600 text-white p-2 rounded-full"><Plus size={20}/></button></div>
                <div className="p-4 border-b"><div className="relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={16}/><input type="text" placeholder="Chercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" /></div></div>
                <div className="overflow-y-auto flex-1">{filteredClients.map(c => (<div key={c.id} onClick={() => setSelectedClient(c)} className={`p-4 border-b cursor-pointer hover:bg-brand-50 ${selectedClient?.id === c.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''}`}><p className="font-bold text-gray-800 uppercase text-xs">{c.nom}</p><p className="text-xs text-gray-500">{c.telephone}</p></div>))}</div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-y-auto">
                {selectedClient ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">{selectedClient.nom}</h2>
                                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
                                    <span>📞 {selectedClient.telephone}</span>
                                    {selectedClient.email && (<span>| 📧 {selectedClient.email}</span>)}
                                    {selectedClient.dateAnniversaire && (<span>| 🎂 {new Date(selectedClient.dateAnniversaire).toLocaleDateString()}</span>)}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => openEditModal(selectedClient)} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase"><Edit2 size={16}/> Modifier</button>
                                <button onClick={() => handleDelete(selectedClient.id)} className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase"><Trash2 size={16}/> Supprimer</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {MEASUREMENT_FIELDS.map(f => (
                                <div key={f.key} className="bg-gray-50 p-3 rounded-lg border border-gray-100"><span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">{f.label}</span><span className="text-sm font-bold text-brand-900">{selectedClient.mesures?.[f.key] || '0'} cm</span></div>
                            ))}
                        </div>
                    </div>
                ) : <div className="h-full flex flex-col items-center justify-center text-gray-400"><User size={64} className="opacity-20 mb-2"/><p>Sélectionnez un client</p></div>}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-brand-600 text-white p-5 flex justify-between items-center shrink-0"><h3 className="font-bold uppercase text-sm">{isEditing ? 'Modifier' : 'Nouveau'} Client</h3><button onClick={() => setIsModalOpen(false)}><X size={24}/></button></div>
                        <div className="p-8 overflow-y-auto flex-1 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nom Complet</label><input type="text" value={clientFormData.nom} onChange={e => setClientFormData({...clientFormData, nom: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold bg-gray-50 text-sm"/></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Téléphone</label><input type="text" value={clientFormData.telephone} onChange={e => setClientFormData({...clientFormData, telephone: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold bg-gray-50 text-sm"/></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Email</label><input type="email" value={clientFormData.email} onChange={e => setClientFormData({...clientFormData, email: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold bg-gray-50 text-sm"/></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Anniversaire</label><input type="date" value={clientFormData.dateAnniversaire} onChange={e => setClientFormData({...clientFormData, dateAnniversaire: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold bg-gray-50 text-sm"/></div>
                            </div>
                            <div className="border-t pt-8">
                                <h4 className="font-black text-brand-600 mb-6 uppercase text-xs">Mesures (CM)</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                    {MEASUREMENT_FIELDS.map(f => (
                                        <div key={f.key}><label className="block text-[9px] font-black text-gray-400 uppercase mb-1">{f.label}</label><input type="number" value={clientFormData.mesures?.[f.key] || ''} onChange={e => setClientFormData({...clientFormData, mesures: {...(clientFormData.mesures||{}), [f.key]: parseFloat(e.target.value) || 0}})} className="w-full p-2 border rounded-lg text-xs font-bold bg-gray-50 text-center"/></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3"><button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold text-xs uppercase">Annuler</button><button onClick={handleSave} className="px-10 py-3 bg-brand-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Enregistrer</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsView;
