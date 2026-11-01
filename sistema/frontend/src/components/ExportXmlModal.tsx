import { useState, useEffect } from 'react';
import { X, Download, FileArchive, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { PdvLojistaLoader, RetailDatePicker } from '@/components/ui';

interface ExportXmlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportXmlModal({ isOpen, onClose }: ExportXmlModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [emailContador, setEmailContador] = useState('');
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      
      setStartDate(formattedDate);
      setEndDate(formattedDate);

      api.get('/tenants/me')
        .then(res => {
          if (res.data?.emailContador) {
            setEmailContador(res.data.emailContador);
          }
        })
        .catch(err => {
          console.error('Erro ao buscar e-mail do contador:', err);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error('Preencha as duas datas');
      return;
    }

    setLoadingDownload(true);
    try {
      const response = await api.get('/sales/export/xmls', {
        params: { startDate, endDate },
        responseType: 'blob', // Importante para ZIP
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `xmls_${startDate}_a_${endDate}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      
      toast.success('Download concluído com sucesso!');
      onClose();
    } catch (err: any) {
      toast.error('Nenhum XML encontrado neste período ou erro na exportação.');
    } finally {
      setLoadingDownload(false);
    }
  };

  const handleSendEmail = async () => {
    if (!startDate || !endDate) {
      toast.error('Preencha as duas datas');
      return;
    }

    if (!emailContador) {
      toast.error('Informe o e-mail de destino');
      return;
    }

    setLoadingEmail(true);
    try {
      const response = await api.post('/sales/export/xmls/send-email', {
        startDate,
        endDate,
        email: emailContador
      });

      toast.success(response.data?.message || 'E-mail enviado com sucesso!');
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao enviar XMLs por e-mail.';
      toast.error(msg);
    } finally {
      setLoadingEmail(false);
    }
  };

  const loading = loadingDownload || loadingEmail;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-page border border-line rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center p-5 border-b border-line">
          <h2 className="text-xl font-bold flex items-center gap-2"><FileArchive className="text-brand" /> Exportar XMLs</h2>
          <button onClick={onClose} className="text-muted hover:text-ink transition"><X size={24} /></button>
        </div>
        
        <div className="p-6 space-y-5">
          <p className="text-muted text-sm">Selecione o período das Notas Fiscais (NFC-e) autorizadas para exportação.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted block mb-1">Data Inicial</label>
              <RetailDatePicker
                value={startDate}
                onValueChange={setStartDate}
                rangeStart={startDate}
                rangeEnd={endDate}
                max={endDate}
                allowClear={false}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted block mb-1">Data Final</label>
              <RetailDatePicker
                value={endDate}
                onValueChange={setEndDate}
                rangeStart={startDate}
                rangeEnd={endDate}
                min={startDate}
                allowClear={false}
              />
            </div>
          </div>

          <div className="border-t border-line pt-4 space-y-2">
            <label className="text-sm font-medium text-muted block">Enviar diretamente para o Contador</label>
            <input 
              type="email" 
              value={emailContador} 
              onChange={e => setEmailContador(e.target.value)} 
              placeholder="E-mail da contabilidade"
              className="w-full bg-page border border-line rounded-xl px-4 py-2.5 text-ink focus:outline-none focus:border-brand text-sm" 
            />
            <p className="text-muted text-xs">O e-mail será enviado com o arquivo ZIP em anexo.</p>
          </div>
        </div>

        <div className="p-5 border-t border-line bg-page/50 flex flex-col sm:flex-row justify-end gap-3">
          <button 
            type="button"
            onClick={onClose} 
            className="w-full sm:w-auto order-3 sm:order-none px-5 py-2.5 rounded-xl text-muted hover:text-ink hover:bg-surface transition font-medium text-sm text-center"
          >
            Cancelar
          </button>
          
          <button 
            onClick={handleExport} 
            disabled={loading || !startDate || !endDate} 
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface hover:bg-support text-ink font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loadingDownload ? <PdvLojistaLoader mode="loader" compact size={16} /> : <Download size={16} />} 
            Baixar ZIP
          </button>

          <button 
            onClick={handleSendEmail} 
            disabled={loading || !startDate || !endDate || !emailContador} 
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand hover:bg-brand text-on-brand font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:text-on-brand"
          >
            {loadingEmail ? <PdvLojistaLoader mode="loader" compact size={16} /> : <Send size={16} />} 
            Enviar E-mail
          </button>
        </div>
      </div>
    </div>
  );
}
