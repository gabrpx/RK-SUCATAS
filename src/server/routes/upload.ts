// Upload de imagem de peça: recebe multipart/form-data, manda pro Supabase
// Storage e devolve a URL pública já pronta pra salvar em estoque.imagens (ou
// modelos_moto.imagem_url, estoque_unidades.fotos — endpoint genérico, um
// arquivo por chamada; quem precisa de várias imagens chama em loop).
import { Router } from 'express';
import multer from 'multer';
import { uploadImagem, uploadComprovantePix } from '../../services/storageService.js';

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_ACEITOS.includes(file.mimetype)) {
      return cb(new Error('Formato de imagem não suportado (use JPG, PNG, WEBP ou GIF)'));
    }
    cb(null, true);
  },
});

// Comprovante de PIX aceita imagem OU PDF — endpoint separado do de imagem
// de peça de propósito (bucket diferente, privado, e regra de tipo própria;
// não queremos abrir PDF pra fotos de estoque nem imagem solta virando
// "comprovante" sem passar pelo fluxo de vínculo com a venda).
const TIPOS_ACEITOS_COMPROVANTE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const uploadComprovante = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_ACEITOS_COMPROVANTE.includes(file.mimetype)) {
      return cb(new Error('Formato não suportado pra comprovante (use JPG, PNG, WEBP, GIF ou PDF)'));
    }
    cb(null, true);
  },
});

export function uploadRouter() {
  const router = Router();

  router.post('/imagem', (req, res) => {
    upload.single('imagem')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
      }
      try {
        const url = await uploadImagem(req.file.buffer, req.file.originalname, req.file.mimetype);
        res.json({ success: true, url });
      } catch (error: any) {
        console.error('Erro ao subir imagem:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

  // Só sobe o arquivo cru e devolve os fatos verificados pelo servidor
  // (path, nome, tipo, tamanho) — quem chama registra o vínculo com a venda
  // depois via POST /api/vendas/:id/comprovantes, nunca confiando no que o
  // cliente HTTP diz sobre o próprio arquivo.
  router.post('/comprovante', (req, res) => {
    uploadComprovante.single('arquivo')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
      }
      try {
        const storage_path = await uploadComprovantePix(req.file.buffer, req.file.originalname, req.file.mimetype);
        res.json({
          success: true,
          storage_path,
          nome_arquivo: req.file.originalname,
          tipo_mime: req.file.mimetype,
          tamanho_bytes: req.file.size,
        });
      } catch (error: any) {
        console.error('Erro ao subir comprovante:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

  return router;
}
