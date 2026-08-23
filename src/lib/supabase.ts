import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { WebSocket as NodeWebSocket } from "ws";

const globalWithSocket = globalThis as typeof globalThis & { WebSocket?: typeof globalThis.WebSocket };

if (!globalWithSocket.WebSocket) {
  globalWithSocket.WebSocket = NodeWebSocket as unknown as typeof globalThis.WebSocket;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const missingSupabaseConfig = !supabaseUrl || !supabaseServiceRoleKey;

function createMissingConfigStub(): SupabaseClient {
  const missingConfigError = {
    message: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable the database-backed auth and checkout routes.",
    code: "missing_env"
  };

  const createResult = () => ({ data: null, error: missingConfigError });

  const createQueryBuilder = () => ({
    insert: async () => ({
      select: () => ({
        single: async () => createResult()
      })
    }),
    select: () => ({
      eq: () => ({
        maybeSingle: async () => createResult(),
        single: async () => createResult()
      }),
      maybeSingle: async () => createResult(),
      single: async () => createResult()
    }),
    update: () => ({
      eq: () => ({
        select: () => ({
          single: async () => createResult()
        })
      })
    }),
    maybeSingle: async () => createResult(),
    single: async () => createResult()
  });

  return {
    from: () => createQueryBuilder()
  } as unknown as SupabaseClient;
}

if (missingSupabaseConfig) {
  console.warn(
    "[supabase] Missing Supabase environment variables; using a stub client. " +
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable database features."
  );
}

export const supabase: SupabaseClient = missingSupabaseConfig
  ? createMissingConfigStub()
  : createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
