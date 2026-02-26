/**
 * ============================================================================
 * 文件: src/storage/database/supabase-client.ts
 * 目录: 数据库客户端
 * 功能: 
 *   - 创建 Supabase 客户端连接
 *   - 支持多种环境变量名称兼容
 *   - 提供带 token 的客户端用于 RLS
 * ============================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

/**
 * 获取 Supabase 凭证
 * 支持多种环境变量名称以兼容不同部署平台
 */
function getSupabaseCredentials(): SupabaseCredentials {
  // 支持多种环境变量名称
  const url = 
    process.env.COZE_SUPABASE_URL || 
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const anonKey = 
    process.env.COZE_SUPABASE_ANON_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      'Supabase URL is not set. Please configure one of: ' +
      'COZE_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_URL'
    );
  }
  
  if (!anonKey) {
    throw new Error(
      'Supabase Anon Key is not set. Please configure one of: ' +
      'COZE_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_ANON_KEY'
    );
  }

  return { url, anonKey };
}

/**
 * 获取 Supabase 客户端
 * @param token 可选的用户 token，用于 RLS
 */
function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  const options = {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  };

  if (token) {
    return createClient(url, anonKey, {
      ...options,
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });
  }

  return createClient(url, anonKey, options);
}

export { getSupabaseCredentials, getSupabaseClient };
