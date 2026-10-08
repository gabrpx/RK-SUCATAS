import { useEffect, useId, useState, type FormEvent } from 'react';
import { CalendarPlus, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/Input';
import { Modal } from '@/src/components/ui/Modal';
import { Select } from '@/src/components/ui/Select';
import { tarefasApi } from '../../tarefas/api';
import type { Tarefa, UsuarioResumo } from '../../tarefas/types';
import type { Cliente } from '../types';

interface AgendarVisitaModalProps {
  cliente: Pick<Cliente, 'id' | 'nome'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (tarefa: Tarefa) => void;
}

function valorLocalParaDateTimeLocal(data: Date): string {
  const deslocamento = data.getTimezoneOffset() * 60_000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16);
}

export function AgendarVisitaModal({ cliente, open, onOpenChange, onCreated }: AgendarVisitaModalProps) {
  const erroResponsavelId = useId();
  const [titulo, setTitulo] = useState('');
  const [prazoLocal, setPrazoLocal] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [responsaveis, setResponsaveis] = useState<UsuarioResumo[]>([]);
  const [carregandoResponsaveis, setCarregandoResponsaveis] = useState(false);
  const [erroResponsaveis, setErroResponsaveis] = useState<string | null>(null);
  const [erroTitulo, setErroTitulo] = useState<string | null>(null);
  const [erroPrazo, setErroPrazo] = useState<string | null>(null);
  const [erroResponsavel, setErroResponsavel] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [agoraLocal, setAgoraLocal] = useState(() => valorLocalParaDateTimeLocal(new Date()));

  useEffect(() => {
    if (!open) return;

    let ativo = true;
    setTitulo('');
    setPrazoLocal('');
    setResponsavelId('');
    setResponsaveis([]);
    setErroResponsaveis(null);
    setErroTitulo(null);
    setErroPrazo(null);
    setErroResponsavel(null);
    setErroSalvar(null);
    setAgoraLocal(valorLocalParaDateTimeLocal(new Date()));

    const carregarResponsaveis = async () => {
      setCarregandoResponsaveis(true);
      try {
        const resposta = await tarefasApi.listarResponsaveisPossiveis();
        if (!ativo) return;
        if (!resposta.success || !Array.isArray(resposta.data) || resposta.data.length === 0) {
          setResponsaveis([]);
          setErroResponsaveis('Não foi possível carregar os responsáveis. Tente novamente.');
          return;
        }

        setResponsaveis(resposta.data);
        const usuarioAtualId = localStorage.getItem('user_id');
        const usuarioAtualPermitido = resposta.data.find((responsavel) => responsavel.id === usuarioAtualId);
        setResponsavelId(usuarioAtualPermitido?.id ?? resposta.data[0].id);
      } catch {
        if (ativo) {
          setResponsaveis([]);
          setErroResponsaveis('Não foi possível carregar os responsáveis. Verifique sua conexão e tente novamente.');
        }
      } finally {
        if (ativo) setCarregandoResponsaveis(false);
      }
    };

    void carregarResponsaveis();
    return () => { ativo = false; };
  }, [open]);

  const tentarNovamente = async () => {
    setCarregandoResponsaveis(true);
    setErroResponsaveis(null);
    try {
      const resposta = await tarefasApi.listarResponsaveisPossiveis();
      if (!resposta.success || !Array.isArray(resposta.data) || resposta.data.length === 0) {
        setErroResponsaveis('Não foi possível carregar os responsáveis. Tente novamente.');
        return;
      }
      setResponsaveis(resposta.data);
      const usuarioAtualId = localStorage.getItem('user_id');
      const usuarioAtualPermitido = resposta.data.find((responsavel) => responsavel.id === usuarioAtualId);
      setResponsavelId(usuarioAtualPermitido?.id ?? resposta.data[0].id);
    } catch {
      setErroResponsaveis('Não foi possível carregar os responsáveis. Verifique sua conexão e tente novamente.');
    } finally {
      setCarregandoResponsaveis(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (salvando || carregandoResponsaveis || erroResponsaveis) return;

    const tituloTrimado = titulo.trim();
    const prazoDate = prazoLocal ? new Date(prazoLocal) : null;
    const tituloInvalido = !tituloTrimado;
    const prazoInvalido = !prazoDate || Number.isNaN(prazoDate.getTime()) || prazoDate.getTime() <= Date.now();
    const responsavelInvalido = !responsavelId || !responsaveis.some((responsavel) => responsavel.id === responsavelId);

    setErroTitulo(tituloInvalido ? 'Informe o assunto da visita.' : null);
    setErroPrazo(prazoInvalido ? 'Escolha uma data e hora futuras.' : null);
    setErroResponsavel(responsavelInvalido ? 'Selecione um responsável permitido.' : null);
    setErroSalvar(null);
    if (tituloInvalido || prazoInvalido || responsavelInvalido || !prazoDate) return;

    setSalvando(true);
    try {
      const resposta = await tarefasApi.criar({
        titulo: tituloTrimado,
        descricao: null,
        prazo: prazoDate.toISOString(),
        atribuido_para: responsavelId,
        cliente_id: cliente.id,
        prioridade: 'media',
        tipo: 'visita',
        itens: [],
      });

      if (!resposta.success || !resposta.data) {
        setErroSalvar('Não foi possível agendar a visita. Confira os dados e tente novamente.');
        return;
      }

      onCreated(resposta.data);
      onOpenChange(false);
    } catch {
      setErroSalvar('Não foi possível agendar a visita. Verifique sua conexão e tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={open}
      onFechar={() => { if (!salvando) onOpenChange(false); }}
      titulo="Agendar visita"
      subtitulo={`Visita para ${cliente.nome}`}
      icone={CalendarPlus}
      tamanho="md"
      rodape={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="agendar-visita-form"
            variant="accent-cta"
            disabled={salvando || carregandoResponsaveis || Boolean(erroResponsaveis)}
          >
            {salvando && <Loader2 aria-hidden="true" className="animate-spin" />}
            {salvando ? 'Agendando…' : 'Agendar visita'}
          </Button>
        </div>
      }
    >
      <form id="agendar-visita-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Assunto da visita"
          placeholder="Ex.: Avaliar peça para a moto"
          value={titulo}
          onChange={(event) => { setTitulo(event.target.value); setErroTitulo(null); }}
          error={erroTitulo ?? undefined}
          required
          maxLength={160}
          autoFocus
        />

        <Input
          label="Data e hora"
          type="datetime-local"
          value={prazoLocal}
          min={agoraLocal}
          onChange={(event) => { setPrazoLocal(event.target.value); setErroPrazo(null); }}
          error={erroPrazo ?? undefined}
          required
        />

        {erroResponsaveis ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-danger/40 bg-danger/5 p-3" role="alert">
            <p className="text-sm text-danger">{erroResponsaveis}</p>
            <Button type="button" variant="outline" size="sm" onClick={tentarNovamente} disabled={carregandoResponsaveis}>
              {carregandoResponsaveis ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
              Tentar novamente
            </Button>
          </div>
        ) : (
          <Select
            label="Responsável"
            id="agendar-visita-responsavel"
            ariaDescribedBy={erroResponsavelId}
            value={responsavelId}
            onChange={(value) => { setResponsavelId(value); setErroResponsavel(null); }}
            options={responsaveis.map((responsavel) => ({ value: responsavel.id, label: responsavel.nome_exibicao }))}
            placeholder={carregandoResponsaveis ? 'Carregando responsáveis…' : 'Selecione um responsável'}
            disabled={carregandoResponsaveis || responsaveis.length === 0}
            error={erroResponsavel ?? undefined}
          />
        )}

        <span id={erroResponsavelId} className="sr-only" aria-live="polite" aria-atomic="true">
          {erroResponsavel ? `Responsável: ${erroResponsavel}` : ''}
        </span>

        {erroSalvar && <p className="text-sm text-danger" role="alert">{erroSalvar}</p>}
      </form>
    </Modal>
  );
}
