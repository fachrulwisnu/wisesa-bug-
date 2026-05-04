import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Lock, Mail, Loader2, Bug, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";
import { AppUser } from "../types";

interface LoginProps {
  onLogin: (user: AppUser) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Manual Database Lookup for Login (User Requirement)
      const { data, error: dbError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .single();

      if (dbError || !data) {
        // Hardcoded Master Superadmin Fallback (User Requirement)
        if (email === "fachrulwisnunovianto@gmail.com" && password === "bosskubabi") {
          const masterUser: AppUser = {
            id: "master-admin",
            email: "fachrulwisnunovianto@gmail.com",
            role: "super_admin",
            full_name: "Master Superadmin"
          };
          onLogin(masterUser);
          return;
        }
        throw new Error("Invalid credentials or account not found.");
      }

      onLogin({
        id: data.id,
        email: data.email,
        role: data.role as "super_admin" | "admin",
        full_name: data.full_name
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-900/30 ring-4 ring-blue-600/10">
              <Bug className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">Wisesa BugTracker</h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.35em] mt-2">Governance Hub Pro</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Authorized Email</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@wisesa.co"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Access Credentials</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-sm"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-500 text-[11px] font-bold text-center flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black uppercase tracking-[0.2em] text-xs py-5 rounded-2xl shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Initialize Session"
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-800/50 text-center">
            <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em]">
              Secured Infrastructure © PT Wisesa Consulting
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
