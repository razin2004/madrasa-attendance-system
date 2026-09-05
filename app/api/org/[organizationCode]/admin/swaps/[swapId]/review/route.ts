import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';
import { sendEmail } from '@/services/email.service';
import { templateShiftSwapReviewed } from '@/services/email-templates';

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

    if (action === 'APPROVE' && (!swapRequest.peerId || !swapRequest.peer)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot approve a shift swap request that has not been accepted by a colleague.',
        },
        { status: 400 }
      );
    }

    const peerProfile = swapRequest.peer;
    const peerId = swapRequest.peerId;

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
      if (action === 'APPROVE' && peerId && peerProfile) {
        // Upsert shift override for Requester
        await tx.staffShiftOverride.upsert({
          where: {
            staffProfileId_date: {
              staffProfileId: swapRequest.requesterId,
              date: normalizedDate,
            },
          },
          update: {
            reason: `Shift swapped with ${peerProfile.name} (${peerProfile.staffId})`,
            createdBy: adminUserId,
          },
          create: {
            staffProfileId: swapRequest.requesterId,
            date: normalizedDate,
            reason: `Shift swapped with ${peerProfile.name} (${peerProfile.staffId})`,
            createdBy: adminUserId,
          },
        });

        // Upsert shift override for Peer
        await tx.staffShiftOverride.upsert({
          where: {
            staffProfileId_date: {
              staffProfileId: peerId,
              date: normalizedDate,
            },
          },
          update: {
            reason: `Covering shift for ${swapRequest.requester.name} (${swapRequest.requester.staffId})`,
            createdBy: adminUserId,
          },
          create: {
            staffProfileId: peerId,
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
        peerName: peerProfile ? peerProfile.name : 'Unknown',
        targetDate: normalizedDate.toISOString(),
        adminNote: adminNote || null,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});

    // Dispatch Notification Emails to Requester & Peer (Non-blocking)
    setTimeout(async () => {
      try {
        const fullRequester = await prisma.staffProfile.findUnique({
          where: { id: swapRequest.requesterId },
          select: { name: true, user: { select: { email: true } } },
        });

        const fullPeer = peerId
          ? await prisma.staffProfile.findUnique({
              where: { id: peerId },
              select: { name: true, user: { select: { email: true } } },
            })
          : null;

        const targetDateFormatted = normalizedDate.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        const loginUrl = `https://shiftguard.app/${auth.organization?.organizationCode}/staff/swaps`;
        const finalStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

        // 1. Notify Requester
        if (fullRequester?.user?.email) {
          const reqPayload = templateShiftSwapReviewed({
            orgName: auth.organization!.name,
            staffName: fullRequester.name,
            otherPartyName: fullPeer ? fullPeer.name : 'Substitute Peer',
            status: finalStatus,
            targetDate: targetDateFormatted,
            shiftPatternName: swapRequest.shiftPatternName || 'Branch Shift',
            adminNote,
            loginUrl,
          });

          await sendEmail({
            organizationId: auth.organization!.id,
            recipient: fullRequester.user.email,
            type: 'SHIFT_SWAP_REVIEWED',
            subject: reqPayload.subject,
            htmlContent: reqPayload.html,
            textContent: reqPayload.text,
          }).catch(() => {});
        }

        // 2. Notify Peer
        if (fullPeer?.user?.email) {
          const peerPayload = templateShiftSwapReviewed({
            orgName: auth.organization!.name,
            staffName: fullPeer.name,
            otherPartyName: fullRequester ? fullRequester.name : 'Original Shift Holder',
            status: finalStatus,
            targetDate: targetDateFormatted,
            shiftPatternName: swapRequest.shiftPatternName || 'Branch Shift',
            adminNote,
            loginUrl,
          });

          await sendEmail({
            organizationId: auth.organization!.id,
            recipient: fullPeer.user.email,
            type: 'SHIFT_SWAP_REVIEWED',
            subject: peerPayload.subject,
            htmlContent: peerPayload.html,
            textContent: peerPayload.text,
          }).catch(() => {});
        }
      } catch (emailErr) {
        console.error('Non-blocking admin swap review email error:', emailErr);
      }
    }, 0);

    return NextResponse.json({
      success: true,
      message:
        action === 'APPROVE' && peerProfile
          ? `Shift swap request approved successfully. Shift overrides registered for ${swapRequest.requester.name} and ${peerProfile.name}.`
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
