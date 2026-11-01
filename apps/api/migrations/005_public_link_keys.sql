-- Certaines révisions publiées contiennent des objets supprimés depuis du brouillon.
-- Leur identité doit rester adressable tant que la révision publiée les contient.
INSERT INTO object_link_keys(world_id, object_id)
SELECT DISTINCT p.world_id,
  CASE WHEN item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (item->>'id')::uuid END
FROM publications p
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.public_document->'objects') = 'array'
  THEN p.public_document->'objects' ELSE '[]'::jsonb END) AS item
WHERE item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT (world_id, object_id) DO NOTHING;
