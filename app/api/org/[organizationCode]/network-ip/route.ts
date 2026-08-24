import { NextResponse } from 'next/server';
import { extractClientPublicIp } from '@/lib/ip-detection';
import { requireOrgAdmin } from '@/lib/tenant-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const detectedIp = extractClientPublicIp(request);

    return NextResponse.json({
      success: true,
      detectedIp,
    });
  } catch (error: any) {
    console.error('Network IP detection error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to detect network IP.' },
      { status: 500 }
    );
  }
}
