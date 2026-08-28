#!/usr/bin/env bun
/**
 * Airtable 테이블 생성 스크립트
 * Usage: bun run create-table.ts --base <baseId> --name <tableName> --fields <fieldsJson>
 */

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const baseId = getArg('base') || process.env.AIRTABLE_BASE_ID;
const tableName = getArg('name');
const fieldsJson = getArg('fields');

if (!baseId || !tableName || !fieldsJson) {
  console.error('Usage: bun run create-table.ts --base <baseId> --name <tableName> --fields <fieldsJson>');
  console.error('Example: bun run create-table.ts --base appXXX --name "My Table" --fields \'[{"name":"Name","type":"singleLineText"}]\'');
  process.exit(1);
}

const apiKey = process.env.AIRTABLE_API_KEY;
if (!apiKey) {
  console.error('Error: AIRTABLE_API_KEY environment variable is required');
  process.exit(1);
}

const fields = JSON.parse(fieldsJson);

async function createTable() {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: tableName,
      fields: fields,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Error creating table:', JSON.stringify(error, null, 2));
    process.exit(1);
  }

  const result = await response.json();
  console.log('Table created successfully!');
  console.log(JSON.stringify(result, null, 2));
}

createTable();
