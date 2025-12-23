
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

        // --- MODE DÉMO OU FALLBACK ---
        if (!app || !app.options.apiKey) {
            // Simulation de login locale si pas de Firebase configuré
            setTimeout(() => {
                const localEmployee = employes.find(emp => 
                    (emp.email && emp.email.toLowerCase() === email.toLowerCase()) || 
                    (emp.telephone === email) ||
                    (emp.nom.toLowerCase() === email.toLowerCase())
                );

                if (email === "admin" && password === "admin") {
                     onLogin({ id: "admin", nom: "Master Admin", role: RoleEmploye.ADMIN });
                } else if (localEmployee) {
                    // Vérification du mot de passe : par défaut on utilise le téléphone pour les employés
                    if (password === localEmployee.telephone) {
                        onLogin({
                            id: localEmployee.id,
                            nom: localEmployee.nom,
                            role: localEmployee.role,
                            boutiqueId: localEmployee.boutiqueId,
                            email: localEmployee.email
                        });
                    } else {
                        setError("Mot de passe incorrect (Indice : utilisez votre N° de téléphone).");
                    }
                } else {
                    setError("Identifiant inconnu dans la base locale.");
                }
                setLoading(false);
            }, 800);
            return;
        }

        // --- MODE FIREBASE AUTH (SI CONFIGURÉ) ---
        const auth = getAuth(app);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const employeeRecord = employes.find(e => e.email && e.email.toLowerCase() === email.toLowerCase());

            onLogin({
                id: user.uid,
                nom: employeeRecord?.nom || user.displayName || "Utilisateur Cloud",
                role: employeeRecord?.role || RoleEmploye.VENDEUR,
                boutiqueId: employeeRecord?.boutiqueId,
                email: user.email || ''
            });

        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError("Email ou mot de passe incorrect.");
            } else {
                setError("Problème de connexion au serveur.");
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
                    <p className="text-brand-100 opacity-80 text-sm mt-1 uppercase font-bold tracking-widest">Accès Sécurisé</p>
                </div>
                
                <form onSubmit={handleLogin} className="p-8 space-y-5">
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 text-xs flex items-center gap-2 font-bold uppercase">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Identifiant / N° Tel</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                            <input 
                                type="text" 
                                required
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-bold"
                                placeholder="Email ou Téléphone"
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
                        {loading ? <Loader className="animate-spin" /> : <>Se connecter <ArrowRight size={20} /></>}
                    </button>
                    
                    <div className="text-center mt-4">
                        <p className="text-[10px] text-gray-400 font-mono">v{COMPANY_CONFIG.version}</p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginView;
