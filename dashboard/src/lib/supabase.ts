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
  const MAX_PAGES = 10; // Safety guard: max 10,000 rows

  while (page < MAX_PAGES) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = client.from(table).select(selectQuery).range(from, to);
    if (filterFn) {
      query = filterFn(query);
    }

    // Guard with a 6-second timeout to avoid eternal hangs on slow or cold DB connections
    const fetchPromise = query;
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout fetching ${table} page ${page}`)), 6000)
    );

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
    if (error) {
      console.error(`Error fetching rows from ${table} (range ${from}-${to}):`, error.message);
      break;
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

