
import React, { useState, useMemo } from 'react';
import { Client, Commande, StatutCommande } from '../types';
import { User, Phone, Ruler, History, MessageSquare, Plus, X, Save, Edit2, Share2, Copy, Check, Filter, Calendar, ShoppingBag, Search, ArrowUp, ArrowDown, Clock, Cake, Mic, Loader, Sparkles } from 'lucide-react';
import { draftClientMessage, parseMeasurementsFromText } from '../services/geminiService';

interface ClientsViewProps {
    clients: Client[];
    commandes: Commande[];
    onAddClient: (client: Client) => void;
    onUpdateClient: (client: Client) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ clients, commandes, onAddClient, onUpdateClient }) => {
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [draftedMessage, setDraftedMessage] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<'NAME' | 'LAST_ORDER_DESC' | 'LAST_ORDER_ASC' | 'ORDER_COUNT'>('NAME');
    
    // Advanced Filters State
    const [showFilters, setShowFilters] = useState(false);
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterMinOrderCount, setFilterMinOrderCount] = useState<number | ''>('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [clientFormData, setClientFormData] = useState<Partial<Client>>({
        nom: '',
        telephone: '',
        notes: '',
        dateAnniversaire: '',
        mesures: {}
    });
    
    // Special State for Combined Inputs (string "val1/val2")
    const [boubouString, setBoubouString] = useState('');
    const [genouString, setGenouString] = useState('');

    // Voice Input State
    const [isListening, setIsListening] = useState(false);
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);

    // Export Modal State
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportContent, setExportContent] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    // Quick Orders Modal State
    const [quickOrdersClient, setQuickOrdersClient] = useState<Client | null>(null);

    const MEASUREMENT_FIELDS = [
        { key: 'tourCou', label: 'TOUR DE COU' },
        { key: 'epaule', label: 'ÉPAULE' },
        { key: 'longueurManche', label: 'LONG. MANCHE' },
        { key: 'tourBras', label: 'TOUR DE BRAS' },
        { key: 'tourPoignet', label: 'TOUR DE POIGNET' },
        { key: 'longueurBoubou1', label: 'L. BOUBOU' }, // Fusionné visuellement
        // longueurBoubou2 est géré manuellement avec le 1 via boubouString
        { key: 'longueurChemise', label: 'L. CHEMISE' },
        { key: 'carrureDos', label: 'CARRURE DOS' },
        { key: 'carrureDevant', label: 'CARRURE DEVANT' },
        { key: 'taille', label: 'TAILLE' },
        { key: 'blouse', label: 'BLOUSE' },
        { key: 'ceinture', label: 'CEINTURE' },
        { key: 'tourFesse', label: 'TOUR DE FESSE' },
        { key: 'tourCuisse', label: 'TOUR DE CUISSE' },
        { key: 'entreJambe', label: 'ENTRE JAMBE' },
        { key: 'longueurPantalon', label: 'L. PANTALON' },
        { key: 'genou1', label: 'GENOU' }, // Fusionné visuellement
        // genou2 est géré manuellement avec le 1 via genouString
        { key: 'bas', label: 'BAS' },
    ];

    // --- Data Processing for Filtering/Sorting ---
    const processedClients = useMemo(() => {
        return clients.map(client => {
            const clientOrders = commandes.filter(c => c.clientId === client.id);
            const lastOrderTimestamp = clientOrders.length > 0 
                ? Math.max(...clientOrders.map(o => new Date(o.dateCommande).getTime())) 
                : 0;
            
            return {
                ...client,
                orderCount: clientOrders.length,
                lastOrderDate: lastOrderTimestamp
            };
        });
    }, [clients, commandes]);

    const filteredAndSortedClients = useMemo(() => {
        return processedClients
            .filter(c => {
                // 1. Search by Name/Phone
                const matchesSearch = c.nom.toLowerCase().includes(searchTerm.toLowerCase()) || c.telephone.includes(searchTerm);
                
                // 2. Filter by Date Range (Last order)
                let matchesDate = true;
                
                // Start Date Filter
                if (filterDateStart) {
                    if (c.lastOrderDate === 0) {
                        matchesDate = false;
                    } else {
                        matchesDate = matchesDate && c.lastOrderDate >= new Date(filterDateStart).getTime();
                    }
                }

                // End Date Filter
                if (filterDateEnd) {
                    if (c.lastOrderDate === 0) {
                        matchesDate = false;
                    } else {
                        // Set time to end of day for the end date
                        const endDate = new Date(filterDateEnd);
                        endDate.setHours(23, 59, 59, 999);
                        matchesDate = matchesDate && c.lastOrderDate <= endDate.getTime();
                    }
                }

                // 3. Filter by Order Count (Min X orders)
                let matchesCount = true;
                if (filterMinOrderCount !== '' && typeof filterMinOrderCount === 'number') {
                    matchesCount = c.orderCount >= filterMinOrderCount;
                }

                return matchesSearch && matchesDate && matchesCount;
            })
            .sort((a, b) => {
                if (sortOption === 'NAME') return a.nom.localeCompare(b.nom);
                if (sortOption === 'LAST_ORDER_DESC') return b.lastOrderDate - a.lastOrderDate;
                if (sortOption === 'LAST_ORDER_ASC') {
                    // Handle cases with no orders (put them at the end or beginning depending on preference)
                    if (a.lastOrderDate === 0) return 1;
                    if (b.lastOrderDate === 0) return -1;
                    return a.lastOrderDate - b.lastOrderDate;
                }
                if (sortOption === 'ORDER_COUNT') return b.orderCount - a.orderCount;
                return 0;
            });
    }, [processedClients, searchTerm, sortOption, filterDateStart, filterDateEnd, filterMinOrderCount]);


    const handleGenerateMessage = async (client: Client) => {
        setIsGenerating(true);
        // Find last active order
        const lastOrder = commandes.find(c => c.clientId === client.id && c.statut !== StatutCommande.LIVRE) 
                          || commandes.find(c => c.clientId === client.id);
        
        if (lastOrder) {
            const msg = await draftClientMessage(client.nom, lastOrder.description, lastOrder.statut);
            setDraftedMessage(msg);
        } else {
            setDraftedMessage("Aucune commande récente trouvée pour générer un message de suivi.");
        }
        setIsGenerating(false);
    };

    const handleShareMeasurements = (client: Client) => {
        let text = `📋 *MESURES CLIENT: ${client.nom.toUpperCase()}*\n\n`;
        
        // Filter and map measurements
        let hasMesures = false;
        MEASUREMENT_FIELDS.forEach(field => {
            if (field.key === 'longueurBoubou1') {
                const val1 = client.mesures.longueurBoubou1;
                const val2 = client.mesures.longueurBoubou2;
                if ((val1 && val1 > 0) || (val2 && val2 > 0)) {
                    text += `- ${field.label}: ${val1 || 0} / ${val2 || 0} cm\n`;
                    hasMesures = true;
                }
            } else if (field.key === 'genou1') {
                const val1 = client.mesures.genou1;
                const val2 = client.mesures.genou2;
                if ((val1 && val1 > 0) || (val2 && val2 > 0)) {
                    text += `- ${field.label}: ${val1 || 0} / ${val2 || 0} cm\n`;
                    hasMesures = true;
                }
            } else {
                const val = client.mesures[field.key as keyof typeof client.mesures];
                if (val && val > 0) {
                    text += `- ${field.label}: ${val} cm\n`;
                    hasMesures = true;
                }
            }
        });

        if (!hasMesures) text += "(Aucune mesure enregistrée)\n";

        setExportContent(text);
        setExportModalOpen(true);
        setIsCopied(false);
    };

    const confirmCopy = () => {
        navigator.clipboard.writeText(exportContent).then(() => {
            setIsCopied(true);
            setTimeout(() => {
                setExportModalOpen(false);
                setIsCopied(false);
            }, 1500);
        });
    };

    const openAddModal = () => {
        setClientFormData({ nom: '', telephone: '', notes: '', dateAnniversaire: '', mesures: {} });
        setBoubouString(''); // Init empty
        setGenouString(''); // Init empty
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const openEditModal = (client: Client) => {
        setClientFormData({
            nom: client.nom,
            telephone: client.telephone,
            notes: client.notes,
            dateAnniversaire: client.dateAnniversaire || '',
            mesures: { ...client.mesures } // Copie pour ne pas modifier directement
        });
        
        // Init combined string for Boubou
        const v1 = client.mesures.longueurBoubou1;
        const v2 = client.mesures.longueurBoubou2;
        if (v2 && v2 > 0) {
            setBoubouString(`${v1 || 0}/${v2}`);
        } else {
            setBoubouString(v1 ? v1.toString() : '');
        }

        // Init combined string for Genou
        const g1 = client.mesures.genou1;
        const g2 = client.mesures.genou2;
        if (g2 && g2 > 0) {
            setGenouString(`${g1 || 0}/${g2}`);
        } else {
            setGenouString(g1 ? g1.toString() : '');
        }

        setIsEditing(true);
        setIsModalOpen(true);
    };

    // Handler for the combined input Boubou
    const handleBoubouStringChange = (val: string) => {
        setBoubouString(val);
        // Logic to split "140/145" into 140 and 145
        // Replace comma with dot to support decimal inputs like "49,5"
        const normalized = val.replace(',', '.');
        const parts = normalized.split('/');
        const v1 = parseFloat(parts[0].trim());
        const v2 = parts.length > 1 ? parseFloat(parts[1].trim()) : 0;

        setClientFormData(prev => ({
            ...prev,
            mesures: {
                ...prev.mesures,
                longueurBoubou1: isNaN(v1) ? 0 : v1,
                longueurBoubou2: isNaN(v2) ? 0 : v2
            }
        }));
    };

    // Handler for the combined input Genou
    const handleGenouStringChange = (val: string) => {
        setGenouString(val);
        // Logic to split "40/38" into 40 and 38
        const normalized = val.replace(',', '.');
        const parts = normalized.split('/');
        const v1 = parseFloat(parts[0].trim());
        const v2 = parts.length > 1 ? parseFloat(parts[1].trim()) : 0;

        setClientFormData(prev => ({
            ...prev,
            mesures: {
                ...prev.mesures,
                genou1: isNaN(v1) ? 0 : v1,
                genou2: isNaN(v2) ? 0 : v2
            }
        }));
    };

    const toggleVoiceRecording = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Votre navigateur ne supporte pas la reconnaissance vocale. Utilisez Chrome ou Edge.");
            return;
        }

        if (isListening) {
            return; 
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript;
            console.log('Texte entendu:', transcript);
            setIsListening(false);
            setIsProcessingAudio(true);

            // Call Gemini AI Service
            const newMeasures = await parseMeasurementsFromText(transcript);
            
            // Merge with existing measures
            setClientFormData(prev => {
                const updatedMesures = { ...prev.mesures, ...newMeasures };
                
                // Update specific strings for UI sync (Boubou/Genou) if they changed
                if (newMeasures.longueurBoubou1 || newMeasures.longueurBoubou2) {
                    const b1 = newMeasures.longueurBoubou1 || prev.mesures?.longueurBoubou1 || 0;
                    const b2 = newMeasures.longueurBoubou2 || prev.mesures?.longueurBoubou2 || 0;
                    setBoubouString(b2 > 0 ? `${b1}/${b2}` : `${b1}`);
                }
                if (newMeasures.genou1 || newMeasures.genou2) {
                    const g1 = newMeasures.genou1 || prev.mesures?.genou1 || 0;
                    const g2 = newMeasures.genou2 || prev.mesures?.genou2 || 0;
                    setGenouString(g2 > 0 ? `${g1}/${g2}` : `${g1}`);
                }

                return { ...prev, mesures: updatedMesures };
            });

            setIsProcessingAudio(false);
        };

        recognition.onerror = (event: any) => {
            setIsListening(false);
            setIsProcessingAudio(false);
            
            if (event.error === 'no-speech') {
                console.warn("Aucune parole détectée");
                alert("Aucune parole détectée. Veuillez réessayer en parlant distinctement.");
                return;
            }

            console.error('Erreur reconnaissance vocale:', event.error);

            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                alert("🚫 Accès au microphone refusé.\n\nVeuillez autoriser l'accès au microphone dans la barre d'adresse du navigateur (icône cadenas ou caméra) pour utiliser la saisie vocale.");
            } else if (event.error === 'network') {
                 alert("🌐 Erreur réseau.\n\nLa reconnaissance vocale nécessite une connexion internet active. Veuillez vérifier votre connexion.");
            } else {
                alert("Erreur lors de la reconnaissance vocale (" + event.error + "). Veuillez réessayer.");
            }
        };

        recognition.onend = () => {
            if (!isProcessingAudio) setIsListening(false);
        };

        try {
            recognition.start();
        } catch (e) {
            console.error(e);
            alert("Impossible de démarrer le microphone. Vérifiez vos permissions.");
        }
    };

    const handleSaveClient = () => {
        if (!clientFormData.nom || !clientFormData.telephone) {
            alert("Veuillez remplir le nom et le téléphone.");
            return;
        }

        if (isEditing && selectedClient) {
            // Update existing client
            const updatedClient: Client = {
                ...selectedClient,
                nom: clientFormData.nom || '',
                telephone: clientFormData.telephone || '',
                notes: clientFormData.notes || '',
                dateAnniversaire: clientFormData.dateAnniversaire || undefined,
                mesures: clientFormData.mesures || {}
            };
            onUpdateClient(updatedClient);
            setSelectedClient(updatedClient);
        } else {
            // Create new client
            const newClient: Client = {
                id: `C${Date.now()}`,
                nom: clientFormData.nom || '',
                telephone: clientFormData.telephone || '',
                email: clientFormData.email || '',
                notes: clientFormData.notes || '',
                dateAnniversaire: clientFormData.dateAnniversaire || undefined,
                mesures: clientFormData.mesures || {}
            };
            onAddClient(newClient);
            setSelectedClient(newClient);
        }

        setIsModalOpen(false);
        setClientFormData({ nom: '', telephone: '', notes: '', dateAnniversaire: '', mesures: {} });
    };

    // Quick range helpers
    const applyDateFilter = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        setFilterDateEnd(end.toISOString().split('T')[0]);
        setFilterDateStart(start.toISOString().split('T')[0]);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
            {/* List */}
            <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div>
                         <h3 className="font-bold text-gray-700">Répertoire Clients</h3>
                    </div>
                    <button 
                        onClick={openAddModal}
                        className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-full transition-colors shadow-sm"
                        title="Nouveau Client"
                    >
                        <Plus size={20} />
                    </button>
                </div>
                 <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                placeholder="Rechercher..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                            <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                        </div>
                        <div className="relative group w-36 shrink-0">
                            <select 
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value as any)}
                                className="h-full w-full px-2 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer hover:bg-gray-50 text-gray-600"
                                title="Trier par"
                            >
                                <option value="NAME">Nom (A-Z)</option>
                                <option value="LAST_ORDER_DESC">Date (Récent)</option>
                                <option value="LAST_ORDER_ASC">Date (Ancien)</option>
                                <option value="ORDER_COUNT">Nb Cmds</option>
                            </select>
                        </div>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-md border transition-colors ${showFilters ? 'bg-brand-100 border-brand-300 text-brand-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                            title="Filtres avancés"
                        >
                            <Filter size={18} />
                        </button>
                    </div>

                    {/* Advanced Filters Panel */}
                    {showFilters && (
                        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-inner space-y-3 animate-in slide-in-from-top-2">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Période Dernière Commande</label>
                                <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
                                    <button onClick={() => applyDateFilter(30)} className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-brand-100 text-gray-700 rounded whitespace-nowrap">30 jours</button>
                                    <button onClick={() => applyDateFilter(90)} className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-brand-100 text-gray-700 rounded whitespace-nowrap">3 mois</button>
                                    <button onClick={() => applyDateFilter(180)} className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-brand-100 text-gray-700 rounded whitespace-nowrap">6 mois</button>
                                    <button onClick={() => applyDateFilter(365)} className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-brand-100 text-gray-700 rounded whitespace-nowrap">1 an</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[9px] text-gray-400 uppercase mb-0.5">Du</label>
                                        <input 
                                            type="date" 
                                            value={filterDateStart}
                                            onChange={(e) => setFilterDateStart(e.target.value)}
                                            className="w-full p-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Au</label>
                                        <input 
                                            type="date" 
                                            value={filterDateEnd}
                                            onChange={(e) => setFilterDateEnd(e.target.value)}
                                            className="w-full p-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-500"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre de Commandes Minimum</label>
                                <div className="relative">
                                    <ShoppingBag size={14} className="absolute left-2 top-2 text-gray-400"/>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={filterMinOrderCount}
                                        onChange={(e) => setFilterMinOrderCount(e.target.value ? parseInt(e.target.value) : '')}
                                        placeholder="Ex: 5"
                                        className="w-full p-1.5 pl-7 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-500"
                                    />
                                </div>
                            </div>

                            {(filterDateStart || filterDateEnd || filterMinOrderCount !== '') && (
                                <div className="text-right pt-1 border-t border-gray-100">
                                    <button 
                                        onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); setFilterMinOrderCount(''); }}
                                        className="text-xs text-red-500 hover:underline flex items-center justify-end gap-1 w-full"
                                    >
                                        <X size={12} /> Réinitialiser les filtres
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="overflow-y-auto flex-1">
                    {filteredAndSortedClients.length > 0 ? filteredAndSortedClients.map(client => (
                        <div 
                            key={client.id}
                            onClick={() => setSelectedClient(client)}
                            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-brand-50 transition-colors ${selectedClient?.id === client.id ? 'bg-brand-50 border-l-4 border-brand-500' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold shrink-0">
                                    {client.nom.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold text-gray-800 truncate">{client.nom}</h4>
                                        <div className="flex gap-1">
                                            {client.orderCount > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${client.orderCount >= 5 ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-gray-100 text-gray-600'}`}>
                                                    <ShoppingBag size={10} /> {client.orderCount}
                                                </span>
                                            )}
                                            {client.lastOrderDate > 0 && (
                                                <span className="text-[10px] text-gray-500 flex items-center gap-1 bg-gray-50 px-1 rounded" title="Dernière commande">
                                                    <Clock size={10} /> {new Date(client.lastOrderDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: '2-digit'})}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                                        <Phone size={10} /> {client.telephone}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickOrdersClient(client);
                                    }}
                                    className="p-2 text-gray-400 hover:text-brand-600 hover:bg-white rounded-full transition-colors z-10"
                                    title="Voir Commandes"
                                >
                                    <ShoppingBag size={18} />
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-gray-400">
                            Aucun client trouvé.
                        </div>
                    )}
                </div>
            </div>

            {/* Details */}
            <div className="w-full lg:w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-6">
                {selectedClient ? (
                    <div className="space-y-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{selectedClient.nom}</h2>
                                <p className="text-gray-500 flex items-center gap-2 mt-1">
                                    <Phone size={16} /> {selectedClient.telephone}
                                </p>
                                {selectedClient.dateAnniversaire && (
                                    <p className="text-pink-500 flex items-center gap-2 mt-1 text-sm font-medium">
                                        <Cake size={16} /> {new Date(selectedClient.dateAnniversaire).toLocaleDateString(undefined, {day: 'numeric', month: 'long', year: 'numeric'})}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => handleShareMeasurements(selectedClient)}
                                    className="flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-indigo-200"
                                    title="Voir et copier pour envoyer au tailleur"
                                >
                                    <Share2 size={16} />
                                    Exporter
                                </button>
                                <button 
                                    onClick={() => openEditModal(selectedClient)}
                                    className="flex items-center gap-2 bg-gray-100 text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Edit2 size={16} />
                                    Modifier
                                </button>
                            </div>
                        </div>

                        {/* Measurements Grid */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Ruler className="text-brand-600" /> Prise de Mesures (cm)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {MEASUREMENT_FIELDS.map((field) => {
                                    if (field.key === 'longueurBoubou1') {
                                        return (
                                            <div key={field.key} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                                <span className="block text-xs text-gray-500 font-bold uppercase mb-1 tracking-wide">{field.label}</span>
                                                <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                                                    <span className="text-lg font-bold text-gray-800 tracking-tight">
                                                        {selectedClient.mesures.longueurBoubou1 || 0}<span className="mx-1 text-gray-400 font-light">/</span>{selectedClient.mesures.longueurBoubou2 || 0}
                                                    </span>
                                                    <span className="text-xs text-gray-400">cm</span>
                                                </div>
                                            </div>
                                        );
                                    } else if (field.key === 'genou1') {
                                        return (
                                            <div key={field.key} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                                <span className="block text-xs text-gray-500 font-bold uppercase mb-1 tracking-wide">{field.label}</span>
                                                <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                                                    <span className="text-lg font-bold text-gray-800 tracking-tight">
                                                        {selectedClient.mesures.genou1 || 0}<span className="mx-1 text-gray-400 font-light">/</span>{selectedClient.mesures.genou2 || 0}
                                                    </span>
                                                    <span className="text-xs text-gray-400">cm</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={field.key} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                            <span className="block text-xs text-gray-500 font-bold uppercase mb-1 tracking-wide">{field.label}</span>
                                            <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                                                <span className="text-lg font-bold text-gray-800">
                                                    {selectedClient.mesures[field.key as keyof typeof selectedClient.mesures] || 0}
                                                </span>
                                                <span className="text-xs text-gray-400">cm</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {selectedClient.notes && (
                                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-md text-sm text-yellow-800">
                                    <strong>Note:</strong> {selectedClient.notes}
                                </div>
                            )}
                        </div>

                        {/* AI Assistant */}
                        <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
                            <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                                <MessageSquare size={16} /> Assistant Communication IA
                            </h3>
                            <button 
                                onClick={() => handleGenerateMessage(selectedClient)}
                                disabled={isGenerating}
                                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                            >
                                {isGenerating ? 'Rédaction en cours...' : 'Générer un message WhatsApp'}
                            </button>
                            {draftedMessage && (
                                <div className="mt-3 p-3 bg-white rounded border border-indigo-200 text-sm text-gray-700 italic">
                                    "{draftedMessage}"
                                </div>
                            )}
                        </div>

                        {/* Order History */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <History className="text-brand-600" /> Historique Commandes
                            </h3>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="py-2 px-3">Date</th>
                                        <th className="py-2 px-3">Description</th>
                                        <th className="py-2 px-3">Statut</th>
                                        <th className="py-2 px-3 text-right">Montant</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {commandes.filter(c => c.clientId === selectedClient.id).map(cmd => (
                                        <tr key={cmd.id} className="border-b border-gray-100">
                                            <td className="py-3 px-3">{new Date(cmd.dateCommande).toLocaleDateString()}</td>
                                            <td className="py-3 px-3">{cmd.description}</td>
                                            <td className="py-3 px-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${cmd.statut === StatutCommande.LIVRE ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {cmd.statut}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-right font-medium">{cmd.prixTotal.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {commandes.filter(c => c.clientId === selectedClient.id).length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-4 text-center text-gray-400 italic">Aucune commande.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <User size={64} className="mb-4 opacity-20" />
                        <p>Sélectionnez un client pour voir les détails</p>
                    </div>
                )}
            </div>

            {/* Quick Orders Modal */}
            {quickOrdersClient && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col animate-in fade-in zoom-in duration-200 max-h-[80vh]">
                        <div className="bg-gray-800 text-white p-4 flex justify-between items-center rounded-t-xl shrink-0">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <History size={20} />
                                Historique: {quickOrdersClient.nom}
                            </h2>
                            <button onClick={() => setQuickOrdersClient(null)} className="hover:bg-gray-700 p-1 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-0 overflow-y-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0">
                                    <tr>
                                        <th className="py-3 px-4">Date</th>
                                        <th className="py-3 px-4">Description</th>
                                        <th className="py-3 px-4">Statut</th>
                                        <th className="py-3 px-4 text-right">Reste à payer</th>
                                        <th className="py-3 px-4 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {commandes.filter(c => c.clientId === quickOrdersClient.id).map(cmd => (
                                        <tr key={cmd.id} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 text-gray-600">{new Date(cmd.dateCommande).toLocaleDateString()}</td>
                                            <td className="py-3 px-4 font-medium">{cmd.description}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    cmd.statut === StatutCommande.LIVRE ? 'bg-gray-100 text-gray-600' : 
                                                    cmd.statut === StatutCommande.PRET ? 'bg-green-100 text-green-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {cmd.statut}
                                                </span>
                                            </td>
                                            <td className={`py-3 px-4 text-right font-medium ${cmd.reste > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {cmd.reste > 0 ? cmd.reste.toLocaleString() : 'Payé'}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-gray-800">
                                                {cmd.prixTotal.toLocaleString()} F
                                            </td>
                                        </tr>
                                    ))}
                                    {commandes.filter(c => c.clientId === quickOrdersClient.id).length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-400 italic">Aucune commande enregistrée pour ce client.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-gray-100 text-right rounded-b-xl">
                            <button 
                                onClick={() => setQuickOrdersClient(null)} 
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Modal (Add / Edit) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="bg-brand-600 text-white p-4 flex justify-between items-center shadow-md">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <User size={24} />
                                {isEditing ? `Modifier Fiche Client` : `Nouvelle Fiche Client`}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-brand-700 p-1 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom Complet</label>
                                    <input 
                                        type="text" 
                                        value={clientFormData.nom}
                                        onChange={(e) => setClientFormData({...clientFormData, nom: e.target.value})}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                        placeholder="Ex: Fatou Diop"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                    <input 
                                        type="text" 
                                        value={clientFormData.telephone}
                                        onChange={(e) => setClientFormData({...clientFormData, telephone: e.target.value})}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                        placeholder="Ex: 77 123 45 67"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date d'Anniversaire</label>
                                    <input 
                                        type="date" 
                                        value={clientFormData.dateAnniversaire}
                                        onChange={(e) => setClientFormData({...clientFormData, dateAnniversaire: e.target.value})}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                    />
                                </div>
                                 <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                    <textarea 
                                        value={clientFormData.notes}
                                        onChange={(e) => setClientFormData({...clientFormData, notes: e.target.value})}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                        placeholder="Préférences, allergies, etc."
                                        rows={2}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <Ruler className="text-brand-600" /> Prise de Mesures (cm)
                                    </h3>
                                    
                                    {/* Voice Input Button */}
                                    <button
                                        onClick={toggleVoiceRecording}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all shadow-sm ${
                                            isListening 
                                            ? 'bg-red-500 text-white animate-pulse' 
                                            : isProcessingAudio 
                                                ? 'bg-brand-100 text-brand-700 cursor-wait'
                                                : 'bg-brand-600 text-white hover:bg-brand-700'
                                        }`}
                                        disabled={isProcessingAudio}
                                    >
                                        {isListening ? (
                                            <>
                                                <Mic size={16} /> Écoute en cours...
                                            </>
                                        ) : isProcessingAudio ? (
                                            <>
                                                <Loader className="animate-spin" size={16} /> Traitement IA...
                                            </>
                                        ) : (
                                            <>
                                                <Mic size={16} /> Saisie Vocale (IA)
                                            </>
                                        )}
                                    </button>
                                </div>

                                {isProcessingAudio && (
                                    <div className="mb-4 bg-brand-50 border border-brand-200 text-brand-800 p-3 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                        <Sparkles size={18} className="text-brand-600" />
                                        <span>L'IA analyse votre voix et remplit le formulaire...</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6">
                                    {MEASUREMENT_FIELDS.map((field) => {
                                        // Cas Spécial: L. BOUBOU (Double Input Combined via string state)
                                        if (field.key === 'longueurBoubou1') {
                                            return (
                                                <div key={field.key}>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{field.label}</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="text" 
                                                            value={boubouString}
                                                            onChange={(e) => handleBoubouStringChange(e.target.value)}
                                                            className="w-full p-2 pr-8 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent font-medium"
                                                            placeholder="140/145"
                                                        />
                                                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">cm</span>
                                                    </div>
                                                </div>
                                            );
                                        } else if (field.key === 'genou1') {
                                            return (
                                                <div key={field.key}>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{field.label}</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="text" 
                                                            value={genouString}
                                                            onChange={(e) => handleGenouStringChange(e.target.value)}
                                                            className="w-full p-2 pr-8 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent font-medium"
                                                            placeholder="40/38"
                                                        />
                                                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">cm</span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={field.key}>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{field.label}</label>
                                                <div className="relative">
                                                    <input 
                                                        type="number"
                                                        step="0.1" 
                                                        value={clientFormData.mesures?.[field.key as keyof typeof clientFormData.mesures] || ''}
                                                        onChange={(e) => setClientFormData({
                                                            ...clientFormData, 
                                                            mesures: { ...clientFormData.mesures, [field.key]: parseFloat(e.target.value) || 0 }
                                                        })}
                                                        className="w-full p-2 pr-8 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent font-medium"
                                                        placeholder="0"
                                                    />
                                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">cm</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={handleSaveClient}
                                className="px-5 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700 font-medium flex items-center gap-2"
                            >
                                <Save size={18} />
                                {isEditing ? 'Enregistrer les Modifications' : 'Enregistrer la Fiche'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Preview Modal */}
            {exportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="bg-gray-800 text-white p-4 flex justify-between items-center rounded-t-xl">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Share2 size={20} />
                                Aperçu Exportation
                            </h2>
                            <button onClick={() => setExportModalOpen(false)} className="hover:bg-gray-700 p-1 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-4">
                            <p className="text-sm text-gray-500 mb-2">Voici le message qui sera copié pour le tailleur :</p>
                            <div className="bg-gray-100 p-4 rounded-lg border border-gray-200 font-mono text-sm whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
                                {exportContent}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                            <button 
                                onClick={() => setExportModalOpen(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                Fermer
                            </button>
                            <button 
                                onClick={confirmCopy}
                                className={`px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${isCopied ? 'bg-green-600' : 'bg-brand-600 hover:bg-brand-700'}`}
                            >
                                {isCopied ? (
                                    <>
                                        <Check size={16} />
                                        Copié !
                                    </>
                                ) : (
                                    <>
                                        <Copy size={16} />
                                        Copier
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsView;
