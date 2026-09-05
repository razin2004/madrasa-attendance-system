import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';
import { recordAuditLog } from '@/services/audit.service';
import { sendEmail } from '@/services/email.service';
import { templateShiftSwapRequested } from '@/services/email-templates';

export const dynamic = 'force-dynamic';

// GET: Fetch shift swap requests, active shifts, and colleagues for logged-in staff member
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

    // Fetch outgoing, incoming swap requests, active shift patterns, and colleagues
    const [outgoingRequests, incomingRequests, shiftPatterns, colleagues] = await Promise.all([
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
          shiftPattern: { select: { id: true, name: true } },
          recipients: {
            include: {
              peer: {
                select: {
                  id: true,
                  staffId: true,
                  name: true,
                  user: { select: { email: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shiftSwapRequest.findMany({
        where: {
          organizationId: organization.id,
          OR: [
            { peerId: currentStaff.id },
            { recipients: { some: { peerId: currentStaff.id } } },
          ],
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
          peer: {
            select: {
              id: true,
              staffId: true,
              name: true,
              phone: true,
              user: { select: { email: true } },
            },
          },
          shiftPattern: { select: { id: true, name: true } },
          recipients: {
            include: {
              peer: {
                select: {
                  id: true,
                  staffId: true,
                  name: true,
                  user: { select: { email: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shiftPattern.findMany({
        where: {
          organizationId: organization.id,
          isActive: true,
        },
        include: {
          weeklyDays: true,
        },
        orderBy: { name: 'asc' },
      }),
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
          shiftAssignments: {
            include: {
              shiftPattern: { select: { id: true, name: true } },
            },
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
      shiftPatterns,
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

// POST: Initiate a new shift swap request (supports single or multi-peer broadcast)
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
    const { peerStaffId, peerStaffIds, shiftPatternId, shiftPatternName, targetDate, reason } = body;

    // Build raw list of target peer IDs
    let rawPeerIds: string[] = [];
    if (Array.isArray(peerStaffIds) && peerStaffIds.length > 0) {
      rawPeerIds = peerStaffIds;
    } else if (typeof peerStaffId === 'string' && peerStaffId.trim()) {
      rawPeerIds = [peerStaffId.trim()];
    }

    // Filter out duplicate IDs and self
    const validPeerIds = Array.from(new Set(rawPeerIds)).filter(
      (id) => id && id !== currentStaff.id
    );

    if (validPeerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one colleague for the shift swap.' },
        { status: 400 }
      );
    }

    if (!targetDate) {
      return NextResponse.json(
        { success: false, error: 'Shift target date is required.' },
        { status: 400 }
      );
    }

    const parsedDate = new Date(targetDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid shift date provided.' },
        { status: 400 }
      );
    }

    // Verify selected peer staff profiles exist in same organization
    const peerStaffs = await prisma.staffProfile.findMany({
      where: {
        id: { in: validPeerIds },
        organizationId: organization.id,
      },
      select: { id: true, name: true, staffId: true },
    });

    if (peerStaffs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'None of the selected colleagues were found in your organization.' },
        { status: 404 }
      );
    }

    // Create ShiftSwapRequest with recipients
    const primaryPeer = peerStaffs.length === 1 ? peerStaffs[0] : null;

    const swapRequest = await prisma.shiftSwapRequest.create({
      data: {
        organizationId: organization.id,
        requesterId: currentStaff.id,
        peerId: primaryPeer ? primaryPeer.id : null,
        shiftPatternId: shiftPatternId || null,
        shiftPatternName: shiftPatternName || null,
        targetDate: parsedDate,
        reason: reason ? reason.trim() : null,
        status: 'PENDING_PEER',
        recipients: {
          create: peerStaffs.map((p) => ({
            peerId: p.id,
            status: 'PENDING',
          })),
        },
      },
      include: {
        requester: { select: { name: true, staffId: true } },
        peer: { select: { name: true, staffId: true } },
        recipients: {
          include: {
            peer: { select: { name: true, staffId: true } },
          },
        },
      },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const peerNamesStr = peerStaffs.map((p) => p.name).join(', ');
    await recordAuditLog({
      organizationId: organization.id,
      actorUserId: session.user.id,
      action: 'SHIFT_SWAP_REQUESTED',
      entityType: 'ShiftSwapRequest',
      entityId: swapRequest.id,
      metadata: {
        requesterName: currentStaff.name,
        peerNames: peerNamesStr,
        invitedCount: peerStaffs.length,
        targetDate: parsedDate.toISOString(),
        shiftPatternName,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});

    // Dispatch Email Notifications to Invited Peers (Non-blocking)
    setTimeout(async () => {
      try {
        const fullPeers = await prisma.staffProfile.findMany({
          where: { id: { in: validPeerIds } },
          select: { name: true, user: { select: { email: true } } },
        });

        const targetDateFormatted = parsedDate.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        const swapUrl = `https://shiftguard.app/${organization.organizationCode}/staff/swaps`;

        for (const p of fullPeers) {
          if (p.user?.email) {
            const emailPayload = templateShiftSwapRequested({
              orgName: organization.name,
              requesterName: currentStaff.name,
              targetDate: targetDateFormatted,
              shiftPatternName: shiftPatternName || 'Branch Shift',
              reason,
              swapUrl,
            });

            await sendEmail({
              organizationId: organization.id,
              recipient: p.user.email,
              type: 'SHIFT_SWAP_REQUESTED',
              subject: emailPayload.subject,
              htmlContent: emailPayload.html,
              textContent: emailPayload.text,
            }).catch(() => {});
          }
        }
      } catch (emailErr) {
        console.error('Non-blocking shift swap email error:', emailErr);
      }
    }, 0);

    return NextResponse.json({
      success: true,
      message:
        peerStaffs.length === 1
          ? `Shift swap request sent to ${peerStaffs[0].name}. Awaiting peer acceptance.`
          : `Shift swap request sent to ${peerStaffs.length} colleagues (${peerNamesStr}). First colleague to accept will secure the shift swap.`,
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
