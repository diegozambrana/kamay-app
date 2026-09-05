import type { SupabaseClient } from "@supabase/supabase-js";

export type FakeResult = { data: unknown; error: { message: string } | null };
type Call = { method: string; args: unknown[] };

/**
 * Constructor de consultas falso: encadena como el de Supabase y registra qué
 * se pidió, para poder afirmar sobre los filtros —que es justamente lo que un
 * servicio no puede olvidar (organización explícita, `archived_at`)—.
 */
export class FakeQuery {
  readonly calls: Call[] = [];

  constructor(private readonly result: FakeResult) {}

  private record(method: string, ...args: unknown[]): this {
    this.calls.push({ method, args });
    return this;
  }

  select = (...args: unknown[]) => this.record("select", ...args);
  insert = (...args: unknown[]) => this.record("insert", ...args);
  update = (...args: unknown[]) => this.record("update", ...args);
  eq = (...args: unknown[]) => this.record("eq", ...args);
  is = (...args: unknown[]) => this.record("is", ...args);
  like = (...args: unknown[]) => this.record("like", ...args);
  in = (...args: unknown[]) => this.record("in", ...args);
  gte = (...args: unknown[]) => this.record("gte", ...args);
  gt = (...args: unknown[]) => this.record("gt", ...args);
  lte = (...args: unknown[]) => this.record("lte", ...args);
  lt = (...args: unknown[]) => this.record("lt", ...args);
  ilike = (...args: unknown[]) => this.record("ilike", ...args);
  not = (...args: unknown[]) => this.record("not", ...args);
  or = (...args: unknown[]) => this.record("or", ...args);
  order = (...args: unknown[]) => this.record("order", ...args);
  limit = (...args: unknown[]) => this.record("limit", ...args);
  single = (...args: unknown[]) => this.record("single", ...args);
  maybeSingle = (...args: unknown[]) => this.record("maybeSingle", ...args);
  overrideTypes = () => this;

  then<T>(resolve: (value: FakeResult) => T) {
    return Promise.resolve(this.result).then(resolve);
  }

  /** Argumentos de la primera llamada a `method`, o `undefined`. */
  argsOf(method: string): unknown[] | undefined {
    return this.calls.find((call) => call.method === method)?.args;
  }

  has(method: string, ...args: unknown[]): boolean {
    return this.calls.some(
      (call) =>
        call.method === method &&
        JSON.stringify(call.args) === JSON.stringify(args),
    );
  }
}

/** Cliente falso: entrega los resultados en el orden en que se piden. */
export class FakeClient {
  readonly queries: FakeQuery[] = [];
  readonly tables: string[] = [];
  readonly rpcCalls: { name: string; params: unknown }[] = [];

  constructor(private readonly results: FakeResult[]) {}

  private next(): FakeResult {
    return (
      this.results[this.queries.length + this.rpcCalls.length] ?? {
        data: [],
        error: null,
      }
    );
  }

  from = (table: string) => {
    this.tables.push(table);
    const query = new FakeQuery(this.next());
    this.queries.push(query);
    return query;
  };

  rpc = async (name: string, params: unknown) => {
    const result = this.next();
    this.rpcCalls.push({ name, params });
    return result;
  };

  /**
   * Storage falso: registra qué se subió, se firmó y se retiró, que es lo que
   * un servicio de adjuntos no puede equivocarse (la ruta y el bucket).
   */
  readonly storageCalls: { bucket: string; method: string; args: unknown[] }[] =
    [];

  storageResults: {
    upload?: { error: { message: string } | null };
    signed?: { data: { path: string; signedUrl: string }[] | null; error: unknown };
  } = {};

  storage = {
    from: (bucket: string) => ({
      upload: async (...args: unknown[]) => {
        this.storageCalls.push({ bucket, method: "upload", args });
        return this.storageResults.upload ?? { error: null };
      },
      remove: async (...args: unknown[]) => {
        this.storageCalls.push({ bucket, method: "remove", args });
        return { error: null };
      },
      createSignedUrls: async (...args: unknown[]) => {
        this.storageCalls.push({ bucket, method: "createSignedUrls", args });
        return this.storageResults.signed ?? { data: [], error: null };
      },
    }),
  };

  asSupabase() {
    return this as unknown as SupabaseClient;
  }
}
