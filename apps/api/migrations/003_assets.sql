CREATE TABLE assets (
  id uuid PRIMARY KEY,
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  storage_key text NOT NULL UNIQUE,
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 4194304),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 8192),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(world_id, id)
);
CREATE INDEX assets_world_idx ON assets(world_id, created_at, id);
