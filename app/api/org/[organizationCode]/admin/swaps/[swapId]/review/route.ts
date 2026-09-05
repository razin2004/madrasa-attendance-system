import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { organizationCode: string; swapId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const adminUserId = auth.session.user.id;

    const swapRequest = await prisma.shiftSwapRequest.findFirst({
      where: {
        id: params.swapId,
        organizationId: auth.organization.id,
      },
      include: {
        requester: { select: { id: true, name: true, staffId: true } },
        peer: { select: { id: true, name: true, staffId: true } },
      },
    });

    if (!swapRequest) {
      return NextResponse.json(
        { success: false, error: 'Shift swap request not found.' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action, adminNote } = body;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid action (APPROVE or REJECT) is required.' },
        { status: 400 }
      );
    }

    const normalizedDate = new Date(swapRequest.targetDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const result = await prisma.$transaction(async (tx) => {
      const finalStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

      const updatedSwap = await tx.shiftSwapRequest.update({
        where: { id: swapRequest.id },
        data: {
          status: finalStatus,
          adminReviewedBy: adminUserId,
          adminReviewedAt: new Date(),
          adminNote: adminNote ? adminNote.trim() : null,
        },
        include: {
          requester: { select: { id: true, name: true, staffId: true } },
          peer: { select: { id: true, name: true, staffId: true } },
        },
      });

      // If approved, create shift overrides to swap shift assignments on the target date
      if (action === 'APPROVE') {
        // Upsert shift override for Requester
        await tx.staffShiftOverride.upsert({
          where: {
            staffProfileId_date: {
              staffProfileId: swapRequest.requesterId,
              date: normalizedDate,
            },
          },
          update: {
            reason: `Shift swapped with ${swapRequest.peer.name} (${swapRequest.peer.staffId})`,
            createdBy: adminUserId,
          },
          create: {
            staffProfileId: swapRequest.requesterId,
            date: normalizedDate,
            reason: `Shift swapped with ${swapRequest.peer.name} (${swapRequest.peer.staffId})`,
            createdBy: adminUserId,
          },
        });

        // Upsert shift override for Peer
        await tx.staffShiftOverride.upsert({
          where: {
            staffProfileId_date: {
              staffProfileId: swapRequest.peerId,
              date: normalizedDate,
            },
          },
          update: {
            reason: `Covering shift for ${swapRequest.requester.name} (${swapRequest.requester.staffId})`,
            createdBy: adminUserId,
          },
          create: {
            staffProfileId: swapRequest.peerId,
            date: normalizedDate,
            reason: `Covering shift for ${swapRequest.requester.name} (${swapRequest.requester.staffId})`,
            createdBy: adminUserId,
          },
        });
      }

      return updatedSwap;
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: adminUserId,
      action: action === 'APPROVE' ? 'SHIFT_SWAP_APPROVED' : 'SHIFT_SWAP_REJECTED',
      entityType: 'ShiftSwapRequest',
      entityId: result.id,
      metadata: {
        requesterName: swapRequest.requester.name,
        peerName: swapRequest.peer.name,
        targetDate: normalizedDate.toISOString(),
        adminNote: adminNote || null,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message:
        action === 'APPROVE'
          ? `Shift swap request approved successfully. Shift overrides registered for ${swapRequest.requester.name} and ${swapRequest.peer.name}.`
          : 'Shift swap request rejected.',
      swapRequest: result,
    });
  } catch (error: any) {
    console.error('Org Admin review shift swap error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process shift swap review.' },
      { status: 500 }
    );
  }
}
