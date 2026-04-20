import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://xkbxwdtioduklzlrhxhs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrYnh3ZHRpb2R1a2x6bHJoeGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk2NzEsImV4cCI6MjA5MTc0NTY3MX0.RfmbnIEm7Oa52ZskPGedUQiOAQHC8P3LhX2P4C8ZPkY';

window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
