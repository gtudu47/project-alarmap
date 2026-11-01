-- Les identifiants d’adresse sont opaques et ne confèrent aucun droit d’accès.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE users ADD COLUMN link_key text NOT NULL DEFAULT encode(gen_random_bytes(25), 'hex') UNIQUE;
ALTER TABLE worlds ADD COLUMN link_key text NOT NULL DEFAULT encode(gen_random_bytes(25), 'hex') UNIQUE;

-- Conserver la clé après suppression d’un objet permet à Annuler de rétablir son lien.
CREATE TABLE object_link_keys (
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  object_id uuid NOT NULL,
  link_key text NOT NULL DEFAULT encode(gen_random_bytes(25), 'hex') UNIQUE,
  PRIMARY KEY (world_id, object_id)
);
INSERT INTO object_link_keys(world_id, object_id) SELECT world_id, id FROM map_objects;

CREATE FUNCTION remember_object_link_key() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO object_link_keys(world_id, object_id) VALUES (NEW.world_id, NEW.id)
    ON CONFLICT (world_id, object_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER map_objects_remember_link_key AFTER INSERT ON map_objects
  FOR EACH ROW EXECUTE FUNCTION remember_object_link_key();
