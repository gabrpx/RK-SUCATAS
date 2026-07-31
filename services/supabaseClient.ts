import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { requireEnv } from '../src/server/env.js';

dotenv.config();

const supabaseUrl = requireEnv('SUPABASE_URL');
const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

// Cliente único do backend pro Supabase. Usa a service_role key (não a anon
// key) porque as tabelas (estoque/vendas/caixa/categorias/modelos_moto) têm
// RLS habilitado sem policy nenhuma pra anon — só o backend, com a service
// role, consegue ler/escrever. O frontend nunca fala direto com o Supabase.
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
