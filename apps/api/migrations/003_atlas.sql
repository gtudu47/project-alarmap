CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE INDEX IF NOT EXISTS map_objects_world_id_cursor_idx ON map_objects(world_id, id);
