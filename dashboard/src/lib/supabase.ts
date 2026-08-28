import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchAllRows<T = any>(
  client: SupabaseClient = supabase,
  table: string,
  selectQuery: string = '*',
  filterFn?: (query: any) => any,
  pageSize: number = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = client.from(table).select(selectQuery).range(from, to);
    if (filterFn) {
      query = filterFn(query);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`Error fetching rows from ${table} (range ${from}-${to}):`, error.message);
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...(data as unknown as T[]));
    if (data.length < pageSize) {
      break;
    }

    page++;
  }

  return allRows;
}

