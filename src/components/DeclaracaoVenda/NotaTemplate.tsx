import { createPortal } from 'react-dom';

interface NotaData {
  data: string;
  comprador: string;
  endereco: string;
  cidade: string;
  cep: string;
  fone: string;
  documento: string;
  rg: string;
  veiculo: string;
  valor: string;
}

function formatDateBR(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function NotaTemplate({ data }: { data: NotaData }) {
  const dataBR = formatDateBR(data.data);
  const cidadeLimpa = data.cidade.replace(/\s*-\s*\w{2}$/, '').trim() || data.cidade;

  return createPortal(
    <>
      <style>{`
        @media print {
          body > *:not(#declaracao-venda-print) { display: none !important; }
          #declaracao-venda-print {
            display: block !important;
            position: static !important;
            left: auto !important;
            width: 100% !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          @page {
            size: A4;
            margin: 0; /* Browser print header/footer suppression depends on print-dialog "Headers and footers" checkbox, not CSS alone */
          }
        }
      `}</style>
      <div
        id="declaracao-venda-print"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '210mm',
          background: '#fff',
          color: '#000',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '11px',
          lineHeight: '1.4',
          padding: '58px 81px',
          boxSizing: 'border-box',
        }}
      >
        {/* Watermark */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '1260px',
          height: '1260px',
          opacity: 0.06,
          pointerEvents: 'none',
          zIndex: 0,
        }}>
          <img
            src="/icon-512.png"
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Header */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', fontStyle: 'italic', margin: '0 0 4px 0', borderBottom: '2px solid #000', paddingBottom: '4px', display: 'inline-block' }}>
              DECLARAÇÃO DE VENDA
            </h1>
            <p style={{ margin: '6px 0 2px', fontWeight: 'bold', fontSize: '12px' }}>RYAN CESAR MEDEIROS CONSERVA</p>
            <p style={{ margin: '2px 0' }}>CNPJ: 44.979.457-0001-65</p>
            <p style={{ margin: '2px 0' }}>Rua: Rua das acácias, N° 296, Bairro: Centro, Juazeirinho - PB</p>
            <p style={{ margin: '2px 0' }}>Fone: (83) 9171-6906</p>
          </div>
          <img
            src="/icon-512.png"
            alt="RK Sucatas"
            style={{ width: '110px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Vendedor + Data boxes */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '0', marginTop: '16px' }}>
          <div style={{ flex: 1, border: '1px solid #000', padding: '10px 12px' }}>
            <p style={{ margin: '0 0 2px', fontSize: '11px' }}>
              Vendedor: <strong>RYAN CESAR MEDEIROS CONSERVA</strong>
            </p>
            <p style={{ margin: 0, fontSize: '11px' }}>
              CNPJ: <strong>44.979.457-0001-65</strong>
            </p>
          </div>
          <div style={{ border: '1px solid #000', borderLeft: 'none', padding: '0', minWidth: '100px', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#333', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '3px 10px', letterSpacing: '1px' }}>
              DATA
            </div>
            <div style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 'bold', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {dataBR}
            </div>
          </div>
        </div>

        {/* Buyer info */}
        <div style={{ position: 'relative', zIndex: 1, border: '1px solid #000', borderTop: 'none' }}>
          <div style={{ padding: '7px 12px', borderBottom: '1px solid #000', fontSize: '11px' }}>
            Comprador: <strong>{data.comprador}</strong>
          </div>
          <div style={{ padding: '7px 12px', borderBottom: '1px solid #000', fontSize: '11px' }}>
            Endereço: {data.endereco}
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #000', fontSize: '11px' }}>
            <div style={{ flex: 2, padding: '7px 12px', borderRight: '1px solid #000' }}>
              Cidade: {data.cidade}
            </div>
            <div style={{ flex: 1, padding: '7px 12px', borderRight: '1px solid #000' }}>
              CEP: {data.cep}
            </div>
            <div style={{ flex: 1, padding: '7px 12px' }}>
              Fone: {data.fone}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: '11px' }}>
            <div style={{ flex: 1, padding: '7px 12px', borderRight: '1px solid #000' }}>
              CPF/CNPJ: {data.documento}
            </div>
            <div style={{ flex: 1, padding: '7px 8px' }}>
              RG: {data.rg}
            </div>
          </div>
        </div>

        {/* Vehicle + Value + Observation */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '0', marginTop: '14px' }}>
          {/* Vehicle area */}
          <div style={{ flex: 1, border: '1px solid #000', padding: '14px 16px', minHeight: '180px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {data.veiculo}
            </p>
            <p style={{ margin: '4px 0 10px', fontSize: '42px', fontWeight: 'bold', color: '#cc0000', lineHeight: '1' }}>
              (SUCATA)
            </p>
            <p style={{
              margin: '12px 0 0',
              fontSize: '10.5px',
              fontWeight: 'bold',
              fontStyle: 'italic',
              color: '#cc0000',
              lineHeight: '1.4',
            }}>
              ATENÇÃO: O VEÍCULO ADQUIRIDO SUCATA NÃO PODERÁ TRANSITAR EM VIA PÚBLICA, SERÁ APENAS PERMITIDO A COMERCIALIZAÇÃO DE PEÇAS, OU SEJA, VOCÊ SERÁ O COMPRADOR FINAL, CASO CONTRÁRIO PODERÁ SER PENALIZADO
            </p>
          </div>

          {/* Value + Observation column */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '150px' }}>
            <div style={{ border: '1px solid #000', borderLeft: 'none', textAlign: 'center' }}>
              <div style={{ background: '#333', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '3px 10px', letterSpacing: '1px' }}>
                VALOR
              </div>
              <div style={{ padding: '10px 8px', fontSize: '14px', fontWeight: 'bold' }}>
                {data.valor}
              </div>
            </div>
            <div style={{ border: '1px solid #000', borderLeft: 'none', borderTop: 'none', padding: '8px 10px', flex: 1 }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 'bold' }}>OBSERVAÇÃO</p>
              <p style={{ margin: 0, fontSize: '9.5px', color: '#cc0000', lineHeight: '1.4' }}>
                Caso haja quebra de contrato multa sujeita a 10% do valor da emissão da NF-E
              </p>
            </div>
          </div>
        </div>

        {/* Legal text */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: '14px', fontSize: '10.5px', lineHeight: '1.5', textAlign: 'justify' }}>
          <p style={{ margin: '0 0 8px' }}>
            Com o pagamento efetuado e com a emissão dessa declaração de venda, o (a) comprador confirma para todos os fins e efeitos que tem
            conhecimento das normas publicadas e sabe que está comprando um veículo círculo motor na condição de sucata servindo único e
            exclusivamente para aproveitamento de peças, sendo o comprador responsável por seus fins podendo ser penalizado pelo mal-uso ou
            desconformidade descritas nessa declaração de venda. O comprador declara ter conhecimento de que o veículo é sucata e não poderá mais
            circular em vias públicas, será apenas permitido a comercialização ou aproveitamento de peças, o comprador também declara que isenta o
            vendedor de qualquer responsabilidade pelo bem adquirido, e que o vendedor passou todas as informações ao devido comprador e que o
            mesmo não se responsabiliza pelo veículo vendido na presente data informada acima e que o mesmo não tem garantia pois foi vendido na
            condição de sucata e que em desacordo das informações acima o presente comprador poderá responder civil e criminalmente.
          </p>
          <p style={{ margin: 0 }}>
            Declara o comprador que está de acordo com as informações acima prestadas e que neste ato confere os dados dessa declaração de venda,
            nada mais tendo a reclamar em juízo ou administrativamente.
          </p>
        </div>

        {/* Signature */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: '22px', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '10px' }}>
            <span>ASSINATURA DO COMPRADOR:</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', minHeight: '1px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', paddingLeft: '100px' }}>
            <span>CPF:</span>
            <span style={{ flex: 1, borderBottom: '1px solid #000', minHeight: '1px' }} />
          </div>
        </div>

        {/* City / date line */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: '24px', textAlign: 'center', fontSize: '11px' }}>
          <span>{cidadeLimpa}</span>
          <span style={{ borderBottom: '1px solid #000', display: 'inline-block', width: '40px', margin: '0 4px' }} />
          <span>de</span>
          <span style={{ borderBottom: '1px solid #000', display: 'inline-block', width: '80px', margin: '0 4px' }} />
          <span>de</span>
          <span style={{ borderBottom: '1px solid #000', display: 'inline-block', width: '60px', margin: '0 4px' }} />
          <span>.</span>
        </div>
      </div>
    </>,
    document.body,
  );
}

export type { NotaData };
