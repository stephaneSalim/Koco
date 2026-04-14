# KoCo - Korean Conversation Companion

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Update your `.env` file with the correct Supabase credentials:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. Database Setup
Execute the SQL in `supabase-schema.sql` in your Supabase SQL Editor to create all tables and set up Row Level Security.

### 4. Start the Application
```bash
npm start
```

### 5. Access the App
Open `http://localhost:3000` in your browser.

## Features Added

- **Magic Link Authentication**: Users authenticate via email magic links
- **Session Tracking**: All conversations are tracked in Supabase
- **Secure API**: Anthropic API key is now server-side only
- **User Management**: User profiles and progress tracking

## Database Schema

The app uses the following tables:
- `levels`: Korean proficiency levels (3A, 3B, 4A, etc.)
- `units`: Learning units within each level
- `lessons`: Individual lessons within units
- `users`: User profiles linked to Supabase auth
- `user_progress`: Learning progress tracking
- `sessions`: Conversation sessions
- `corrections`: Grammar/vocab corrections
- `vocabulary_mastery`: Vocabulary learning progress
- `grammar_mastery`: Grammar structure mastery

## Security

- API key is stored server-side only
- All requests require valid Supabase authentication
- Row Level Security ensures users can only access their own data