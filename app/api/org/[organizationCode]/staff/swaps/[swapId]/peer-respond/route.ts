import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';
import { recordAuditLog } from '@/services/audit.service';
import { sendEmail } from '@/services/email.service';
import { templateShiftSwapPeerAccepted } from '@/services/email-templates';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { organizationCode: string; swapId: string } }
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { organizationCode: params.organizationCode.toUpperCase() },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found.' },
        { status: 404 }
      );
    }

    const currentStaff = await prisma.staffProfile.findFirst({
      where: {
        userId: session.user.id,
        organizationId: organization.id,
      },
    });

    if (!currentStaff) {
      return NextResponse.json(
        { success: false, error: 'Staff profile not found.' },
        { status: 404 }
      );
    }

    const swapRequest = await prisma.shiftSwapRequest.findFirst({
      where: {
        id: params.swapId,
        organizationId: organization.id,
      },
      include: {
        requester: { select: { name: true, userId: true } },
        peer: { select: { name: true } },
        recipients: true,
      },
    });

    if (!swapRequest) {
      return NextResponse.json(
        { success: false, error: 'Shift swap request not found.' },
        { status: 404 }
      );
    }

    // Check if current user is either the assigned peer or one of the invited recipients
    const isAssignedPeer = swapRequest.peerId === currentStaff.id;
    const recipientEntry = swapRequest.recipients.find(
      (r) => r.peerId === currentStaff.id
    );

    if (!isAssignedPeer && !recipientEntry) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Unauthorized: You are not an invited colleague for this shift swap request.',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (!action || !['ACCEPT', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid action (ACCEPT or REJECT) is required.' },
        { status: 400 }
      );
    }

    if (action === 'ACCEPT') {
      // Check if swap request is already accepted by someone else
      if (swapRequest.status !== 'PENDING_PEER' || (swapRequest.peerId && swapRequest.peerId !== currentStaff.id)) {
        const acceptingPeerName = swapRequest.peer?.name || 'another colleague';
        return NextResponse.json(
          {
            success: false,
            error: `This shift swap request has already been accepted by ${acceptingPeerName} and is awaiting Org Admin approval.`,
          },
          { status: 409 }
        );
      }

      // Execute atomic transaction: set peerId, status = PEER_ACCEPTED, update recipient statuses
      const updatedSwap = await prisma.$transaction(async (tx) => {
        const updated = await tx.shiftSwapRequest.update({
          where: { id: swapRequest.id },
          data: {
            peerId: currentStaff.id,
            status: 'PEER_ACCEPTED',
            peerRespondedAt: new Date(),
          },
          include: {
            requester: { select: { name: true, staffId: true } },
            peer: { select: { name: true, staffId: true } },
            shiftPattern: { select: { name: true } },
          },
        });

        // Mark current staff recipient record as ACCEPTED
        await tx.shiftSwapRecipient.updateMany({
          where: {
            shiftSwapRequestId: swapRequest.id,
            peerId: currentStaff.id,
          },
          data: {
            status: 'ACCEPTED',
            respondedAt: new Date(),
          },
        });

        // Mark all other invited recipients as EXPIRED
        await tx.shiftSwapRecipient.updateMany({
          where: {
            shiftSwapRequestId: swapRequest.id,
            peerId: { not: currentStaff.id },
          },
          data: {
            status: 'EXPIRED',
          },
        });

        return updated;
      });

      // Audit Log
      const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
      await recordAuditLog({
        organizationId: organization.id,
        actorUserId: session.user.id,
        action: 'SHIFT_SWAP_PEER_ACCEPTED',
        entityType: 'ShiftSwapRequest',
        entityId: updatedSwap.id,
        metadata: {
          peerName: currentStaff.name,
          requesterName: swapRequest.requester.name,
          newStatus: 'PEER_ACCEPTED',
        },
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
      }).catch(() => {});

      // Dispatch Notification Email to Org Admin (Non-blocking)
      setTimeout(async () => {
        try {
          const orgAdmin = await prisma.user.findFirst({
            where: {
              organizationId: organization.id,
              role: 'ORG_ADMIN',
              status: 'ACTIVE',
            },
          });

          if (orgAdmin?.email) {
            const targetDateFormatted = new Date(swapRequest.targetDate).toLocaleDateString(undefined, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const reviewUrl = `https://shiftguard.app/${organization.organizationCode}/admin/shifts/swaps`;

            const payload = templateShiftSwapPeerAccepted({
              orgName: organization.name,
              requesterName: swapRequest.requester.name,
              peerName: currentStaff.name,
              targetDate: targetDateFormatted,
              shiftPatternName: swapRequest.shiftPatternName || 'Branch Shift',
              reviewUrl,
            });

            await sendEmail({
              organizationId: organization.id,
              recipient: orgAdmin.email,
              type: 'SHIFT_SWAP_PEER_ACCEPTED',
              subject: payload.subject,
              htmlContent: payload.html,
              textContent: payload.text,
            }).catch(() => {});
          }
        } catch (emailErr) {
          console.error('Non-blocking peer accept email error:', emailErr);
        }
      }, 0);

      return NextResponse.json({
        success: true,
        message:
          'You successfully accepted the shift swap request! It has been submitted to Org Admin for 1-click final approval.',
        swapRequest: updatedSwap,
      });
    } else {
      // REJECT action
      if (recipientEntry) {
        await prisma.shiftSwapRecipient.update({
          where: { id: recipientEntry.id },
          data: {
            status: 'REJECTED',
            respondedAt: new Date(),
          },
        });
      }

      // Check if all recipients have rejected
      const remainingPending = await prisma.shiftSwapRecipient.count({
        where: {
          shiftSwapRequestId: swapRequest.id,
          status: 'PENDING',
        },
      });

      let updatedSwapStatus = swapRequest.status;
      if (remainingPending === 0 && swapRequest.status === 'PENDING_PEER') {
        updatedSwapStatus = 'PEER_REJECTED';
        await prisma.shiftSwapRequest.update({
          where: { id: swapRequest.id },
          data: { status: 'PEER_REJECTED' },
        });
      }

      // Audit Log
      const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
      await recordAuditLog({
        organizationId: organization.id,
        actorUserId: session.user.id,
        action: 'SHIFT_SWAP_PEER_REJECTED',
        entityType: 'ShiftSwapRequest',
        entityId: swapRequest.id,
        metadata: {
          peerName: currentStaff.name,
          requesterName: swapRequest.requester.name,
          newStatus: updatedSwapStatus,
        },
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: 'You declined the shift swap request.',
      });
    }
  } catch (error: any) {
    console.error('Peer respond to swap error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process swap response.' },
      { status: 500 }
    );
  }
}
