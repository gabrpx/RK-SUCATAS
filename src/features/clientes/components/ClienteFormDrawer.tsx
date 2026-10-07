import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { OperationalDrawer } from '@/src/components/ui/OperationalDrawer';
import { SPRING_MICRO } from '@/src/components/ui/motion';
import { Button } from '@/src/components/ui/button';
import { CepInput } from '@/src/components/ui/CepInput';
import { Input } from '@/src/components/ui/Input';
import { PhoneInput } from '@/src/components/ui/PhoneInput';
import { Select } from '@/src/components/ui/Select';
import { StateCitySelect } from '@/src/components/ui/StateCitySelect';
import { Textarea } from '@/src/components/ui/Textarea';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Tabs, TabsList, TabsTrigger } from '@/src/features/tarefas-preview/PreviewTabs';
import { normalizarInstagram } from '@/src/utils/instagram';
import { clientesApi } from '../api';
import type { ClienteDuplicidade, ClienteOperacionalInput } from '../operacaoTypes';

type ContatoPreferido = ClienteOperacionalInput['preferencia_contato'];
type OrigemOperacional = ClienteOperacionalInput['origem'];

const ORIGENS: Array<{ value: OrigemOperacional; label: string }> = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'balcao', label: 'Passou na loja' },
];

export interface ClienteFormValues {
  nome: string;
  telefone: string;
  instagram_usuario: string;
  preferencia_contato: ContatoPreferido;
  origem: OrigemOperacional | '';
  cidade: string;
  estado: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  documento: string;
  data_nascimento: string;
  observacoes: string;
}

export interface ClienteFormErrors {
  nome?: string;
  telefone?: string;
  instagram_usuario?: string;
  origem?: string;
  cidade?: string;
  estado?: string;
}

export const EMPTY_CLIENTE_FORM_VALUES: ClienteFormValues = {
  nome: '',
  telefone: '',
  instagram_usuario: '',
  preferencia_contato: 'whatsapp',
  origem: '',
  cidade: '',
  estado: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  documento: '',
  data_nascimento: '',
  observacoes: '',
};

function normalizarValores(initialValue?: Partial<ClienteFormValues>): ClienteFormValues {
  return { ...EMPTY_CLIENTE_FORM_VALUES, ...initialValue };
}

function chaveDuplicidade(value: ClienteFormValues): string {
  return [
    value.nome.trim().toLocaleLowerCase('pt-BR'),
    value.telefone.replace(/\D/g, ''),
    normalizarInstagram(value.instagram_usuario),
  ].join('|');
}

export function validarClienteForm(value: ClienteFormValues): ClienteFormErrors {
  const erros: ClienteFormErrors = {};
  const telefone = value.telefone.replace(/\D/g, '');
  const instagram = normalizarInstagram(value.instagram_usuario);

  if (value.nome.trim().length < 2) erros.nome = 'Informe o nome do cliente.';
  if (value.telefone && telefone.length !== 10 && telefone.length !== 11) {
    erros.telefone = 'Informe um WhatsApp válido com DDD.';
  }
  if (value.instagram_usuario && !instagram) {
    erros.instagram_usuario = 'Informe um usuário válido do Instagram.';
  }
  if (value.preferencia_contato === 'whatsapp' && (telefone.length !== 10 && telefone.length !== 11)) {
    erros.telefone = 'Informe um WhatsApp válido com DDD.';
  }
  if (value.preferencia_contato === 'instagram' && !instagram) {
    erros.instagram_usuario = 'Informe um usuário válido do Instagram.';
  }
  if (!value.origem) erros.origem = 'Escolha de onde o cliente veio.';
  if (!value.estado.trim()) erros.estado = 'Escolha o estado.';
  if (!value.cidade.trim()) erros.cidade = 'Escolha a cidade.';
  return erros;
}

export function toClienteOperacionalInput(value: ClienteFormValues): ClienteOperacionalInput {
  return {
    nome: value.nome.trim(),
    telefone: value.telefone.replace(/\D/g, '') || null,
    instagram_usuario: normalizarInstagram(value.instagram_usuario) || null,
    preferencia_contato: value.preferencia_contato,
    origem: value.origem as OrigemOperacional,
    documento: value.documento.replace(/\D/g, '') || null,
    data_nascimento: value.data_nascimento || null,
    observacoes: value.observacoes.trim() || null,
    cidade: value.cidade.trim(),
    estado: value.estado.trim().toUpperCase(),
    cep: value.cep.replace(/\D/g, '') || null,
    logradouro: value.logradouro.trim() || null,
    numero: value.numero.trim() || null,
    complemento: value.complemento.trim() || null,
    bairro: value.bairro.trim() || null,
  };
}

export interface ClienteFormFieldsProps {
  value: ClienteFormValues;
  onChange: (value: ClienteFormValues) => void;
  errors?: ClienteFormErrors;
  disabled?: boolean;
  fieldRefs?: Partial<Record<keyof ClienteFormErrors, React.RefObject<HTMLElement | null>>>;
}

/**
 * Campos controlados de cliente. Pode ser embutido no RegistrarPedidoDrawer sem
 * abrir outro portal e sem executar chamadas de API por conta própria.
 */
export function ClienteFormFields({ value, onChange, errors = {}, disabled = false, fieldRefs = {} }: ClienteFormFieldsProps) {
  const id = React.useId();
  const reduceMotion = useReducedMotion();
  const origemConfirmada = React.useRef(Boolean(value.origem));
  const origemSugerida = React.useRef<OrigemOperacional | null>(
    null
  );

  const patch = React.useCallback((partial: Partial<ClienteFormValues>) => {
    onChange({ ...value, ...partial });
  }, [onChange, value]);

  React.useEffect(() => {
    if (value.preferencia_contato !== 'instagram' || value.origem || origemConfirmada.current) return;
    origemSugerida.current = 'instagram';
    patch({ origem: 'instagram' });
  }, [patch, value.origem, value.preferencia_contato]);

  const trocarContato = (preferencia_contato: ContatoPreferido) => {
    const partial: Partial<ClienteFormValues> = { preferencia_contato };
    if (!origemConfirmada.current) {
      if (preferencia_contato === 'instagram') {
        partial.origem = 'instagram';
        origemSugerida.current = 'instagram';
      } else if (origemSugerida.current === value.origem) {
        partial.origem = '';
        origemSugerida.current = null;
      }
    }
    patch(partial);
  };

  const setElementRef = (key: keyof ClienteFormErrors) => (node: HTMLElement | null) => {
    const target = fieldRefs[key];
    if (target) (target as React.MutableRefObject<HTMLElement | null>).current = node;
  };

  return (
    <div data-testid="cliente-form-content" className="grid grid-cols-1 gap-4">
      <Input
        ref={setElementRef('nome') as React.Ref<HTMLInputElement>}
        id={`${id}-nome`}
        label="Nome"
        value={value.nome}
        onChange={(event) => patch({ nome: event.target.value })}
        error={errors.nome}
        disabled={disabled}
        autoComplete="name"
        placeholder="Nome do cliente"
        size="mobile"
      />

      <fieldset className="min-w-0 space-y-3" disabled={disabled}>
        <legend className="mb-1 text-xs font-medium text-text-secondary">Contato principal</legend>
        <Tabs value={value.preferencia_contato} onValueChange={(next) => trocarContato(next as ContatoPreferido)}>
          <TabsList aria-label="Escolha o contato principal" className="w-full sm:w-fit">
            <TabsTrigger id={`${id}-whatsapp-tab`} value="whatsapp" className="min-h-10 flex-1 sm:flex-none">WhatsApp</TabsTrigger>
            <TabsTrigger id={`${id}-instagram-tab`} value="instagram" className="min-h-10 flex-1 sm:flex-none">Instagram</TabsTrigger>
          </TabsList>
          <motion.div data-testid="cliente-contato-panel" layout transition={reduceMotion ? { duration: 0 } : SPRING_MICRO} className="overflow-hidden">
            <AnimatePresence initial={false} mode="wait">
              {value.preferencia_contato === 'whatsapp' ? (
                <motion.div
                  key="whatsapp"
                  data-contact-panel="whatsapp"
                  id={`${id}-whatsapp`}
                  role="tabpanel"
                  aria-labelledby={`${id}-whatsapp-tab`}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={reduceMotion ? { duration: 0 } : SPRING_MICRO}
                >
                  <PhoneInput
                    ref={setElementRef('telefone') as React.Ref<HTMLInputElement>}
                    id={`${id}-whatsapp-input`}
                    label="Número do WhatsApp"
                    value={value.telefone}
                    onChange={(telefone) => patch({ telefone })}
                    error={errors.telefone}
                    disabled={disabled}
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    size="mobile"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="instagram"
                  data-contact-panel="instagram"
                  id={`${id}-instagram`}
                  role="tabpanel"
                  aria-labelledby={`${id}-instagram-tab`}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={reduceMotion ? { duration: 0 } : SPRING_MICRO}
                >
                  <Input
                    ref={setElementRef('instagram_usuario') as React.Ref<HTMLInputElement>}
                    id={`${id}-instagram-input`}
                    label="Usuário do Instagram"
                    value={value.instagram_usuario}
                    onChange={(event) => patch({ instagram_usuario: event.target.value })}
                    error={errors.instagram_usuario}
                    disabled={disabled}
                    autoComplete="off"
                    placeholder="@usuario"
                    size="mobile"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </Tabs>
      </fieldset>

      <Select
          ref={setElementRef('origem') as React.Ref<HTMLButtonElement>}
          id={`${id}-origem`}
          label="De onde veio"
          ariaLabel="De onde veio"
          placeholder="Selecione…"
          options={[{ value: '', label: 'Selecione…' }, ...ORIGENS]}
          value={value.origem}
          onChange={(origem) => {
            origemConfirmada.current = true;
            origemSugerida.current = null;
            patch({ origem: origem as OrigemOperacional });
          }}
          disabled={disabled}
          error={errors.origem}
          size="mobile"
        />

      <section aria-labelledby={`${id}-localizacao-title`} className="space-y-3">
        <div>
          <h3 id={`${id}-localizacao-title`} className="text-sm font-semibold text-text-primary">Cidade do cliente</h3>
          <p className="mt-0.5 text-xs text-text-muted">Obrigatória para organizar clientes por região.</p>
        </div>
        <div
          ref={(node) => {
            if (node && fieldRefs.estado) (fieldRefs.estado as React.MutableRefObject<HTMLElement | null>).current = node;
            if (node && fieldRefs.cidade) (fieldRefs.cidade as React.MutableRefObject<HTMLElement | null>).current = node;
          }}
          role="group"
          aria-invalid={errors.estado || errors.cidade ? true : undefined}
          aria-describedby={errors.estado || errors.cidade ? `${id}-localizacao-errors` : undefined}
        >
          <StateCitySelect
            value={{ estado: value.estado, cidade: value.cidade }}
            onChange={({ estado, cidade }) => patch({ estado, cidade })}
            error={{ estado: errors.estado, cidade: errors.cidade }}
          />
          {errors.estado || errors.cidade ? (
            <p id={`${id}-localizacao-errors`} className="sr-only">
              {[errors.estado, errors.cidade].filter(Boolean).join(' ')}
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby={`${id}-endereco-title`} className="space-y-3 rounded-card border border-border-default bg-surface-raised p-3 sm:p-4">
        <div>
          <h3 id={`${id}-endereco-title`} className="text-sm font-semibold text-text-primary">Endereço completo <span className="font-normal text-text-muted">(opcional)</span></h3>
          <p className="mt-0.5 text-xs text-text-muted">Preencha quando o cliente receber pedidos fora da cidade.</p>
        </div>
        <CepInput
          label="CEP"
          value={value.cep}
          onChange={(cep) => patch({ cep })}
          onAutoFill={({ estado, cidade, bairro, rua }) => patch({ estado, cidade, bairro, logradouro: rua })}
          disabled={disabled}
          placeholder="00000-000"
          size="mobile"
        />
        <Input
          label="Logradouro"
          value={value.logradouro}
          onChange={(event) => patch({ logradouro: event.target.value })}
          disabled={disabled}
          placeholder="Rua, avenida…"
          size="mobile"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
          <Input label="Número" value={value.numero} onChange={(event) => patch({ numero: event.target.value })} disabled={disabled} placeholder="S/N" size="mobile" />
          <Input label="Complemento" value={value.complemento} onChange={(event) => patch({ complemento: event.target.value })} disabled={disabled} placeholder="Casa, bloco…" size="mobile" />
        </div>
        <Input label="Bairro" value={value.bairro} onChange={(event) => patch({ bairro: event.target.value })} disabled={disabled} placeholder="Bairro" size="mobile" />
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="CPF/CNPJ (opcional)"
          value={value.documento}
          onChange={(event) => patch({ documento: event.target.value.replace(/\D/g, '').slice(0, 14) })}
          disabled={disabled}
          inputMode="numeric"
          size="mobile"
        />
        <Input
          label="Aniversário (opcional)"
          type="date"
          value={value.data_nascimento}
          onChange={(event) => patch({ data_nascimento: event.target.value })}
          disabled={disabled}
          size="mobile"
        />
      </div>

      <Textarea
        label="Observações (opcional)"
        value={value.observacoes}
        onChange={(event) => patch({ observacoes: event.target.value })}
        disabled={disabled}
        placeholder="Ex.: prefere contato depois das 18h"
        maxLength={2000}
        autoResize
      />
    </div>
  );
}

export interface ClienteFormSavedResult {
  clienteId: string;
}

interface ClienteFormDrawerBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: Partial<ClienteFormValues>;
}

export type ClienteFormDrawerProps =
  | (ClienteFormDrawerBaseProps & {
      mode: 'create';
      clienteId?: never;
      onSaved: (result: ClienteFormSavedResult) => void | Promise<void>;
      onValidated?: never;
    })
  | (ClienteFormDrawerBaseProps & {
      mode: 'edit';
      clienteId: string;
      onSaved: (result: ClienteFormSavedResult) => void | Promise<void>;
      onValidated?: never;
    })
  | (ClienteFormDrawerBaseProps & {
      mode: 'inline-order';
      clienteId?: never;
      onSaved?: never;
      onValidated: (payload: ClienteOperacionalInput) => void | Promise<void>;
    });

/**
 * Drawer autônomo para criar/editar cliente. Em `inline-order` apenas valida e
 * devolve o payload; a criação atômica de cliente + pedido pertence ao drawer
 * de registro de pedido.
 */
export function ClienteFormDrawer(props: ClienteFormDrawerProps) {
  const formId = React.useId();
  const [value, setValue] = React.useState(() => normalizarValores(props.initialValue));
  const [errors, setErrors] = React.useState<ClienteFormErrors>({});
  const [serviceError, setServiceError] = React.useState<string | null>(null);
  const [duplicidades, setDuplicidades] = React.useState<ClienteDuplicidade[]>([]);
  const [duplicidadeVerificada, setDuplicidadeVerificada] = React.useState<string | null>(null);
  const [confirmarCadastroSeparado, setConfirmarCadastroSeparado] = React.useState(false);
  const [verificandoDuplicidades, setVerificandoDuplicidades] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const submittingRef = React.useRef(false);
  const verificandoDuplicidadesRef = React.useRef(false);
  const nameRef = React.useRef<HTMLElement | null>(null);
  const phoneRef = React.useRef<HTMLElement | null>(null);
  const instagramRef = React.useRef<HTMLElement | null>(null);
  const originRef = React.useRef<HTMLElement | null>(null);
  const cityRef = React.useRef<HTMLElement | null>(null);
  const stateRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!props.open) return;
    setValue(normalizarValores(props.initialValue));
    setErrors({});
    setServiceError(null);
    setDuplicidades([]);
    setDuplicidadeVerificada(null);
    setConfirmarCadastroSeparado(false);
    setVerificandoDuplicidades(false);
    setSubmitting(false);
    submittingRef.current = false;
    verificandoDuplicidadesRef.current = false;
  }, [props.open, props.initialValue]);

  const focusFirstError = (currentErrors: ClienteFormErrors) => {
    const ordered: Array<[keyof ClienteFormErrors, React.RefObject<HTMLElement | null>]> = [
      ['nome', nameRef],
      ['telefone', phoneRef],
      ['instagram_usuario', instagramRef],
      ['origem', originRef],
      ['estado', stateRef],
      ['cidade', cityRef],
    ];
    const first = ordered.find(([key]) => currentErrors[key]);
    const element = first?.[1].current;
    if (!element) return;
    const locationControls = element.querySelectorAll<HTMLElement>('button[role="combobox"]');
    const focusable = first?.[0] === 'cidade'
      ? locationControls[1]
      : first?.[0] === 'estado'
        ? locationControls[0]
        : element.matches('input,select,button')
          ? element
          : element.querySelector<HTMLElement>('input,select,button,[tabindex]:not([tabindex="-1"])');
    window.requestAnimationFrame(() => focusable?.focus());
  };

  const verificarDuplicidade = async (): Promise<boolean> => {
    const chaveAtual = chaveDuplicidade(value);
    if (duplicidadeVerificada === chaveAtual) {
      return duplicidades.length === 0 || confirmarCadastroSeparado;
    }

    if (verificandoDuplicidadesRef.current) return false;
    verificandoDuplicidadesRef.current = true;
    setVerificandoDuplicidades(true);
    try {
      const payload = toClienteOperacionalInput(value);
      const response = await clientesApi.buscarDuplicidades({
        nome: payload.nome,
        telefone: payload.telefone,
        instagram_usuario: payload.instagram_usuario,
      });
      if (!response.success) {
        setServiceError(response.error || 'Não foi possível verificar cadastros parecidos. Tente novamente.');
        return false;
      }
      const encontrados = response.data ?? [];
      setDuplicidades(encontrados);
      setDuplicidadeVerificada(chaveAtual);
      setConfirmarCadastroSeparado(false);
      return encontrados.length === 0;
    } catch {
      setServiceError('Não foi possível verificar cadastros parecidos. Tente novamente.');
      return false;
    } finally {
      verificandoDuplicidadesRef.current = false;
      setVerificandoDuplicidades(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setServiceError(null);
    const currentErrors = validarClienteForm(value);
    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) {
      focusFirstError(currentErrors);
      return;
    }

    try {
      if (props.mode === 'inline-order') {
        submittingRef.current = true;
        setSubmitting(true);
        const payload = toClienteOperacionalInput(value);
        await props.onValidated(payload);
        return;
      }

      if (props.mode === 'create' && !await verificarDuplicidade()) return;

      submittingRef.current = true;
      setSubmitting(true);
      const payload = toClienteOperacionalInput(value);

      const response = props.mode === 'edit'
        ? await clientesApi.editarCliente(props.clienteId, payload)
        : await clientesApi.criarCliente(payload);
      if (!response.success || !response.data?.id) {
        setServiceError(response.error || 'Não foi possível salvar o cliente. Tente novamente.');
        return;
      }
      await props.onSaved({ clienteId: response.data.id });
      props.onOpenChange(false);
    } catch {
      setServiceError('Não foi possível salvar o cliente. Seus dados foram mantidos para tentar novamente.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const title = props.mode === 'create' ? 'Novo cliente' : props.mode === 'edit' ? 'Editar cliente' : 'Dados do cliente';
  const submitLabel = props.mode === 'create' ? 'Salvar cliente' : props.mode === 'edit' ? 'Salvar alterações' : 'Continuar pedido';
  const errorSummary = Object.values(errors).filter(Boolean);

  return (
    <OperationalDrawer
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      description="Contato, origem e cidade para acompanhar pedidos e visitas."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="mobile" onClick={() => props.onOpenChange(false)} disabled={submitting} className="w-full border-border-default bg-surface-card text-text-secondary hover:border-accent/35 hover:bg-surface-raised hover:text-text-primary sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" form={formId} size="mobile" disabled={submitting || verificandoDuplicidades} className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
            {submitting || verificandoDuplicidades ? <><Loader2 aria-hidden="true" className="animate-spin" /> Salvando…</> : submitLabel}
          </Button>
        </div>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit} className="space-y-4">
        {errorSummary.length > 0 ? (
          <div role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
            <p className="font-medium">Revise os campos destacados.</p>
            <p className="mt-0.5 text-xs">{errorSummary.join(' ')}</p>
          </div>
        ) : null}
        {serviceError ? (
          <div role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
            {serviceError}
          </div>
        ) : null}
        {props.mode === 'create' && duplicidades.length > 0 ? (
          <section aria-labelledby={`${formId}-duplicidades-title`} aria-live="polite" className="rounded-card border border-warning/30 bg-warning/5 p-4">
            <h2 id={`${formId}-duplicidades-title`} className="text-sm font-semibold text-text-primary">Cadastro parecido encontrado</h2>
            <p className="mt-1 text-sm leading-5 text-text-muted">Confira o cadastro existente antes de salvar outro cliente.</p>
            <div className="mt-3 space-y-2">
              {duplicidades.map((cliente) => (
                <div key={cliente.id} className="rounded-control border border-border-default bg-surface-card p-3">
                  <p className="truncate text-sm font-semibold text-text-primary">{cliente.nome}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {cliente.telefone || cliente.instagram_usuario || 'Contato não informado'}
                    {cliente.cidade ? ` · ${cliente.cidade}${cliente.estado ? `/${cliente.estado}` : ''}` : ''}
                  </p>
                </div>
              ))}
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-text-primary">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border-default text-accent focus:ring-accent/30"
                checked={confirmarCadastroSeparado}
                onChange={(event) => setConfirmarCadastroSeparado(event.target.checked)}
              />
              <span>É outra pessoa. Confirmo que desejo manter um cadastro separado.</span>
            </label>
          </section>
        ) : null}
        <ClienteFormFields
          value={value}
          onChange={(next) => {
            if (chaveDuplicidade(next) !== chaveDuplicidade(value)) {
              setDuplicidades([]);
              setDuplicidadeVerificada(null);
              setConfirmarCadastroSeparado(false);
            }
            setValue(next);
            setErrors({});
            setServiceError(null);
          }}
          errors={errors}
          disabled={submitting}
          fieldRefs={{
            nome: nameRef,
            telefone: phoneRef,
            instagram_usuario: instagramRef,
            origem: originRef,
            cidade: cityRef,
            estado: stateRef,
          }}
        />
      </form>
    </OperationalDrawer>
  );
}
