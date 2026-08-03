// Visualização "Por Moto" do Estoque: grade de cards (um por modelo de moto
// cadastrado) com foto + contagem de peças, filtrável por marca/cilindrada e
// busca por nome/ano. Filtros aqui são independentes dos filtros da Lista —
// ver EstoqueView.tsx, que só recebe o `modelo_moto_id` escolhido ao clicar
// num card.
import { Fragment, useMemo, useState } from 'react';
import { Search, Bike } from 'lucide-react';
import { CustomDropdown } from '../../components/CustomDropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { getAncestorChain } from '../motos/motoTree';
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

  // Nó-folha = modelo específico (o nível que vira card); mesma definição de
  // "quem tem filho" usada em MotoTreeManager.tsx.
  const idsComFilhos = useMemo(() => {
    const s = new Set<string>();
    modelos.forEach((m) => {
      if (m.parent_id) s.add(m.parent_id);
    });
    return s;
  }, [modelos]);

  const folhas = useMemo(() => modelos.filter((m) => !idsComFilhos.has(m.id)), [modelos, idsComFilhos]);

  const contagemPorModelo = useMemo(() => {
    const mapa = new Map<string, number>();
    items.forEach((item) => {
      if (!item.modelo_moto_id) return;
      mapa.set(item.modelo_moto_id, (mapa.get(item.modelo_moto_id) ?? 0) + 1);
    });
    return mapa;
  }, [items]);

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
    return folhas
      .map((folha) => {
        const cadeia = getAncestorChain(folha.id, modelos);
        const marcaNode = cadeia[0];
        const breadcrumb = cadeia
          .slice(0, -1)
          .map((n) => n.nome)
          .join(' · ');
        return { folha, cadeia, marcaNode, breadcrumb };
      })
      .filter(({ cadeia, marcaNode }) => {
        if (marcaFiltro !== TODAS && marcaNode?.id !== marcaFiltro) return false;
        if (cilindradaFiltro !== TODAS && !cadeia.some((n) => n.id === cilindradaFiltro)) return false;
        return true;
      })
      .filter(({ folha }) => {
        if (!alvo) return true;
        const nome = normalizar(folha.nome);
        const ano = folha.ano ? normalizar(folha.ano) : '';
        return nome.includes(alvo) || ano.includes(alvo);
      })
      .sort((a, b) => a.folha.nome.localeCompare(b.folha.nome, 'pt'));
  }, [folhas, modelos, marcaFiltro, cilindradaFiltro, busca]);

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
            folhas.length === 0
              ? 'Nenhuma moto cadastrada ainda. Cadastre modelos em Configurações > Motos.'
              : 'Nenhum modelo corresponde aos filtros.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {cards.map(({ folha, breadcrumb }) => (
            <Fragment key={folha.id}>
              <MotoCard
                nome={folha.nome}
                ano={folha.ano}
                breadcrumb={breadcrumb}
                imagemUrl={folha.imagem_url}
                quantidadePecas={contagemPorModelo.get(folha.id) ?? 0}
                onClick={() => onSelecionarModelo(folha.id)}
              />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
