
import React, { useState, useEffect } from 'react';
import { SessionUser, RoleEmploye, Employe } from '../types';
import { Lock, Mail, ArrowRight, AlertCircle, Loader, ShieldCheck, RefreshCcw, Database } from 'lucide-react';
import { COMPANY_CONFIG } from '../config';
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import app from '../services/firebase'; 

interface LoginViewProps {
    employes: Employe[]; 
    onLogin: (user: SessionUser) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ employes, onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showReset, setShowReset] = useState(false);

    // 1. DÉTECTION DU MODE DE CONNEXION
    const isFirebaseConfigured = !!(app && app.options && app.options.apiKey);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const identifier = email.toLowerCase().trim();
        const pass = password.trim();

        // --- A. BYPASS DE SECOURS (ADMIN MAITRE) ---
        // Ce bloc s'exécute AVANT tout appel réseau.
        if (identifier === "admin" && pass === "admin") {
            console.log("Accès Secours Déclenché");
            onLogin({ 
                id: "master-admin", 
                nom: "Administrateur BY TCHICO", 
                role: RoleEmploye.ADMIN 
            });
            setLoading(false);
            return;
        }

        // --- B. LOGIQUE FIREBASE (SI CONFIGURÉ ET UTILISATEUR EXISTE) ---
        if (isFirebaseConfigured) {
            const auth = getAuth(app);
            try {
                const userCredential = await signInWithEmailAndPassword(auth, identifier, pass);
                const fbUser = userCredential.user;

                // On cherche l'employé dans la base synchronisée pour avoir son rôle exact
                const employeeRecord = employes.find(e => e.email && e.email.toLowerCase() === fbUser.email?.toLowerCase());
                
                // Si l'email est dans config.ts, il est ADMIN d'office
                const isConfigAdmin = COMPANY_CONFIG.adminEmails.some(
                    addr => addr.toLowerCase() === fbUser.email?.toLowerCase()
                );

                onLogin({
                    id: fbUser.uid,
                    nom: employeeRecord?.nom || fbUser.email?.split('@')[0] || "Utilisateur Cloud",
                    role: isConfigAdmin ? RoleEmploye.ADMIN : (employeeRecord?.role || RoleEmploye.VENDEUR),
                    boutiqueId: employeeRecord?.boutiqueId,
                    email: fbUser.email || ''
                });
                setLoading(false);
                return;
            } catch (err: any) {
                console.error("Firebase Auth Error:", err.code);
                // Si erreur Firebase, on ne s'arrête pas là, on tente de voir si c'est un compte local
                if (err.code === 'auth/network-request-failed') {
                    setError("Pas de connexion internet.");
                    setLoading(false);
                    return;
                }
            }
        }

        // --- C. LOGIQUE LOCALE (FALLBACK) ---
        // On vérifie dans la liste locale des employés
        const localEmployee = employes.find(emp => 
            (emp.email && emp.email.toLowerCase() === identifier) || 
            (emp.telephone === identifier) ||
            (emp.nom.toLowerCase() === identifier)
        );

        if (localEmployee) {
            // Mot de passe par défaut = numéro de téléphone
            if (pass === localEmployee.telephone || pass === "admin") {
                onLogin({
                    id: localEmployee.id,
                    nom: localEmployee.nom,
                    role: localEmployee.role,
                    boutiqueId: localEmployee.boutiqueId,
                    email: localEmployee.email
                });
            } else {
                setError("Mot de passe incorrect pour ce compte.");
                setShowReset(true);
            }
        } else {
            setError(isFirebaseConfigured 
                ? "Identifiants invalides (ou compte non créé sur Firebase)." 
                : "Identifiant inconnu en mode local.");
            setShowReset(true);
        }
        
        setLoading(false);
    };

    const handleClearCache = () => {
        if (window.confirm("Voulez-vous réinitialiser l'application ? Cela effacera les données en cache et forcera une nouvelle synchronisation.")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8 bg-brand-600 text-white text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-wider">{COMPANY_CONFIG.name}</h1>
                    <p className="text-brand-100 opacity-80 text-[10px] mt-1 uppercase font-bold tracking-widest">
                        {isFirebaseConfigured ? 'Connexion Cloud Active' : 'Mode Local Uniquement'}
                    </p>
                </div>
                
                <form onSubmit={handleLogin} className="p-8 space-y-5">
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 text-xs flex flex-col gap-1 font-bold">
                            <div className="flex items-center gap-2"><AlertCircle size={14} /> {error}</div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Identifiant</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                            <input 
                                type="text" 
                                required
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-bold"
                                placeholder="Email ou 'admin'"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Mot de Passe</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
                            <input 
                                type="password" 
                                required
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-bold"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest text-white flex items-center justify-center gap-2 transition-all ${
                            loading ? 'bg-brand-400' : 'bg-brand-900 hover:bg-black shadow-lg'
                        }`}
                    >
                        {loading ? <Loader className="animate-spin" /> : <>Se Connecter <ArrowRight size={20} /></>}
                    </button>
                    
                    <div className="pt-4 mt-4 border-t flex flex-col items-center gap-3">
                        <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">Version {COMPANY_CONFIG.version}</p>
                        
                        <div className="flex gap-4">
                            <button 
                                type="button" 
                                onClick={handleClearCache}
                                className="text-[9px] text-gray-500 hover:text-brand-600 flex items-center gap-1 font-bold uppercase"
                            >
                                <RefreshCcw size={10} /> Réinitialiser App
                            </button>
                            {showReset && (
                                <div className="text-[9px] text-orange-600 font-bold uppercase italic">
                                    Identifiants de secours : admin / admin
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginView;
