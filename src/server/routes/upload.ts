// Upload de imagem de peça: recebe multipart/form-data, manda pro Supabase
// Storage e devolve a URL pública já pronta pra salvar em estoque.imagem_url.
import { Router } from 'express';
import multer from 'multer';
import { uploadImagem } from '../../services/storageService.js';

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

  return router;
}
