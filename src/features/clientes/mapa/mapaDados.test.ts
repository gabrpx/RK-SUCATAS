import { describe, expect, it } from 'vitest';
import estados from './brasil-estados.geo.json';
import centroides from './municipios-centroides.json';

describe('ativos geográficos do mapa de clientes', () => {
  it('contém as 27 UFs e centroides oficiais de todos os municípios', () => {
    expect(estados.type).toBe('FeatureCollection');
    expect(estados.features).toHaveLength(27);
    expect(Object.keys(centroides)).toHaveLength(5570);
  });

  it('mantém o ponto interno oficial de Juazeirinho, PB', () => {
    const juazeirinho = centroides['PB:juazeirinho'];
    expect(juazeirinho).toEqual(expect.objectContaining({ longitude: expect.any(Number), latitude: expect.any(Number) }));
    expect(juazeirinho.longitude).toBeGreaterThan(-37);
    expect(juazeirinho.longitude).toBeLessThan(-36);
    expect(juazeirinho.latitude).toBeGreaterThan(-8);
    expect(juazeirinho.latitude).toBeLessThan(-6);
  });
});
