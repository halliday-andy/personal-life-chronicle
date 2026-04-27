---
name: Life Chronicle — Location as Three-Layer Design
description: Settled design decision: location in a memory is represented across three schema layers, not one; prevents collapsing them in future work
type: project
originSessionId: focused-eloquent-thompson
---

Location does not fit into a single dimension axis. It is three distinct things that belong in three distinct schema layers:

**Layer 1 — Entity (the specific named place):** Goes in the `entities` table with `type = 'place'`. Geographic hierarchy (country > city > neighborhood > specific address) is modeled via the `location_entity_id` parent chain — a self-referencing entity tree. Multiple place entities link to one memory via `memory_entities` with `role = 'location'`; `is_primary = true` marks the most specific level. A query for "all memories in Spain" walks the parent chain upward.

**Layer 2 — Environment Dimension (the type/character of place):** Belongs in the `environment` dimension axis as a tag on the memory. Examples: home, workplace, school, foreign country, nature/outdoors, public venue, military installation. This is categorical, not geographic. Enables queries like "all memories in a home environment" without knowing specific addresses.

**Layer 3 — Relationship (person's history with a place over time):** Goes in `relationships` with types like `lived_at`, `worked_at`, `visited`, `attended`, with start/end dates. Powers timeline queries: "list every place I've lived, in order." This is graph-edge information about the person's connection to a place, not about a single memory.

**Critical principle:** Geographic hierarchy (Spain → Madrid → Calle Mayor) belongs in the entity parent chain, NOT in the dimension taxonomy. Dimensions are categories of experience. Geography is a named entity tree. Mixing them would put "Spain" alongside "Grief" and "Career" in the same taxonomy — categorically wrong.

**Note on `environment` dimension scope:** The dimension type description in schema v1 leans too domestic ("physical or domestic setting"). It should be broadened in seed data to cover all place-character categories: home, work, educational, natural, foreign/domestic, public/private. This is a seed data fix, not a schema change.

**Geospatial layer added (schema_v1.sql, April 2026):**
- PostGIS extension enabled; `geom GEOGRAPHY(GEOMETRY, 4326)` column on `entities`
- `place_subtype` enum: continent, country, region, city, neighborhood, address, landmark, natural_feature, transit_hub, military_base, vessel
- `elevation_m`, `country_code`, `timezone`, `external_geo_id`, `external_geo_source` on entities
- GiST spatial index on `geom` for radius/bounding-box queries
- `life_journey` view: ordered place-legs with GeoJSON, duration, memory count, synthesis pointer
- `life_journey_geojson()` function: returns full journey as GeoJSON FeatureCollection (Cesium/Mapbox ready)
- `memories_within_radius()` function: spatial query for memories near a lat/lng
- Geocoding pipeline is an Entity Agent responsibility (not yet built)
- Recommended visualization: Cesium.js for 3D globe, Mapbox GL for 2D/2.5D map

**How to apply:** When a memory involves a place, ask which of the three layers is relevant. Usually all three. Never try to encode geographic specificity (country, city, address) as a dimension tag. The globe vision — places weighted by memory density, portrait surfaced on hover, drill-down to individual memories — is the target UX for place navigation.
