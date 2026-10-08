import { Bike, CalendarPlus, Edit3, FileText, Instagram, MapPin, MessageCircle, PackageSearch, ShoppingCart, StickyNote } from 'lucide-react';
import { OperationalDrawer } from '@/src/components/ui/OperationalDrawer';
import { linkInstagram } from '@/src/utils/instagram';
import { linkWhatsapp } from '@/src/utils/whatsapp';
import { pedidoStatusCopy } from '../operacaoCopy';
import type { Cliente, ClienteMoto, PecaProcurada } from '../types';

export interface ClienteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente;
  onRegistrarPedido?: (cliente: Cliente) => void;
  onRegistrarVenda?: (cliente: Cliente) => void;
  onAgendarVisita?: (cliente: Cliente) => void;
  onEdit?: (cliente: Cliente) => void;
}

const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-default bg-surface-card px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50';

function formatarTelefone(telefone: string) {
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length === 11) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  if (digitos.length === 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return telefone;
}

function nomeMoto(moto: ClienteMoto) {
  return moto.modelo_moto?.nome || moto.modelo_texto || 'Moto não identificada';
}

function detalheMoto(moto: ClienteMoto) {
  return [moto.ano, moto.cor, moto.placa].filter(Boolean).join(' · ');
}

function statusPedido(pedido: PecaProcurada) {
  return pedidoStatusCopy[pedido.status] || pedido.status;
}

function dataCurta(valor: string) {
  return new Date(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const headingId = `cliente-drawer-${title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={headingId} className="border-t border-border-default pt-5 first:border-t-0 first:pt-0">
      <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <span aria-hidden="true" className="text-text-muted">{icon}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ClienteDrawer({ open, onOpenChange, cliente, onRegistrarPedido, onRegistrarVenda, onAgendarVisita, onEdit }: ClienteDrawerProps) {
  const whatsapp = linkWhatsapp(cliente.telefone);
  const instagram = linkInstagram(cliente.instagram_usuario);
  const contatoPreferido = cliente.preferencia_contato === 'instagram' ? 'instagram' : 'whatsapp';
  const contatos = [
    whatsapp ? { canal: 'whatsapp' as const, label: 'WhatsApp', valor: cliente.telefone ? formatarTelefone(cliente.telefone) : '', href: whatsapp, icon: <MessageCircle size={16} /> } : null,
    instagram ? { canal: 'instagram' as const, label: 'Instagram', valor: `@${cliente.instagram_usuario?.replace(/^@/, '')}`, href: instagram, icon: <Instagram size={16} /> } : null,
  ].filter((contato): contato is NonNullable<typeof contato> => Boolean(contato));
  const contatoPrincipal = contatos.find((contato) => contato.canal === contatoPreferido) || contatos[0];
  const contatoSecundario = contatos.find((contato) => contato !== contatoPrincipal);
  const localizacao = [cliente.cidade, cliente.estado].filter(Boolean).join(', ');
  const endereco = [cliente.logradouro, cliente.numero, cliente.complemento, cliente.bairro].filter(Boolean).join(', ');
  const motos = cliente.motos || [];
  const pedidos = cliente.pecas_procuradas || [];
  const notas = cliente.notas || [];
  const comprovantes = cliente.comprovantes_pix || [];

  const footer = (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
      <button type="button" className={secondaryButton} onClick={() => onEdit?.(cliente)} disabled={!onEdit}>
        <Edit3 aria-hidden="true" size={16} />
        Editar cliente
      </button>
      {contatoPrincipal ? (
        <a
          href={contatoPrincipal.href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`Abrir ${contatoPrincipal.label}`}
          className={secondaryButton}
        >
          {contatoPrincipal.icon}
          Abrir {contatoPrincipal.label}
        </a>
      ) : (
        <button
          type="button"
          className={secondaryButton}
          disabled
          aria-describedby="cliente-contato-indisponivel"
        >
          <MessageCircle aria-hidden="true" size={16} />
          Contato indisponível
        </button>
      )}
      <button type="button" className={secondaryButton} onClick={() => onAgendarVisita?.(cliente)} disabled={!onAgendarVisita} title={!onAgendarVisita ? 'Agenda de visitas ainda não está disponível' : undefined}>
        <CalendarPlus aria-hidden="true" size={16} />
        Agendar visita
      </button>
      <button type="button" className={primaryButton} onClick={() => onRegistrarPedido?.(cliente)} disabled={!onRegistrarPedido}>
        <PackageSearch aria-hidden="true" size={16} />
        Registrar pedido
      </button>
      {onRegistrarVenda ? (
        <button type="button" className={primaryButton} onClick={() => onRegistrarVenda(cliente)}>
          <ShoppingCart aria-hidden="true" size={16} />
          Registrar venda
        </button>
      ) : null}
      {!contatoPrincipal ? (
        <span id="cliente-contato-indisponivel" className="sr-only">
          Cadastre um WhatsApp ou Instagram para abrir o contato.
        </span>
      ) : null}
    </div>
  );

  return (
    <OperationalDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={cliente.nome}
      description={localizacao || 'Cadastro de cliente'}
      size="wide"
      footer={footer}
    >
      <main aria-label={`Ficha de ${cliente.nome}`} className="space-y-6">
        <section aria-label="Resumo do cliente" className="rounded-card border border-border-default bg-surface-raised p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Cliente</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-text-primary">{cliente.nome}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cliente.tags.map((tag) => <span key={tag} className="rounded-full bg-surface-inset px-2 py-1 text-xs text-text-secondary">{tag}</span>)}
            {!cliente.ativo ? <span className="rounded-full bg-surface-inset px-2 py-1 text-xs text-text-secondary">Inativo</span> : null}
            {cliente.banido ? <span className="rounded-full bg-danger/10 px-2 py-1 text-xs text-danger">Bloqueado</span> : null}
          </div>
        </section>

        {contatoPrincipal ? (
          <Section title="Contato" icon={<MessageCircle size={16} />}>
            <div className="space-y-2">
              <a
                href={contatoPrincipal.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`${contatoPrincipal.label} — Contato preferido`}
                className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-border-default bg-surface-card px-3 text-sm text-text-primary transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                <span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="text-text-muted">{contatoPrincipal.icon}</span><span className="truncate">{contatoPrincipal.valor}</span></span>
                <span className="shrink-0 text-xs font-medium text-text-muted">Contato preferido</span>
              </a>
              {contatoSecundario ? (
                <a
                  href={contatoSecundario.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${contatoSecundario.label} — Outro contato`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-border-default bg-surface-card px-3 text-sm text-text-primary transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                >
                  <span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="text-text-muted">{contatoSecundario.icon}</span><span className="truncate">{contatoSecundario.valor}</span></span>
                  <span className="shrink-0 text-xs font-medium text-text-muted">Outro contato</span>
                </a>
              ) : null}
            </div>
          </Section>
        ) : null}

        {localizacao || endereco ? (
          <Section title="Localização" icon={<MapPin size={16} />}>
            {localizacao ? <p className="text-sm text-text-primary">{localizacao}</p> : null}
            {endereco ? <p className="mt-1 text-sm text-text-muted">{endereco}</p> : null}
          </Section>
        ) : null}

        {motos.length > 0 ? (
          <Section title="Motos" icon={<Bike size={16} />}>
            <ul className="space-y-2" aria-label="Motos cadastradas">
              {motos.map((moto) => (
                <li key={moto.id} className="rounded-control border border-border-default bg-surface-card px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-text-primary">{nomeMoto(moto)}</p>{detalheMoto(moto) ? <p className="mt-0.5 text-xs text-text-muted">{detalheMoto(moto)}</p> : null}</div>
                    {moto.principal ? <span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent">Principal</span> : null}
                  </div>
                  {moto.observacoes ? <p className="mt-2 text-xs text-text-muted">{moto.observacoes}</p> : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {pedidos.length > 0 ? (
          <Section title="Pedidos" icon={<PackageSearch size={16} />}>
            <ul className="space-y-2" aria-label="Pedidos do cliente">
              {pedidos.map((pedido) => (
                <li key={pedido.id} className="rounded-control border border-border-default bg-surface-card px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-text-primary">{pedido.descricao}</p><p className="mt-0.5 truncate text-xs text-text-muted">{pedido.modelo_moto?.nome || pedido.moto_modelo_texto || 'Moto não informada'}</p></div><span className="shrink-0 rounded-full bg-surface-inset px-2 py-1 text-[11px] font-medium text-text-secondary">{statusPedido(pedido)}</span></div>
                  {pedido.prometido_para ? <p className="mt-2 text-xs text-text-muted">Combinado para {dataCurta(pedido.prometido_para)}</p> : null}
                  {pedido.observacoes ? <p className="mt-2 text-xs text-text-muted">{pedido.observacoes}</p> : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {cliente.observacoes ? <Section title="Observações" icon={<StickyNote size={16} />}><p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">{cliente.observacoes}</p></Section> : null}

        {notas.length > 0 ? (
          <Section title="Anotações" icon={<StickyNote size={16} />}>
            <ul className="space-y-2" aria-label="Anotações de atendimento">
              {notas.map((nota) => <li key={nota.id} className="rounded-control border border-border-default bg-surface-card px-3 py-2.5"><p className="text-sm text-text-secondary">{nota.texto}</p><p className="mt-1 text-xs text-text-muted">{nota.autor?.nome_exibicao || 'Equipe'} · {new Date(nota.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p></li>)}
            </ul>
          </Section>
        ) : null}

        {comprovantes.length > 0 ? (
          <Section title="Comprovantes de PIX" icon={<FileText size={16} />}>
            <ul className="space-y-2" aria-label="Comprovantes de PIX">
              {comprovantes.map((comprovante) => <li key={comprovante.id} className="rounded-control border border-border-default bg-surface-card px-3 py-2.5"><p className="text-sm font-medium text-text-primary">{comprovante.nome_arquivo}</p><p className="mt-0.5 text-xs text-text-muted">{comprovante.venda?.nome_item || 'Venda não identificada'}{comprovante.venda?.data ? ` · ${dataCurta(comprovante.venda.data)}` : ''}</p>{comprovante.url ? <a href={comprovante.url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex text-xs font-medium text-accent hover:underline">Abrir comprovante</a> : null}</li>)}
            </ul>
          </Section>
        ) : null}

        <section aria-labelledby="cliente-drawer-proximas-etapas" className="rounded-card border border-border-default bg-surface-raised p-4">
          <h2 id="cliente-drawer-proximas-etapas" className="text-sm font-semibold text-text-primary">Próximas etapas</h2>
          <p className="mt-1 text-sm leading-5 text-text-muted">As visitas agendadas para este cliente aparecem na Agenda e em Tarefas. Nenhuma reserva é criada por esta ficha.</p>
        </section>
      </main>
    </OperationalDrawer>
  );
}
