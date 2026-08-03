// Visualização "Por Moto" do Estoque: grade de cards (um por modelo de moto
// cadastrado) com foto + contagem de peças, filtrável por marca/cilindrada e
// busca por nome/ano. Filtros aqui são independentes dos filtros da Lista —
// ver EstoqueView.tsx, que só recebe o `modelo_moto_id` escolhido ao clicar
// num card.
//
// Um modelo pode ter variações por ano cadastradas como sub-níveis dele (ex:
// CG 150 > Carburada 2004-2008 / Mix 2009-2013 / Injetada 2013+ — ver
// Configurações > Motos). Quando isso acontece, o card do modelo vira um
// "grupo": clicar nele não vai direto pra lista de peças, abre os cards das
// variações; só a variação (sem filhos) leva pra lista. `ehGrupoDeVariacoes`
// decide isso, e nunca classifica Marca/Cilindrada como grupo — esses dois
// níveis continuam existindo só como filtro acima da grade.
import { Fragment, useMemo, useState } from 'react';
import { Search, Bike, ArrowLeft, Layers } from 'lucide-react';
import { CustomDropdown } from '../../components/CustomDropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { getAncestorChain, getDepth, getDescendantIds, extrairAnoOrdenavel } from '../motos/motoTree';
import { MotoCard } from './MotoCard';
import type { ModeloMoto } from '../../types/catalog';
import type { Estoque } from './types';

interface EstoqueByMotoProps {
  theme: 'light' | 'dark';
  modelos: ModeloMoto[];
  items: Estoque[];
  onSelecionarModelo: (modeloId: string) => void;
}

const TODAS = 'Todas';

function normalizar(texto: string) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function EstoqueByMoto({ theme, modelos, items, onSelecionarModelo }: EstoqueByMotoProps) {
  const [busca, setBusca] = useState('');
  const [marcaFiltro, setMarcaFiltro] = useState(TODAS);
  const [cilindradaFiltro, setCilindradaFiltro] = useState(TODAS);
  // Id do modelo "aberto" (grupo de variações por ano) — enquanto setado, a
  // grade principal some e mostra só os filhos dele.
  const [grupoAbertoId, setGrupoAbertoId] = useState<string | null>(null);

  const porId = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos]);

  const filhosPorPai = useMemo(() => {
    const mapa = new Map<string, ModeloMoto[]>();
    modelos.forEach((m) => {
      if (!m.parent_id) return;
      const lista = mapa.get(m.parent_id) ?? [];
      lista.push(m);
      mapa.set(m.parent_id, lista);
    });
    return mapa;
  }, [modelos]);

  const idsComFilhos = useMemo(() => new Set(filhosPorPai.keys()), [filhosPorPai]);

  const ehFolha = (id: string) => !idsComFilhos.has(id);

  // "Pai de folhas" a partir do nível de Modelo (profundidade >= 2): Marca e
  // Cilindrada nunca entram aqui, mesmo quando por acaso só têm filhos sem
  // netos — eles continuam sendo só filtro, nunca card de grupo.
  const ehGrupoDeVariacoes = (node: ModeloMoto) => {
    const filhos = filhosPorPai.get(node.id) ?? [];
    if (filhos.length === 0) return false;
    if (!filhos.every((f) => ehFolha(f.id))) return false;
    return getDepth(node.id, modelos) >= 2;
  };

  // Card de topo = grupo de variações OU folha "solta" (sem variações e cujo
  // pai não é ele mesmo um grupo — senão apareceria duplicado: uma vez dentro
  // do grupo do pai, outra vez direto na grade).
  const motoCards = useMemo(
    () =>
      modelos.filter((m) => {
        if (ehGrupoDeVariacoes(m)) return true;
        if (!ehFolha(m.id)) return false;
        const pai = m.parent_id ? porId.get(m.parent_id) : null;
        if (pai && ehGrupoDeVariacoes(pai)) return false;
        return true;
      }),
    [modelos, filhosPorPai, idsComFilhos, porId]
  );

  const contagemPorModelo = useMemo(() => {
    const mapa = new Map<string, number>();
    items.forEach((item) => {
      if (!item.modelo_moto_id) return;
      mapa.set(item.modelo_moto_id, (mapa.get(item.modelo_moto_id) ?? 0) + 1);
    });
    return mapa;
  }, [items]);

  // Foto de capa de um grupo: sempre a da variação de ano mais recente (ex:
  // entre Carburada/Mix/Injetada, usa a foto da Injetada) — é a versão mais
  // atual do modelo e a mais provável de já ter foto cadastrada. Sem ano em
  // nenhuma variação, cai pra ordem de cadastro; sem foto na escolhida, o
  // card mostra o ícone padrão (não busca foto de outra variação).
  const capaDoGrupo = (id: string) => {
    const filhos = filhosPorPai.get(id) ?? [];
    if (filhos.length === 0) return null;
    const maisNova = filhos.slice().sort((a, b) => (extrairAnoOrdenavel(b.ano) ?? -Infinity) - (extrairAnoOrdenavel(a.ano) ?? -Infinity))[0];
    return maisNova.imagem_url;
  };

  // Peças de um grupo somam as de todas as variações abaixo dele — quem olha
  // o card de "CG 150" quer saber quantas peças existem no total, não achar
  // que não tem nenhuma só porque elas estão nas variações.
  const contarComDescendentes = (id: string) =>
    getDescendantIds(id, modelos).reduce((soma, descId) => soma + (contagemPorModelo.get(descId) ?? 0), 0);

  const marcas = useMemo(
    () => modelos.filter((m) => !m.parent_id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt')),
    [modelos]
  );

  const cilindradas = useMemo(() => {
    if (marcaFiltro === TODAS) return [];
    return modelos
      .filter((m) => m.parent_id === marcaFiltro && idsComFilhos.has(m.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  }, [modelos, marcaFiltro, idsComFilhos]);

  const cards = useMemo(() => {
    const alvo = normalizar(busca.trim());
    return motoCards
      .map((card) => {
        const cadeia = getAncestorChain(card.id, modelos);
        const marcaNode = cadeia[0];
        const breadcrumb = cadeia
          .slice(0, -1)
          .map((n) => n.nome)
          .join(' · ');
        const grupo = ehGrupoDeVariacoes(card);
        const filhos = filhosPorPai.get(card.id) ?? [];
        return { card, cadeia, marcaNode, breadcrumb, grupo, filhos };
      })
      .filter(({ cadeia, marcaNode }) => {
        if (marcaFiltro !== TODAS && marcaNode?.id !== marcaFiltro) return false;
        if (cilindradaFiltro !== TODAS && !cadeia.some((n) => n.id === cilindradaFiltro)) return false;
        return true;
      })
      .filter(({ card, grupo, filhos }) => {
        if (!alvo) return true;
        const bateNesteNo = normalizar(card.nome).includes(alvo) || (card.ano ? normalizar(card.ano).includes(alvo) : false);
        if (bateNesteNo) return true;
        // Grupo também bate se a busca casar com o nome/ano de alguma
        // variação dele (ex: buscar "carburada" acha o card da "CG 150").
        if (grupo) return filhos.some((f) => normalizar(f.nome).includes(alvo) || (f.ano ? normalizar(f.ano).includes(alvo) : false));
        return false;
      })
      .sort((a, b) => a.card.nome.localeCompare(b.card.nome, 'pt'));
  }, [motoCards, modelos, marcaFiltro, cilindradaFiltro, busca, filhosPorPai]);

  const grupoAberto = grupoAbertoId ? porId.get(grupoAbertoId) ?? null : null;
  const filhosDoGrupoAberto = grupoAberto ? (filhosPorPai.get(grupoAberto.id) ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt')) : [];
  const breadcrumbGrupoAberto = grupoAberto
    ? getAncestorChain(grupoAberto.id, modelos)
        .map((n) => n.nome)
        .join(' · ')
    : '';

  // Clique numa variação: se por acaso ela também tiver filhos (árvore
  // montada manualmente além do padrão), continua descendo em vez de travar.
  const handleClicarCard = (id: string) => {
    const filhos = filhosPorPai.get(id) ?? [];
    if (filhos.length > 0) setGrupoAbertoId(id);
    else onSelecionarModelo(id);
  };

  if (grupoAberto) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setGrupoAbertoId(null)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} /> Voltar
        </button>

        <div className="flex items-center gap-3">
          <div className="size-11 rounded-control overflow-hidden shrink-0 bg-surface-inset flex items-center justify-center">
            {capaDoGrupo(grupoAberto.id) ? (
              <img src={capaDoGrupo(grupoAberto.id)!} alt={grupoAberto.nome} className="w-full h-full object-cover" />
            ) : (
              <Bike size={18} className="text-text-faint" />
            )}
          </div>
          <div className="min-w-0">
            {breadcrumbGrupoAberto && <p className="text-[11px] text-text-faint truncate">{breadcrumbGrupoAberto}</p>}
            <p className="text-base font-medium text-text-primary truncate">{grupoAberto.nome}</p>
          </div>
        </div>

        <p className="text-xs text-text-faint flex items-center gap-1.5">
          <Layers size={12} /> Escolha a versão pelo ano de fabricação da peça
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filhosDoGrupoAberto.map((filho) => (
            <Fragment key={filho.id}>
              <MotoCard
                nome={filho.nome}
                ano={filho.ano}
                breadcrumb=""
                imagemUrl={filho.imagem_url || capaDoGrupo(grupoAberto.id)}
                quantidadePecas={contarComDescendentes(filho.id)}
                quantidadeVariacoes={(filhosPorPai.get(filho.id) ?? []).length}
                onClick={() => handleClicarCard(filho.id)}
              />
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-border-default bg-surface-card px-3">
          <Search size={15} className="text-text-faint shrink-0" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar moto por nome ou ano..."
            className="flex-1 py-2.5 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint"
          />
        </div>
        <CustomDropdown
          theme={theme}
          variant="form"
          className="sm:w-48"
          value={marcaFiltro}
          onChange={(v) => {
            setMarcaFiltro(v);
            setCilindradaFiltro(TODAS);
          }}
          options={[{ value: TODAS, label: 'Todas as marcas' }, ...marcas.map((m) => ({ value: m.id, label: m.nome }))]}
        />
        {cilindradas.length > 0 && (
          <CustomDropdown
            theme={theme}
            variant="form"
            className="sm:w-40"
            value={cilindradaFiltro}
            onChange={setCilindradaFiltro}
            options={[{ value: TODAS, label: 'Todas as cilindradas' }, ...cilindradas.map((c) => ({ value: c.id, label: c.nome }))]}
          />
        )}
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icone={Bike}
          mensagem={
            motoCards.length === 0
              ? 'Nenhuma moto cadastrada ainda. Cadastre modelos em Configurações > Motos.'
              : 'Nenhum modelo corresponde aos filtros.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {cards.map(({ card, breadcrumb, grupo, filhos }) => (
            <Fragment key={card.id}>
              <MotoCard
                nome={card.nome}
                ano={card.ano}
                breadcrumb={breadcrumb}
                imagemUrl={grupo ? capaDoGrupo(card.id) : card.imagem_url}
                quantidadePecas={grupo ? contarComDescendentes(card.id) : contagemPorModelo.get(card.id) ?? 0}
                quantidadeVariacoes={grupo ? filhos.length : 0}
                onClick={() => handleClicarCard(card.id)}
              />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
