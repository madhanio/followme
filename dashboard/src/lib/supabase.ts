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
  try {
    // 1. Fetch the first page immediately with a strict 2.5-second timeout
    let query0 = client.from(table).select(selectQuery).range(0, pageSize - 1);
    if (filterFn) query0 = filterFn(query0);

    const timeoutPromise = (ms: number, msg: string) =>
      new Promise<{ data: null; error: { message: string } }>((_, reject) =>
        setTimeout(() => reject(new Error(msg)), ms)
      );

    const firstRes = await Promise.race([
      query0,
      timeoutPromise(2500, `Timeout fetching ${table} initial batch`)
    ]);

    if (firstRes.error || !firstRes.data || firstRes.data.length === 0) {
      if (firstRes.error) console.error(`Error fetching first batch from ${table}:`, firstRes.error.message);
      return (firstRes.data || []) as unknown as T[];
    }

    const firstBatch = firstRes.data as unknown as T[];
    if (firstBatch.length < pageSize) {
      // The dataset fits in the first 1,000 rows - return instantly without secondary round trips!
      return firstBatch;
    }

    // 2. If table exceeds 1,000 rows, fetch remaining pages concurrently up to 5,000 max
    const MAX_PAGES = 5;
    const pagePromises: Promise<any>[] = [];

    for (let page = 1; page < MAX_PAGES; page++) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      let q = client.from(table).select(selectQuery).range(from, to);
      if (filterFn) q = filterFn(q);
      pagePromises.push(
        Promise.race([
          q,
          timeoutPromise(2500, `Timeout fetching ${table} page ${page}`)
        ]).catch(() => ({ data: [] }))
      );
    }

    const remainingPages = await Promise.all(pagePromises);
    const allRows: T[] = [...firstBatch];
    for (const res of remainingPages) {
      if (res && res.data && Array.isArray(res.data)) {
        allRows.push(...res.data);
        if (res.data.length < pageSize) break;
      }
    }
    return allRows;
  } catch (err: any) {
    console.error(`Error in fetchAllRows for ${table}:`, err.message || err);
    return [];
  }
}

