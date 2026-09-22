import { Archive, Camera, CheckCircle2, Pencil, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@/src/components/animate-ui/components/animate/tabs";
import { InventoryDrawer } from "./InventoryDrawer";
import type { GrauUnidade, PecaEstoque, UnidadeEstoque } from "./inventoryPreviewModel";

interface InventoryUnitDrawerProps {
  unidade: UnidadeEstoque | null;
  peca: PecaEstoque | null;
  onFechar: () => void;
  onSalvar: (alteracoes: Partial<Pick<UnidadeEstoque, "preco" | "grau" | "origem" | "endereco">>) => void;
  onArquivar: () => void;
  abrirEmEdicao?: boolean;
}

type AbaDetalhe = "visao-geral" | "historico";
type ModoDrawer = "detalhe" | "editar";
const inputClass = "mt-1 h-11 w-full rounded-control border border-border-default bg-surface-inset px-3 text-base text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";

function moeda(valor: number | null) { return valor === null ? "Preço a definir" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function estadoDaUnidade(unidade: UnidadeEstoque) {
  if (unidade.estado === "reservada") return { label: "Reservada", classe: "bg-blue-50 text-blue-800" };
  if (unidade.estado === "organizar" || !unidade.endereco) return { label: "Para organizar", classe: "bg-violet-50 text-violet-800" };
  return { label: "Disponível", classe: "bg-emerald-50 text-emerald-800" };
}

export function InventoryUnitDrawer({ unidade, peca, onFechar, onSalvar, onArquivar, abrirEmEdicao = false }: InventoryUnitDrawerProps) {
  const [aba, setAba] = useState<AbaDetalhe>("visao-geral");
  const [modo, setModo] = useState<ModoDrawer>("detalhe");
  const [preco, setPreco] = useState("");
  const [grau, setGrau] = useState<GrauUnidade>("B");
  const [origem, setOrigem] = useState("");
  const [endereco, setEndereco] = useState("");

  useEffect(() => {
    setAba("visao-geral"); setModo(abrirEmEdicao ? "editar" : "detalhe");
    setPreco(unidade?.preco?.toString() ?? ""); setGrau(unidade?.grau ?? "B");
    setOrigem(unidade?.origem ?? ""); setEndereco(unidade?.endereco ?? "");
  }, [unidade?.id, abrirEmEdicao]);

  if (!unidade || !peca) return null;
  const estado = estadoDaUnidade(unidade);
  const salvar = () => onSalvar({ preco: preco.trim() ? Number(preco) : null, grau, origem: origem.trim() || null, endereco: endereco.trim() || null });

  return <InventoryDrawer isOpen onClose={onFechar} title={`Detalhes da unidade ${unidade.sku}`}>
    <div className="space-y-5">
      <header className="border-b border-border-subtle pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-soft-fg">Ficha da unidade</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-text-primary">{peca.nome}</h2>
        <p className="mt-1 text-sm text-text-muted">{unidade.codigoLegado} · {unidade.sku}</p>
        <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-surface-inset px-2.5 py-1 text-xs font-semibold text-text-secondary">{peca.compatibilidades.join(" · ") || "Compatibilidade a confirmar"}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estado.classe}`}>{estado.label}</span><span className="rounded-full bg-surface-inset px-2.5 py-1 text-xs font-semibold text-text-secondary">Grau {unidade.grau}</span></div>
      </header>

      {modo === "editar" ? <section aria-labelledby="editar-unidade" className="space-y-5"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-accent-soft-fg">Editar unidade</p><h3 id="editar-unidade" className="mt-1 text-lg font-semibold">Altere somente o que mudou nesta peça física</h3></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-text-secondary">Preço de venda<input aria-label="Preço da unidade" type="number" className={inputClass} value={preco} onChange={(event) => setPreco(event.target.value)} placeholder="Pode definir depois" /></label><fieldset><legend className="text-sm font-semibold text-text-secondary">Condição</legend><div className="mt-1 grid grid-cols-3 gap-2">{(["A", "B", "C"] as const).map((opcao) => <button key={opcao} type="button" aria-pressed={grau === opcao} onClick={() => setGrau(opcao)} className={`h-11 cursor-pointer rounded-control border text-sm font-semibold ${grau === opcao ? "border-accent/40 bg-accent-soft-bg text-accent-soft-fg" : "border-border-default bg-surface-inset text-text-muted hover:border-accent/30"}`}>Grau {opcao}</button>)}</div></fieldset></div><label className="block text-sm font-semibold text-text-secondary">Origem <span className="font-normal text-text-faint">(opcional)</span><input className={inputClass} value={origem} onChange={(event) => setOrigem(event.target.value)} placeholder="Não identificada" /></label><label className="block text-sm font-semibold text-text-secondary">Localização <span className="font-normal text-text-faint">(opcional)</span><input className={inputClass} value={endereco} onChange={(event) => setEndereco(event.target.value)} placeholder="Ex.: P04-S02" /></label><p className="rounded-control border border-accent/15 bg-accent-soft-bg/50 p-3 text-sm leading-5 text-text-secondary">Se a localização ficar vazia, a unidade vai para “Para organizar”. Origem desconhecida é uma informação válida.</p></section> : <Tabs value={aba} onValueChange={(valor) => setAba(valor as AbaDetalhe)}>
        <TabsList variant="underline" aria-label="Seções da ficha" className="w-full justify-start"><TabsTrigger value="visao-geral">Visão geral</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList>
        <TabsContents><TabsContent value="visao-geral" className="pt-3"><div className="space-y-4"><section className="rounded-control border border-border-default bg-surface-card p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">Informações da unidade</p><h3 className="mt-1 text-lg font-semibold text-text-primary">{unidade.sku}</h3><div className="mt-4 grid grid-cols-2 gap-3 text-sm">{[["Preço", moeda(unidade.preco)], ["Localização", unidade.endereco ?? "Para organizar"], ["Origem", unidade.origem ?? "Não identificada"], ["Condição", `Grau ${unidade.grau}`]].map(([rotulo, valor]) => <div key={rotulo} className="rounded-control bg-surface-inset p-3"><span className="text-xs font-semibold text-text-muted">{rotulo}</span><strong className="mt-1 block text-text-primary">{valor}</strong></div>)}</div></section><section className="rounded-control border border-border-default bg-surface-card p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">Foto da unidade</p><p className="mt-1 text-sm text-text-muted">Apenas a foto desta peça física aparece aqui.</p></div><Camera className="text-text-faint" size={20} /></div><div className="mt-4 grid h-40 place-items-center overflow-hidden rounded-control border border-dashed border-border-default bg-surface-inset text-sm font-semibold text-text-muted">{unidade.fotoUrl ? <img src={unidade.fotoUrl} alt={`Foto da unidade ${unidade.sku}`} className="h-full w-full object-cover" /> : "Ainda sem foto própria"}</div></section><section className="rounded-control border border-border-default bg-surface-card p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">Detalhes e compatibilidade</p><p className="mt-2 text-sm leading-6 text-text-secondary">{unidade.detalhes || peca.detalhes || "Nenhuma observação registrada."}</p><p className="mt-3 flex items-center gap-2 text-sm font-semibold text-text-secondary"><Tag size={16} className="text-accent" />{peca.compatibilidades.join(" · ") || "Compatibilidade a confirmar"}</p></section></div></TabsContent><TabsContent value="historico" className="pt-3"><section className="rounded-control border border-border-default bg-surface-card p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">Histórico da unidade</p><h3 className="mt-1 text-lg font-semibold">Rastreabilidade preservada</h3><ol className="mt-5 space-y-5 border-l border-border-default pl-5 text-sm"><li><strong className="text-text-primary">Ficha disponível na prévia</strong><p className="mt-1 text-text-muted">SKU {unidade.sku} representa uma única peça física.</p></li><li><strong className="text-text-primary">Estado atual: {estado.label}</strong><p className="mt-1 text-text-muted">{unidade.endereco ? `Localização atual: ${unidade.endereco}.` : "Aguardando definição de localização."}</p></li><li><strong className="text-text-primary">Próxima ação</strong><p className="mt-1 text-text-muted">{unidade.fotoUrl ? "Conferir preço e atender quando solicitada." : "Adicionar foto própria quando a unidade for conferida."}</p></li></ol></section></TabsContent></TabsContents>
      </Tabs>}
      <footer className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">{modo === "editar" ? <button type="button" onClick={() => setModo("detalhe")} className="h-10 cursor-pointer rounded-control px-3 text-sm font-medium text-text-muted transition hover:bg-surface-raised hover:text-text-primary">Cancelar</button> : <button type="button" onClick={onArquivar} className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-control px-3 text-sm font-medium text-danger transition hover:bg-danger-bg"><Archive size={16} />Arquivar</button>}{modo === "editar" ? <button type="button" onClick={salvar} className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"><CheckCircle2 size={16} />Salvar alterações</button> : <button type="button" onClick={() => setModo("editar")} className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"><Pencil size={16} />Editar unidade</button>}</footer>
    </div>
  </InventoryDrawer>;
}
