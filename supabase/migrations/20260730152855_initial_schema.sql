-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. SITES (Operational Locations)
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INT DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. USERS (Cleaners, Supervisors, Admin)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL CHECK (role IN ('cleaner', 'supervisor', 'admin')),
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CHECKPOINTS (Bathrooms / Inspection Areas)
CREATE TABLE checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    nfc_tag_id VARCHAR(255) UNIQUE,
    qr_code_hash VARCHAR(255) UNIQUE,
    display_order INT DEFAULT 0,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ATTENDANCE LOGS (Check-In / Check-Out)
CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('check_in', 'check_out')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL,
    check_in_photo_url TEXT NOT NULL,
    check_out_photo_url TEXT,
    override_reason TEXT,
    is_flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CHECKPOINT LOGS (Bathroom Cleaning Sessions)
CREATE TABLE checkpoint_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkpoint_id UUID REFERENCES checkpoints(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('in_progress', 'completed', 'expired')) DEFAULT 'in_progress',
    log_type VARCHAR(20) NOT NULL CHECK (log_type IN ('cleaning', 'inspection')) DEFAULT 'cleaning',
    before_photo_url TEXT NOT NULL,
    after_photo_url TEXT,
    inspection_note TEXT,
    duration_minutes INT,
    start_latitude DOUBLE PRECISION NOT NULL,
    start_longitude DOUBLE PRECISION NOT NULL,
    end_latitude DOUBLE PRECISION,
    end_longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for spatial queries on attendance
CREATE INDEX idx_attendance_logs_user_id ON attendance_logs(user_id);
CREATE INDEX idx_attendance_logs_site_id ON attendance_logs(site_id);
CREATE INDEX idx_attendance_logs_timestamp ON attendance_logs(timestamp);
CREATE INDEX idx_attendance_logs_type ON attendance_logs(type);

-- Indexes for checkpoint logs
CREATE INDEX idx_checkpoint_logs_checkpoint_id ON checkpoint_logs(checkpoint_id);
CREATE INDEX idx_checkpoint_logs_user_id ON checkpoint_logs(user_id);
CREATE INDEX idx_checkpoint_logs_site_id ON checkpoint_logs(site_id);
CREATE INDEX idx_checkpoint_logs_status ON checkpoint_logs(status);
CREATE INDEX idx_checkpoint_logs_log_type ON checkpoint_logs(log_type);
CREATE INDEX idx_checkpoint_logs_finished_at ON checkpoint_logs(finished_at);

-- Indexes for checkpoints
CREATE INDEX idx_checkpoints_site_id ON checkpoints(site_id);

-- Indexes for users
CREATE INDEX idx_users_site_id ON users(site_id);
CREATE INDEX idx_users_role ON users(role);

-- Spatial index on sites for geofencing queries
CREATE INDEX idx_sites_geom ON sites USING GIST (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

-- Spatial index on checkpoints
CREATE INDEX idx_checkpoints_geom ON checkpoints USING GIST (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR(50) AS $$
  SELECT role FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper function: get current user's site_id
CREATE OR REPLACE FUNCTION public.get_user_site_id()
RETURNS UUID AS $$
  SELECT site_id FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper function: get current user's internal id
CREATE OR REPLACE FUNCTION public.get_user_internal_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- -------------------- sites --------------------
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on sites"
  ON sites FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "Supervisor read own site"
  ON sites FOR SELECT
  USING (get_user_site_id() = id);

CREATE POLICY "Cleaner read own site"
  ON sites FOR SELECT
  USING (get_user_site_id() = id);

-- -------------------- users --------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on users"
  ON users FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "Supervisor read cleaners in own site"
  ON users FOR SELECT
  USING (
    get_user_role() = 'supervisor'
    AND site_id = get_user_site_id()
  );

CREATE POLICY "Cleaner read own user record"
  ON users FOR SELECT
  USING (auth_id = auth.uid());

-- -------------------- checkpoints --------------------
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on checkpoints"
  ON checkpoints FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "Supervisor read/write checkpoints in own site"
  ON checkpoints FOR ALL
  USING (
    get_user_role() = 'supervisor'
    AND site_id = get_user_site_id()
  );

CREATE POLICY "Cleaner read checkpoints in own site"
  ON checkpoints FOR SELECT
  USING (site_id = get_user_site_id());

-- -------------------- attendance_logs --------------------
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on attendance_logs"
  ON attendance_logs FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "Supervisor read attendance in own site"
  ON attendance_logs FOR SELECT
  USING (
    get_user_role() = 'supervisor'
    AND site_id = get_user_site_id()
  );

CREATE POLICY "Cleaner CRUD own attendance"
  ON attendance_logs FOR ALL
  USING (
    get_user_role() = 'cleaner'
    AND user_id = get_user_internal_id()
  );

-- -------------------- checkpoint_logs --------------------
ALTER TABLE checkpoint_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on checkpoint_logs"
  ON checkpoint_logs FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "Supervisor read checkpoint logs in own site"
  ON checkpoint_logs FOR SELECT
  USING (
    get_user_role() = 'supervisor'
    AND site_id = get_user_site_id()
  );

CREATE POLICY "Supervisor insert inspection logs"
  ON checkpoint_logs FOR INSERT
  WITH CHECK (
    get_user_role() = 'supervisor'
    AND log_type = 'inspection'
    AND site_id = get_user_site_id()
  );

CREATE POLICY "Cleaner CRUD own checkpoint logs"
  ON checkpoint_logs FOR ALL
  USING (
    get_user_role() = 'cleaner'
    AND user_id = get_user_internal_id()
  );
