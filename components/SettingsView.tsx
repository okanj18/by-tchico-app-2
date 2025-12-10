
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, RefreshCw, AlertTriangle, FileText, Database, CheckCircle, Save, Trash2, Wifi, WifiOff, Lock, Code } from 'lucide-react';
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

interface SettingsViewProps {
    fullData: any; // L'objet contenant tout l'état de l'application
    onRestore: (data: any) => void;
    onImport: (type: 'CLIENTS' | 'ARTICLES', data: any[]) => void;
    onFactoryReset?: () => void; // Nouvelle prop
}

const SettingsView: React.FC<SettingsViewProps> = ({ fullData, onRestore, onImport, onFactoryReset }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    const [importType, setImportType] = useState<'CLIENTS' | 'ARTICLES'>('CLIENTS');
    const [statusMessage, setStatusMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    // --- DIAGNOSTIC CONNEXION ---
    const [connectionStatus, setConnectionStatus] = useState<'CHECKING' | 'OK' | 'PERMISSION_DENIED' | 'OFFLINE' | 'ERROR'>('CHECKING');
    const [diagnosticDetails, setDiagnosticDetails] = useState('');

    useEffect(() => {
        checkConnectivity();
    }, []);

    const checkConnectivity = async () => {
        if (!db) {
            setConnectionStatus('OFFLINE');
            return;
        }

        setConnectionStatus('CHECKING');
        try {
            // Test d'écriture simple pour vérifier les règles de sécurité
            const testRef = doc(db, "_diagnostics", "connection_test");
            await setDoc(testRef, { 
                lastCheck: new Date().toISOString(),
                platform: navigator.userAgent
            });
            setConnectionStatus('OK');
        } catch (error: any) {
            console.error("Diagnostic Error:", error);
            if (error.code === 'permission-denied') {
                setConnectionStatus('PERMISSION_DENIED');
            } else if (error.code === 'unavailable' || error.message.includes('offline')) {
                setConnectionStatus('OFFLINE');
            } else {
                setConnectionStatus('ERROR');
                setDiagnosticDetails(error.message);
            }
        }
    };

    // --- BACKUP LOGIC (JSON) ---
    const handleBackup = () => {
        const dataStr = JSON.stringify(fullData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const date = new Date().toISOString().split('T')[0];
        const link = document.createElement('a');
        link.href = url;
        link.download = `by_tchico_backup_${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStatusMessage({type: 'success', text: 'Sauvegarde téléchargée avec succès.'});
    };

    // --- RESTORE LOGIC (JSON) ---
    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                // Le onRestore gère maintenant la confirmation dans App.tsx ou ici
                onRestore(json); 
            } catch (err) {
                console.error(err);
                setStatusMessage({type: 'error', text: 'Erreur lors de la lecture du fichier. Le format est invalide.'});
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    // --- EXPORT CSV LOGIC ---
    const convertToCSV = (objArray: any[]) => {
        if (!objArray || objArray.length === 0) return '';
        const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
        
        // Collect all keys from all objects to ensure we have headers even if some objects miss keys
        let headers = new Set<string>();
        array.forEach((obj: any) => {
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] !== 'object') headers.add(key); // Skip nested objects for simple CSV
            });
        });
        const headerArray = Array.from(headers);
        
        let str = headerArray.join(',') + '\r\n';

        for (let i = 0; i < array.length; i++) {
            let line = '';
            for (let index in headerArray) {
                if (line !== '') line += ',';
                let val = array[i][headerArray[index]];
                // Escape quotes and handle commas
                if (typeof val === 'string') {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                line += val !== undefined ? val : '';
            }
            str += line + '\r\n';
        }
        return str;
    };

    const handleExportCSV = (type: 'CLIENTS' | 'ARTICLES' | 'VENTES') => {
        let data: any[] = [];
        let filename = '';

        if (type === 'CLIENTS') {
            data = fullData.clients.map((c: any) => ({
                Nom: c.nom,
                Telephone: c.telephone,
                Ville: c.ville || '',
                Note: c.notes || ''
            }));
            filename = 'clients_by_tchico.csv';
        } else if (type === 'ARTICLES') {
            data = fullData.articles.map((a: any) => ({
                Nom: a.nom,
                Categorie: a.categorie,
                Type: a.typeArticle,
                PrixAchat: a.prixAchatDefault,
                PrixVente: a.prixVenteDefault,
                StockTotal: Object.values(a.stockParLieu).reduce((acc:any, v:any) => acc + Object.values(v).reduce((acc2:any, q:any)=>acc2+Number(q),0), 0)
            }));
            filename = 'articles_by_tchico.csv';
        } else if (type === 'VENTES') {
            data = fullData.commandes
                .filter((c: any) => c.type === 'PRET_A_PORTER')
                .map((c: any) => ({
                    Date: new Date(c.dateCommande).toLocaleDateString(),
                    Client: c.clientNom,
                    Description: c.description,
                    Montant: c.prixTotal,
                    Statut: c.statut,
                    Reste: c.reste
                }));
            filename = 'ventes_by_tchico.csv';
        }

        const csvStr = convertToCSV(data);
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
    };

    // --- IMPORT CSV LOGIC (Simple) ---
    const handleCSVImportClick = () => {
        csvInputRef.current?.click();
    };

    const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const rows = text.split('\n').filter(row => row.trim() !== '');
            const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
            
            const resultData = [];
            for (let i = 1; i < rows.length; i++) {
                const values = rows[i].split(',').map(v => v.trim().replace(/"/g, ''));
                if (values.length === headers.length) {
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        obj[header] = values[index];
                    });
                    resultData.push(obj);
                }
            }

            const mappedData = resultData.map((row: any) => {
                if (importType === 'CLIENTS') {
                    return {
                        id: `C_IMP_${Date.now()}_${Math.random()}`,
                        nom: row.Nom || row.Name || row.nom || 'Client Inconnu',
                        telephone: row.Telephone || row.Phone || row.telephone || '',
                        mesures: {} 
                    };
                } else { // ARTICLES
                    return {
                        id: `A_IMP_${Date.now()}_${Math.random()}`,
                        nom: row.Nom || row.nom || 'Article Inconnu',
                        categorie: row.Categorie || 'Importé',
                        typeArticle: 'MATIERE_PREMIERE', 
                        prixAchatDefault: parseInt(row.PrixAchat || '0'),
                        prixVenteDefault: parseInt(row.PrixVente || '0'),
                        unite: 'Pièce',
                        stockParLieu: {},
                        variantes: []
                    };
                }
            });

            if (mappedData.length > 0) {
                if (window.confirm(`Vous êtes sur le point d'importer ${mappedData.length} éléments dans ${importType}. Confirmer ?`)) {
                    onImport(importType, mappedData);
                    setStatusMessage({type: 'success', text: `${mappedData.length} éléments importés avec succès.`});
                }
            } else {
                setStatusMessage({type: 'error', text: "Impossible de lire les données. Vérifiez le format CSV (séparateur virgule)."});
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Database className="text-brand-600" /> Paramètres & Données
            </h2>

            {/* --- DIAGNOSTIC PANEL --- */}
            <div className={`rounded-xl shadow-sm border p-4 ${
                connectionStatus === 'OK' ? 'bg-green-50 border-green-200' : 
                connectionStatus === 'PERMISSION_DENIED' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
            }`}>
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                        connectionStatus === 'OK' ? 'bg-green-100 text-green-600' :
                        connectionStatus === 'PERMISSION_DENIED' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'
                    }`}>
                        {connectionStatus === 'OK' ? <Wifi size={24}/> : 
                         connectionStatus === 'PERMISSION_DENIED' ? <Lock size={24}/> : 
                         <WifiOff size={24}/>}
                    </div>
                    <div className="flex-1">
                        <h3 className={`font-bold text-lg ${
                            connectionStatus === 'OK' ? 'text-green-800' :
                            connectionStatus === 'PERMISSION_DENIED' ? 'text-red-800' : 'text-gray-800'
                        }`}>
                            État de la Connexion Cloud
                        </h3>
                        <p className="text-sm mt-1 mb-2">
                            {connectionStatus === 'CHECKING' && "Vérification de la connexion..."}
                            {connectionStatus === 'OK' && "Tout fonctionne parfaitement ! Vos données sont synchronisées en temps réel."}
                            {connectionStatus === 'OFFLINE' && "Mode Hors Ligne. Les variables d'environnement Firebase manquent dans Vercel."}
                            {connectionStatus === 'PERMISSION_DENIED' && "Erreur de Permissions ! La base de données refuse l'accès."}
                            {connectionStatus === 'ERROR' && `Erreur inattendue : ${diagnosticDetails}`}
                        </p>

                        {connectionStatus === 'PERMISSION_DENIED' && (
                            <div className="mt-4 bg-white border border-red-200 rounded-lg p-3">
                                <p className="text-xs text-red-700 font-bold mb-2 flex items-center gap-1"><AlertTriangle size={12}/> ACTION REQUISE SUR LA CONSOLE FIREBASE</p>
                                <p className="text-xs text-gray-600 mb-2">
                                    Allez dans <strong>Firestore Database &gt; Règles</strong>, effacez tout et collez ceci :
                                </p>
                                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs overflow-x-auto relative group">
                                    <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}</pre>
                                </div>
                                <div className="mt-2 text-right">
                                    <button onClick={checkConnectivity} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 font-bold">
                                        Réessayer la connexion
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {statusMessage && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${statusMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {statusMessage.type === 'success' ? <CheckCircle size={20}/> : <AlertTriangle size={20}/>}
                    {statusMessage.text}
                </div>
            )}

            {/* SECTION 1: SYSTEM BACKUP */}
            <div className="bg-white rounded-xl shadow-sm border border-brand-200 overflow-hidden">
                <div className="bg-brand-50 p-4 border-b border-brand-100">
                    <h3 className="font-bold text-brand-900 flex items-center gap-2">
                        <Save size={20} /> Sauvegarde & Restauration Système
                    </h3>
                    <p className="text-xs text-brand-700 mt-1">
                        Vos données sont enregistrées automatiquement dans ce navigateur. Utilisez cette section pour les transférer ailleurs.
                    </p>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center hover:bg-gray-50 transition-colors">
                        <Download size={32} className="text-green-600 mb-3" />
                        <h4 className="font-bold text-gray-800 mb-2">Sauvegarder les données</h4>
                        <p className="text-xs text-gray-500 mb-4">Télécharger un fichier .json contenant toutes vos commandes, clients, stocks, etc.</p>
                        <button onClick={handleBackup} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors w-full">
                            Télécharger Sauvegarde
                        </button>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center hover:bg-gray-50 transition-colors">
                        <Upload size={32} className="text-blue-600 mb-3" />
                        <h4 className="font-bold text-gray-800 mb-2">Restaurer une sauvegarde</h4>
                        <p className="text-xs text-gray-500 mb-4">Recharger un fichier .json précédent. <strong className="text-red-500">Écrase les données actuelles.</strong></p>
                        <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                        <button onClick={handleRestoreClick} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors w-full">
                            Choisir Fichier & Restaurer
                        </button>
                    </div>
                </div>
            </div>

            {/* SECTION 4: DANGER ZONE */}
            {onFactoryReset && (
                <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
                    <div className="bg-red-50 p-4 border-b border-red-100">
                        <h3 className="font-bold text-red-900 flex items-center gap-2">
                            <AlertTriangle size={20} /> Zone de Danger
                        </h3>
                    </div>
                    <div className="p-6 flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-gray-800">Réinitialisation d'usine</h4>
                            <p className="text-xs text-gray-500 mt-1">Efface toutes les données locales et remet les données de démonstration.</p>
                        </div>
                        <button onClick={onFactoryReset} className="px-4 py-2 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-bold flex items-center gap-2">
                            <Trash2 size={16} /> Réinitialiser Tout
                        </button>
                    </div>
                </div>
            )}

            {/* SECTION 2: EXPORT EXCEL/CSV */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FileText size={20} /> Exportation Excel (CSV)
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Exportez des listes spécifiques pour les utiliser dans Excel ou d'autres logiciels.
                    </p>
                </div>
                <div className="p-6">
                    <div className="flex flex-wrap gap-4">
                        <button onClick={() => handleExportCSV('CLIENTS')} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 hover:border-brand-300 font-medium">
                            <Download size={16} /> Liste des Clients
                        </button>
                        <button onClick={() => handleExportCSV('ARTICLES')} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 hover:border-brand-300 font-medium">
                            <Download size={16} /> Catalogue Articles
                        </button>
                        <button onClick={() => handleExportCSV('VENTES')} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 hover:border-brand-300 font-medium">
                            <Download size={16} /> Historique Ventes
                        </button>
                    </div>
                </div>
            </div>

            {/* SECTION 3: IMPORT CSV */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <RefreshCw size={20} /> Importation de Données (CSV)
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Ajoutez des données en masse (Clients ou Articles). Le fichier doit avoir des colonnes avec des en-têtes (Nom, Telephone...).
                    </p>
                </div>
                <div className="p-6 flex flex-col md:flex-row items-end gap-4">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Type de données à importer</label>
                        <select 
                            value={importType} 
                            onChange={(e) => setImportType(e.target.value as any)}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                        >
                            <option value="CLIENTS">Clients</option>
                            <option value="ARTICLES">Articles</option>
                        </select>
                    </div>
                    
                    <input type="file" accept=".csv" ref={csvInputRef} className="hidden" onChange={handleCSVFileChange} />
                    
                    <button 
                        onClick={handleCSVImportClick}
                        className="px-6 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900 transition-colors flex items-center gap-2 w-full md:w-auto justify-center"
                    >
                        <Upload size={18} /> Sélectionner CSV
                    </button>
                </div>
                <div className="px-6 pb-6 text-xs text-gray-400">
                    * Format attendu pour Clients : Colonnes "Nom", "Telephone".<br/>
                    * Format attendu pour Articles : Colonnes "Nom", "PrixAchat", "PrixVente".
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
