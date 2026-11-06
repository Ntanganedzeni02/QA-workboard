import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { authorized, safeOrigin } from '../../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    const body = await req.json() as HandleUploadBody;
    if (body.type === 'blob.generate-client-token' && (!await authorized() || !safeOrigin(req)))
        return new Response('Unauthorized', { status: 401 });
    try {
        const result = await handleUpload({
            request: req,
            body,
            onBeforeGenerateToken: async (pathname) => {
                if (!/^evidence\/[a-f0-9-]{36}$/.test(pathname))
                    throw new Error('Invalid evidence path');
                return { maximumSizeInBytes: 20 * 1024 * 1024, addRandomSuffix: false, allowOverwrite: false };
            },
        });
        return Response.json(result);
    }
    catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'Evidence upload failed' }, { status: 400 });
    }
}
