// src/lib/supabaseClient.js
// Cliente único de Supabase para toda la app JR AgroControl.
// Las credenciales viven en variables de entorno (.env), nunca en el código.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno de Supabase. Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env (local) o en Netlify (Site settings → Environment variables).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
