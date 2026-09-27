import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// 환경변수를 함수 내에서 읽어서 런타임에 평가되도록 함
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;
let _supabaseBrowser: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// 브라우저용 Supabase 클라이언트 (OAuth 등 Auth 기능용)
export function getSupabaseBrowser(): SupabaseClient {
  if (!_supabaseBrowser) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    _supabaseBrowser = createBrowserClient(url, key);
  }
  return _supabaseBrowser;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

// 하위 호환성을 위한 getter (lazy)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as never)[prop];
  }
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseAdmin() as never)[prop];
  }
});

// Database types
export interface DbUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface DbCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  default_favicon_id: string | null;
  order_index: number;
  created_at: string;
}

export interface DbLink {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  url: string;
  favicon: string | null;
  type: string;
  created_at: string;
  updated_at: string;
}
