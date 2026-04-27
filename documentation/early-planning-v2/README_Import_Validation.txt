# Import & Validation Kit — Life Chronicle

This folder contains:
- `tools/taxonomy-seeder.ts` — Node/TS script to ingest `WisdomTopicSort.xlsx` (sheet “Chapters/Question Taxonomy”) into Supabase taxonomy tables.
- `docs/cef-schema.json` — JSON Schema for validating Chronicle Exchange Format (CEF) v1 exports.

## Taxonomy Seeder
Requirements:
```bash
npm i -D ts-node typescript
npm i @supabase/supabase-js xlsx
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
ts-node tools/taxonomy-seeder.ts ./WisdomTopicSort.xlsx
```

The seeder creates/updates:
- `taxonomy_nodes` (series/topic/question) using stable keys
- `taxonomy_i18n` (labels for `en-US` or provided Locale)
- `taxonomy_prompts` (primary + followups from prompt columns)
- appends a row to `taxonomy_versions`

## CEF v1 Validation
Example (Node):
```js
import fs from 'fs';
import Ajv from 'ajv';
const ajv = new Ajv({ strict: false, allErrors: true });
const schema = JSON.parse(fs.readFileSync('docs/cef-schema.json','utf8'));
const manifest = JSON.parse(fs.readFileSync('export/manifest.json','utf8'));
const validate = ajv.compile(schema);
if (!validate(manifest)) console.error(validate.errors);
```

Validate entries:
```js
const entrySchema = { $ref: 'https://lifechronicle.example/cef.schema.json#/$defs/Entry', $defs: schema.$defs };
const validateEntry = ajv.compile(entrySchema);
const entry = JSON.parse(fs.readFileSync('export/users/<user-id>/entries/<entry-id>/entry.json','utf8'));
if (!validateEntry(entry)) console.error(validateEntry.errors);
```
