import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string; staffId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const staffProfile = await prisma.staffProfile.findFirst({
      where: {
        id: params.staffId,
        organizationId: auth.organization.id,
      },
      include: {
        devices: true,
      },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Multiple device registration is disabled. Staff accounts are strictly limited to a single registered device. Use "Reset Device" if the staff member changed their device.',
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Authorize additional device error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to authorize additional device slot.' },
      { status: 500 }
    );
  }
}
