// Supabase client loaded via CDN - available as window.supabase

const supabaseUrl = 'https://jxbqlphxsgglrlznpall.supabase.co'
const supabaseAnonKey = 'sb_publishable_ZrgImoU54nnrdQnxKboadg_0AFHj1cN'

console.log('Supabase URL:', supabaseUrl); // Debug log
console.log('Supabase Key exists:', !!supabaseAnonKey); // Debug log

// Use Supabase from CDN (window.supabase)
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey)

// Helper functions for authentication
function handleGoogleLogin() {
  window.supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
}

window.auth = {
  // Sign in with Google OAuth
  async signInWithGoogle() {
    console.log('signInWithGoogle called'); // Debug log

    const { data, error } = await window.supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })

    console.log('OAuth result:', { data, error }); // Debug log

    return { data, error }
  },

  // Sign out
  async signOut() {
    const { error } = await window.supabaseClient.auth.signOut()
    return { error }
  },

  // Get current user
  getCurrentUser() {
    return window.supabaseClient.auth.getUser()
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return window.supabaseClient.auth.onAuthStateChange(callback)
  }
}

// Helper functions for database operations
window.db = {
  // Users
  async getUser(userId) {
    const { data, error } = await window.supabaseClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  async createUser(userData) {
    const { data, error } = await window.supabaseClient
      .from('users')
      .insert(userData)
      .select()
      .single()
    return { data, error }
  },

  // Sessions
  async createSession(sessionData) {
    const { data, error } = await window.supabaseClient
      .from('sessions')
      .insert(sessionData)
      .select()
      .single()
    return { data, error }
  },

  async updateSession(sessionId, updates) {
    const { data, error } = await window.supabaseClient
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()
    return { data, error }
  },

  // User progress
  async getUserProgress(userId) {
    const { data, error } = await window.supabaseClient
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
    const { data, error } = await window.supabaseClient
      .from('user_progress')
      .upsert(progressData, { onConflict: 'user_id,lesson_id' })
      .select()
      .single()
    return { data, error }
  }
}