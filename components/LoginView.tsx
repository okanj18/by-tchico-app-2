
import React, { useState } from 'react';
import { SessionUser, RoleEmploye, Employe } from '../types';
import { Lock, Mail, ArrowRight, AlertCircle, Loader, ShieldCheck } from 'lucide-react';
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const identifier = email.toLowerCase().trim();

        // 1. PRIORITÉ ABSOLUE : ACCÈS DE SECOURS (Backdoor Admin)
        // Fonctionne même si Firebase est en panne ou vide.
        if (identifier === "admin" && password === "admin") {
            onLogin({ 
                id: "admin-emergency", 
                nom: "Administrateur Système", 
                role: RoleEmploye.ADMIN 
            });
            setLoading(false);
            return;
        }

        // 2. MODE SANS FIREBASE (LOCAL / DÉMO)
        if (!app || !app.options.apiKey) {
            setTimeout(() => {
                const localEmployee = employes.find(emp => 
                    (emp.email && emp.email.toLowerCase() === identifier) || 
                    (emp.telephone === identifier) ||
                    (emp.nom.toLowerCase() === identifier)
                );

                if (localEmployee) {
                    if (password === localEmployee.telephone || password === "admin") {
                        onLogin({
                            id: localEmployee.id,
                            nom: localEmployee.nom,
                            role: localEmployee.role,
                            boutiqueId: localEmployee.boutiqueId,
                            email: localEmployee.email
                        });
                    } else {
                        setError("Mot de passe incorrect pour ce compte local.");
                    }
                } else {
                    setError("Identifiant inconnu (Mode Local). Utilisez admin / admin.");
                }
                setLoading(false);
            }, 800);
            return;
        }

        // 3. MODE FIREBASE AUTH
        const auth = getAuth(app);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, identifier, password);
            const fbUser = userCredential.user;

            // Vérification du rôle
            const employeeRecord = employes.find(e => e.email && e.email.toLowerCase() === fbUser.email?.toLowerCase());
            
            // Si l'email est dans la liste des admins du config.ts, on FORCE le rôle ADMIN
            const isHardcodedAdmin = COMPANY_CONFIG.adminEmails.some(
                emailAddr => emailAddr.toLowerCase() === fbUser.email?.toLowerCase()
            );

            onLogin({
                id: fbUser.uid,
                nom: employeeRecord?.nom || fbUser.displayName || fbUser.email?.split('@')[0] || "Utilisateur Cloud",
                role: isHardcodedAdmin ? RoleEmploye.ADMIN : (employeeRecord?.role || RoleEmploye.VENDEUR),
                boutiqueId: employeeRecord?.boutiqueId,
                email: fbUser.email || ''
            });

        } catch (err: any) {
            console.error("Auth Error:", err.code);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError("Identifiants Firebase invalides.");
            } else if (err.code === 'auth/network-request-failed') {
                setError("Erreur réseau. Vérifiez votre connexion internet.");
            } else {
                setError("Erreur de connexion : " + err.code);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-900 to-gray-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8 bg-brand-600 text-white text-center">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <ShieldCheck size={40} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-wider">{COMPANY_CONFIG.name}</h1>
                    <p className="text-brand-100 opacity-80 text-sm mt-1 uppercase font-bold tracking-widest">Gestion Centralisée</p>
                </div>
                
                <form onSubmit={handleLogin} className="p-8 space-y-5">
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 text-xs flex items-center gap-2 font-bold uppercase">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Identifiant (Email ou admin)</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                            <input 
                                type="text" 
                                required
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-bold"
                                placeholder="votre@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Mot de Passe</label>
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
                            loading 
                            ? 'bg-brand-400' 
                            : 'bg-brand-900 hover:bg-black shadow-lg'
                        }`}
                    >
                        {loading ? <Loader className="animate-spin" /> : <>Accéder au Manager <ArrowRight size={20} /></>}
                    </button>
                    
                    <div className="text-center mt-4 border-t pt-4">
                        <p className="text-[10px] text-gray-400 font-mono">Système BY TCHICO v{COMPANY_CONFIG.version}</p>
                        <p className="text-[9px] text-gray-300 mt-1 italic">En cas de perte, utilisez les identifiants de secours.</p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginView;
