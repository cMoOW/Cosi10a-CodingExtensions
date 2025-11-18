/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

//sign up a user 
export async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  //sign in a user 
export async function signIn(email, password) {

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
  
    if (error) throw error;
    return data;
  }
  