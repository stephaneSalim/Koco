import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jxbqlphxsgglrlznpall.supabase.co'
const supabaseAnonKey = 'sb_publishable_ZrgImoU54nnrdQnxKboadg_0AFHj1cN'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper functions for authentication
export const auth = {
  // Sign in with magic link
  async signInWithEmail(email) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    })
    return { data, error }
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current user
  getCurrentUser() {
    return supabase.auth.getUser()
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Helper functions for database operations
export const db = {
  // Users
  async getUser(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  async createUser(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single()
    return { data, error }
  },

  // Sessions
  async createSession(sessionData) {
    const { data, error } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select()
      .single()
    return { data, error }
  },

  async updateSession(sessionId, updates) {
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()
    return { data, error }
  },

  // User progress
  async getUserProgress(userId) {
    const { data, error } = await supabase
      .from('user_progress')
      .select(`
        *,
        lessons (
          id,
          title_kr,
          title_fr,
          units (
            id,
            title_kr,
            title_fr,
            levels (
              code,
              name
            )
          )
        )
      `)
      .eq('user_id', userId)
    return { data, error }
  },

  async updateUserProgress(progressData) {
    const { data, error } = await supabase
      .from('user_progress')
      .upsert(progressData, { onConflict: 'user_id,lesson_id' })
      .select()
      .single()
    return { data, error }
  }
}