import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

// GET: Fetch shift swap requests for logged-in staff member
export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string } }
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

    // Find StaffProfile for current user
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

    // Fetch outgoing (as requester) and incoming (as peer) swap requests
    const [outgoingRequests, incomingRequests, colleagues] = await Promise.all([
      prisma.shiftSwapRequest.findMany({
        where: {
          organizationId: organization.id,
          requesterId: currentStaff.id,
        },
        include: {
          peer: {
            select: {
              id: true,
              staffId: true,
              name: true,
              phone: true,
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shiftSwapRequest.findMany({
        where: {
          organizationId: organization.id,
          peerId: currentStaff.id,
        },
        include: {
          requester: {
            select: {
              id: true,
              staffId: true,
              name: true,
              phone: true,
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Also fetch list of colleagues in the same organization for initiating new swap requests
      prisma.staffProfile.findMany({
        where: {
          organizationId: organization.id,
          id: { not: currentStaff.id },
          user: { status: 'ACTIVE' },
        },
        select: {
          id: true,
          staffId: true,
          name: true,
          phone: true,
          user: { select: { email: true } },
          branchAssignments: {
            include: { branch: { select: { name: true } } },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      currentStaff: {
        id: currentStaff.id,
        name: currentStaff.name,
        staffId: currentStaff.staffId,
      },
      outgoingRequests,
      incomingRequests,
      colleagues,
    });
  } catch (error: any) {
    console.error('Fetch staff swaps error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve shift swap requests.' },
      { status: 500 }
    );
  }
}

// POST: Initiate a new shift swap request
export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string } }
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

    const body = await request.json().catch(() => ({}));
    const { peerStaffId, targetDate, reason } = body;

    if (!peerStaffId) {
      return NextResponse.json(
        { success: false, error: 'Colleague selection is required.' },
        { status: 400 }
      );
    }

    if (!targetDate) {
      return NextResponse.json(
        { success: false, error: 'Shift target date is required.' },
        { status: 400 }
      );
    }

    if (peerStaffId === currentStaff.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot request a shift swap with yourself.' },
        { status: 400 }
      );
    }

    // Verify peer staff profile exists in same organization
    const peerStaff = await prisma.staffProfile.findFirst({
      where: {
        id: peerStaffId,
        organizationId: organization.id,
      },
    });

    if (!peerStaff) {
      return NextResponse.json(
        { success: false, error: 'Selected colleague not found in organization.' },
        { status: 404 }
      );
    }

    const parsedDate = new Date(targetDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid shift date provided.' },
        { status: 400 }
      );
    }

    // Create ShiftSwapRequest
    const swapRequest = await prisma.shiftSwapRequest.create({
      data: {
        organizationId: organization.id,
        requesterId: currentStaff.id,
        peerId: peerStaff.id,
        targetDate: parsedDate,
        reason: reason ? reason.trim() : null,
        status: 'PENDING_PEER',
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
      action: 'SHIFT_SWAP_REQUESTED',
      entityType: 'ShiftSwapRequest',
      entityId: swapRequest.id,
      metadata: {
        requesterName: currentStaff.name,
        peerName: peerStaff.name,
        targetDate: parsedDate.toISOString(),
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Shift swap request sent to ${peerStaff.name}. Awaiting peer acceptance.`,
      swapRequest,
    });
  } catch (error: any) {
    console.error('Create shift swap request error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create shift swap request.' },
      { status: 500 }
    );
  }
}
