/*
  # Create user settings and integrations tables

  1. New Tables
    - `user_profiles` - Extended user profile information
      - `id` (uuid, primary key, links to auth.users)
      - `admin_token` (text, unique)
      - `has_2fa` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `user_2fa_secrets` - 2FA configuration
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `secret` (text)
      - `verified` (boolean)
      - `created_at` (timestamp)
    
    - `discord_webhooks` - Discord webhook configurations
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `webhook_url` (text)
      - `name` (text)
      - `active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `bot_tokens` - Bot token storage
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `token` (text)
      - `token_type` (text, enum: discord, custom)
      - `name` (text)
      - `active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own data
    - Admin tokens are unique per user
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  has_2fa boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_2fa_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discord_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_url text NOT NULL,
  name text DEFAULT 'Webhook',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  token_type text NOT NULL CHECK (token_type IN ('discord', 'custom')),
  name text DEFAULT 'Bot Token',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own 2fa secrets"
  ON user_2fa_secrets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own 2fa secrets"
  ON user_2fa_secrets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own 2fa secrets"
  ON user_2fa_secrets FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own webhooks"
  ON discord_webhooks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert webhooks"
  ON discord_webhooks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own webhooks"
  ON discord_webhooks FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own webhooks"
  ON discord_webhooks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own bot tokens"
  ON bot_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert bot tokens"
  ON bot_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bot tokens"
  ON bot_tokens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own bot tokens"
  ON bot_tokens FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
