/**
 * Creates one-time Supabase Storage upload tokens.
 *
 * Files are deliberately uploaded by the browser straight to Storage instead
 * of passing through Vercel. Vercel rejects request bodies above its platform
 * limit before a route handler runs, which made the old multipart endpoint
 * unsuitable for real seller exports.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizeUploadFiles, parseJsonBody } from '@/lib/validation/uploadRequest';

export const runtime = 'nodejs';

const BUCKET = 'upload-staging';

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Request body could not be read.' }, { status: 400 });
  }

  let payload: { files?: unknown };
  try {
    payload = parseJsonBody<{ files?: unknown }>(rawBody, 'Request body');
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  try {
    const files = normalizeUploadFiles(payload.files);
    if (files.length !== 2) {
      return NextResponse.json({ error: 'Exactly two spreadsheet files are required.' }, { status: 400 });
    }

    const uploads = await Promise.all(files.map(async (file) => {
      const name = file.name;
      const suffix = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
      const path = `${crypto.randomUUID()}/${suffix}`;
      const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw new Error(error?.message ?? 'Could not prepare the upload.');

      return { path, token: data.token };
    }));

    return NextResponse.json({ bucket: BUCKET, uploads });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare the upload.' },
      { status: 500 },
    );
  }
}
