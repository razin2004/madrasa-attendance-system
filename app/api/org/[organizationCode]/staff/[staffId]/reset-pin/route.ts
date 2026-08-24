import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { generateNumericPin, hashPassword } from '@/lib/security';
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
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const staffProfile = await prisma.staffProfile.findFirst({
      where: {
        id: params.staffId,
        organizationId: auth.organization.id,
      },
      include: { user: true },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    // Generate New 6-digit PIN
    const newRawPin = generateNumericPin(6);
    const newPinHash = await hashPassword(newRawPin);

    await prisma.user.update({
      where: { id: staffProfile.userId },
      data: { passwordHash: newPinHash },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_PIN_RESET',
      entityType: 'StaffProfile',
      entityId: staffProfile.id,
      metadata: {
        staffId: staffProfile.staffId,
        staffName: staffProfile.name,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `New PIN generated for ${staffProfile.name}.`,
      staffId: staffProfile.staffId,
      newPin: newRawPin, // Returned ONCE to Org Admin (Section 40)
    });
  } catch (error: any) {
    console.error('Staff PIN reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset staff PIN.' },
      { status: 500 }
    );
  }
}
