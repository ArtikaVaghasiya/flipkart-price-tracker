import assert from 'node:assert/strict';
import { parseJsonBody, normalizeUploadFiles } from '@/lib/validation/uploadRequest';

const validFiles = JSON.stringify({
  files: [
    { name: 'S_listing--ui--group_2eb8d3219ad94fc0_3110-152448_default.xls', contentType: 'application/vnd.ms-excel' },
    { name: 'Anuttar.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ],
});

const emptyText = '';
const brokenJson = '{';

assert.throws(() => parseJsonBody(emptyText), /empty|JSON/i, 'empty request bodies must fail with a clear message');
assert.throws(() => parseJsonBody(brokenJson), /invalid json|JSON/i, 'malformed request bodies must fail with a clear message');

const parsed = parseJsonBody(validFiles) as { files: unknown[] };
assert.ok(Array.isArray(parsed.files), 'the payload contains a files array');
assert.equal(parsed.files.length, 2, 'both spreadsheet files are accepted');

const normalized = normalizeUploadFiles(parsed.files);
assert.equal(normalized.length, 2, 'two valid spreadsheet files remain after normalization');
assert.equal(normalized[0].name, 'S_listing--ui--group_2eb8d3219ad94fc0_3110-152448_default.xls');
assert.equal(normalized[1].name, 'Anuttar.xlsx');

console.log('upload request validation checks passed');
