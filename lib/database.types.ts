/**
 * GENERATED FILE — DO NOT HAND-EDIT.
 *
 * This is a placeholder so the app typechecks before Supabase exists.
 * Once your Supabase project is live and schema.sql has been applied, run:
 *
 *   npx supabase gen types typescript --project-id <your-project-ref> > lib/database.types.ts
 *
 * (or --local if using the Supabase CLI's local dev stack) and commit the
 * result. Everything importing `Database` from this file will then get real
 * generated types instead of `unknown`.
 */

export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown> }>;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
};
