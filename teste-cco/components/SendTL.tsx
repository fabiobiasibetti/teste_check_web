
import React, { useState, useEffect } from 'react';
import { User, TLRoute, TLVehicle } from '../types';
import { SharePointService } from '../services/sharepointService';
import { Loader2, Send, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';

// URL DO SEU FLUXO HTTP DO POWER AUTOMATE (COLE AQUI)
const WEBHOOK_URL = "SUA_URL_DO_POWER_AUTOMATE_AQUI";

const SendTL: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [routes, setRoutes] = useState<TLRoute[]>([]);
  const [trucks, setTrucks] = useState<TLVehicle[]>([]);
  const [trailers, setTrailers] = useState<TLVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    dateTime: '',
    routeId: '',
    truckPlate: '',
    trailerPlate: '',
    litragem: '',
    sendEmail: false
  });

  useEffect(() => {
    const loadData = async () => {
        if (!currentUser.accessToken) return;
        setIsLoading(true);
        try {
            const [r, c, rb] = await Promise.all([
                SharePointService.getTLRoutes(currentUser.accessToken),
                SharePointService.getTLVehicles(currentUser.accessToken, 'Cavalos'),
                SharePointService.getTLVehicles(currentUser.accessToken, 'Reboques')
            ]);
            setRoutes(r);
            setTrucks(c);
            setTrailers(rb);
            
            // Set current date/time
            const now = new Date();
            const formatted = `${now.toLocaleDateString('pt-BR')} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
            setFormData(prev => ({ ...prev, dateTime: formatted }));
        } catch (e) {
            setError("Erro ao carregar dados do SharePoint.");
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (WEBHOOK_URL.includes("SUA_URL")) {
        alert("Por favor, configure a WEBHOOK_URL no arquivo SendTL.tsx");
        return;
    }

    setIsSending(true);
    setError(null);

    const truck = trucks.find(t => t.Placa === formData.truckPlate);
    const trailer = trailers.find(t => t.Placa === formData.trailerPlate);

    const payload = {
        text: formData.dateTime,
        text_1: formData.routeId,
        text_2: formData.truckPlate,
        text_3: formData.trailerPlate,
        number: Number(formData.litragem),
        text_4: truck?.Equipamento || "",
        text_5: trailer?.Equipamento || "",
        text_6: truck?.Boca1 || "X",
        text_7: truck?.Boca2 || "X",
        text_8: truck?.Boca3 || "X",
        text_9: trailer?.Boca1 || "X",
        text_10: trailer?.Boca2 || "X",
        text_11: trailer?.Boca3 || "X",
        boolean: formData.sendEmail
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            setSuccess(true);
            setTimeout(() => setSuccess(false), 5000);
            setFormData(prev => ({ ...prev, litragem: '' }));
        } else {
            throw new Error("Falha no servidor do Power Automate");
        }
    } catch (err) {
        setError("Falha ao enviar dados. Verifique a URL do Webhook.");
    } finally {
        setIsSending(false);
    }
  };

  if (isLoading) return (
    <div className="h-full flex items-center justify-center flex-col gap-4 text-blue-600">
        <Loader2 size={40} className="animate-spin" />
        <p className="font-bold">Carregando listas de apoio...</p>
    </div>
  );

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20 dark:opacity-40">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0 50 Q 25 20 50 50 T 100 50" fill="none" stroke="url(#grad)" strokeWidth="0.5" />
          <path d="M0 60 Q 25 30 50 60 T 100 60" fill="none" stroke="url(#grad)" strokeWidth="0.5" />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{stopColor:'#3b82f6', stopOpacity:1}} />
                <stop offset="100%" style={{stopColor:'#8b5cf6', stopOpacity:1}} />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border dark:border-slate-800 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md z-10 animate-fade-in">
        <div className="flex justify-center mb-8">
            <img src="https://viagroup.com.br/assets/via_group-22fac685.png" alt="VIA Group" className="max-w-[150px] dark:brightness-110" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Selecione a data e horário</label>
                <input 
                    type="text" 
                    readOnly
                    value={formData.dateTime}
                    className="w-full text-center p-3 border-2 border-blue-900 dark:border-blue-400/50 rounded-xl bg-transparent font-bold text-slate-800 dark:text-white outline-none"
                />
            </div>

            <div>
                <label className="block text-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Selecione uma rota</label>
                <div className="relative">
                    <select 
                        required
                        value={formData.routeId}
                        onChange={e => setFormData({...formData, routeId: e.target.value})}
                        className="w-full p-3 pr-10 border-2 border-blue-900 dark:border-blue-400/50 rounded-xl bg-transparent font-bold text-slate-800 dark:text-white outline-none appearance-none"
                    >
                        <option value="">Selecione...</option>
                        {routes.map(r => <option key={r.id} value={r.Title}>{r.Title}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900 dark:text-blue-400" />
                </div>
            </div>

            <div>
                <label className="block text-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Selecione caminhão e reboque</label>
                <div className="space-y-3">
                    <div className="relative">
                        <select 
                            required
                            value={formData.truckPlate}
                            onChange={e => setFormData({...formData, truckPlate: e.target.value})}
                            className="w-full p-3 pr-10 border-2 border-blue-900 dark:border-blue-400/50 rounded-xl bg-transparent font-bold text-slate-800 dark:text-white outline-none appearance-none"
                        >
                            <option value="">Caminhão (Placa)</option>
                            {trucks.map(t => <option key={t.id} value={t.Placa}>{t.Placa}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900 dark:text-blue-400" />
                    </div>
                    <div className="relative">
                        <select 
                            required
                            value={formData.trailerPlate}
                            onChange={e => setFormData({...formData, trailerPlate: e.target.value})}
                            className="w-full p-3 pr-10 border-2 border-blue-900 dark:border-blue-400/50 rounded-xl bg-transparent font-bold text-slate-800 dark:text-white outline-none appearance-none"
                        >
                            <option value="">Reboque (Placa)</option>
                            {trailers.map(t => <option key={t.id} value={t.Placa}>{t.Placa}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900 dark:text-blue-400" />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Insira a litragem coletada</label>
                <input 
                    type="number" required
                    placeholder="Insira a litragem coletada"
                    value={formData.litragem}
                    onChange={e => setFormData({...formData, litragem: e.target.value})}
                    className="w-full p-3 border-2 border-blue-900 dark:border-blue-400/50 rounded-xl bg-transparent font-bold text-slate-800 dark:text-white outline-none placeholder:text-slate-400"
                />
            </div>

            <div className="flex items-center justify-center gap-3">
                <input 
                    type="checkbox" id="sendMail"
                    checked={formData.sendEmail}
                    onChange={e => setFormData({...formData, sendEmail: e.target.checked})}
                    className="w-5 h-5 rounded border-2 border-blue-900" 
                />
                <label htmlFor="sendMail" className="text-sm font-bold text-blue-900 dark:text-blue-400">Enviar email</label>
            </div>

            <button 
                type="submit"
                disabled={isSending}
                className="w-full py-4 bg-[#3b5998] hover:bg-blue-800 text-white font-black text-xl rounded-xl transition-all active:scale-95 shadow-lg flex items-center justify-center gap-3"
            >
                {isSending ? <Loader2 className="animate-spin" /> : <Send size={24} />}
                Enviar
            </button>

            {success && (
                <div className="flex items-center justify-center gap-2 text-green-600 font-bold animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={20} /> TL Enviado com Sucesso!
                </div>
            )}

            {error && (
                <div className="flex items-center justify-center gap-2 text-red-600 font-bold text-xs">
                    <AlertCircle size={16} /> {error}
                </div>
            )}
        </form>
      </div>
    </div>
  );
};

export default SendTL;
