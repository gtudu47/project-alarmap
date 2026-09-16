CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  password_hash text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE worlds (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  radius_km double precision NOT NULL CHECK (radius_km > 0 AND radius_km <= 1000000000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','private','unlisted','public')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE members (
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('owner','editor','viewer')),
  PRIMARY KEY(world_id, user_id)
);
CREATE TABLE layers (
  id uuid PRIMARY KEY,
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  locked boolean NOT NULL DEFAULT false,
  opacity double precision NOT NULL DEFAULT 1 CHECK (opacity BETWEEN 0 AND 1),
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE(world_id, id)
);
CREATE TABLE map_objects (
  id uuid PRIMARY KEY,
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  layer_id uuid NOT NULL,
  kind text NOT NULL,
  name text NOT NULL,
  geometry geometry(Geometry, 4326) NOT NULL,
  style jsonb NOT NULL DEFAULT '{}',
  properties jsonb NOT NULL DEFAULT '{}',
  start_year integer,
  end_year integer,
  CHECK (start_year IS NULL OR end_year IS NULL OR start_year < end_year),
  CHECK (GeometryType(geometry) IN ('POINT', 'LINESTRING', 'POLYGON', 'MULTIPOLYGON')),
  FOREIGN KEY(world_id, layer_id) REFERENCES layers(world_id, id),
  UNIQUE(world_id, id)
);
CREATE INDEX map_objects_geometry_idx ON map_objects USING gist(geometry);
CREATE INDEX map_objects_world_idx ON map_objects(world_id);

CREATE TABLE publications (
  id uuid PRIMARY KEY,
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  public_document jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(world_id, revision)
);
CREATE TABLE religions (
  id uuid PRIMARY KEY,
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  color text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  parent_religion_id uuid,
  founded_year integer,
  extinct_year integer,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE(world_id, id),
  UNIQUE(world_id, slug),
  CHECK (parent_religion_id IS NULL OR parent_religion_id <> id),
  CHECK (founded_year IS NULL OR extinct_year IS NULL OR founded_year < extinct_year),
  FOREIGN KEY(world_id, parent_religion_id) REFERENCES religions(world_id, id)
);
