const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { POST: signPost } = require('./app/api/upload/sign/route.ts');
const { POST: validatePost } = require('./app/api/upload/route.ts');

const listingRows = [
  ['Seller SKU ID', 'Flipkart Serial Number', 'Current Bank Settlement'],
  ['SKU-1', 'FSN-1', '100'],
  ['SKU-2', 'FSN-2', '200'],
];

const minimumRows = [
  ['Seller SKU ID', 'Minimum Bank Settlement Price'],
  ['SKU-1', '90'],
  ['SKU-2', '180'],
];

function makeBook(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return wb;
}

function toBuffer(book, type) {
  return Buffer.from(XLSX.write(book, { type: 'array', bookType: type }));
}

function contentTypeFor(ext) {
  return ext === 'xls'
    ? 'application/vnd.ms-excel'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

async function signCase(label, listingExt, minimumExt) {
  const listingBytes = toBuffer(makeBook(listingRows), listingExt);
  const minimumBytes = toBuffer(makeBook(minimumRows), minimumExt);

  const signResponse = await signPost(
    new Request('http://localhost/api/upload/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        files: [
          { name: `listing.${listingExt}`, contentType: contentTypeFor(listingExt) },
          { name: `minimum.${minimumExt}`, contentType: contentTypeFor(minimumExt) },
        ],
      }),
    }),
  );

  const signJson = await signResponse.json();
  console.log(label + ' signStatus=' + signResponse.status + ' uploads=' + (signJson.uploads ? signJson.uploads.length : 0));
  if (signResponse.status !== 200 || !signJson.uploads || signJson.uploads.length !== 2) {
    throw new Error(label + ' sign failed: ' + JSON.stringify(signJson));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  for (const [index, upload] of signJson.uploads.entries()) {
    const file = index === 0 ? listingBytes : minimumBytes;
    const blob = new Blob([file], { type: index === 0 ? contentTypeFor(listingExt) : contentTypeFor(minimumExt) });
    const putResult = await supabase.storage.from(signJson.bucket).uploadToSignedUrl(
      upload.path,
      upload.token,
      blob,
      { contentType: blob.type },
    );

    if (putResult.error) {
      throw new Error(label + ' upload failed: ' + putResult.error.message);
    }
  }

  const validateResponse = await validatePost(
    new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filePath: signJson.uploads[0].path,
        minimumFilePath: signJson.uploads[1].path,
        targetSeller: 'Previx',
      }),
    }),
  );

  const validateJson = await validateResponse.json();
  console.log(label + ' validateStatus=' + validateResponse.status + ' ok=' + !!(validateJson.report && validateJson.report.ok) + ' errors=' + (validateJson.report && validateJson.report.errorCount));

  if (validateResponse.status !== 200 || !validateJson.report || !validateJson.report.ok) {
    throw new Error(label + ' validation failed: ' + JSON.stringify(validateJson));
  }
}

async function invalidCase(label, body) {
  const response = await signPost(
    new Request('http://localhost/api/upload/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }),
  );

  const json = await response.json();
  console.log(label + ' status=' + response.status + ' error=' + (json.error || 'none'));
  if (response.status < 400 || response.status >= 500) {
    throw new Error(label + ' expected 4xx but got ' + response.status);
  }
}

(async () => {
  await signCase('case_xls_xlsx', 'xls', 'xlsx');
  await signCase('case_xlsx_xls', 'xlsx', 'xls');
  await invalidCase('case_empty', '');
  await invalidCase('case_malformed', '{');
  await invalidCase('case_missing_files', JSON.stringify({ files: [] }));
  await invalidCase('case_invalid_name', JSON.stringify({ files: [{ name: 'bad.csv', contentType: 'text/csv' }] }));
  console.log('ALL_E2E_CHECKS_OK');
})().catch((error) => {
  console.error('E2E_FAIL', error.message || error);
  process.exit(1);
});
