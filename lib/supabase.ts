import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://ffdqizxmrrekmgvpmrcg.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZHFpenhtcnJla21ndnBtcmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzODgyNjksImV4cCI6MjA5MDk2NDI2OX0.Dj6MP87UVLJhUGhU1tQwcQt20mqVGOOKIevQFrKGtN4"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)