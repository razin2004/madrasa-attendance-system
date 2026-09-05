import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';
import { recordAuditLog } from '@/services/audit.service';

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
      },
    });

    if (!swapRequest) {
      return NextResponse.json(
        { success: false, error: 'Shift swap request not found.' },
        { status: 404 }
      );
    }

    // Verify current user is the peer assigned to respond
    if (swapRequest.peerId !== currentStaff.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only the assigned peer colleague can respond to this swap request.' },
        { status: 403 }
      );
    }

    if (swapRequest.status !== 'PENDING_PEER') {
      return NextResponse.json(
        { success: false, error: `Swap request is already in status: ${swapRequest.status}.` },
        { status: 400 }
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

    const newStatus = action === 'ACCEPT' ? 'PEER_ACCEPTED' : 'PEER_REJECTED';

    const updatedSwap = await prisma.shiftSwapRequest.update({
      where: { id: swapRequest.id },
      data: {
        status: newStatus,
        peerRespondedAt: new Date(),
      },
      include: {
        requester: { select: { name: true, staffId: true } },
        peer: { select: { name: true, staffId: true } },
      },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: organization.id,
      actorUserId: session.user.id,
      action: action === 'ACCEPT' ? 'SHIFT_SWAP_PEER_ACCEPTED' : 'SHIFT_SWAP_PEER_REJECTED',
      entityType: 'ShiftSwapRequest',
      entityId: updatedSwap.id,
      metadata: {
        peerName: currentStaff.name,
        requesterName: swapRequest.requester.name,
        newStatus,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message:
        action === 'ACCEPT'
          ? 'You accepted the shift swap request! It is now sent to Org Admin for final approval.'
          : 'You declined the shift swap request.',
      swapRequest: updatedSwap,
    });
  } catch (error: any) {
    console.error('Peer respond to swap error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process swap response.' },
      { status: 500 }
    );
  }
}
