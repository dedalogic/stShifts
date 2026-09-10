import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://lyusuqjbqqijvtevkmio.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Jv3PXBxrAILjAgTPeygOQw_61tHS183";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
