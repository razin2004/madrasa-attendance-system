import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';

export const dynamic = 'force-dynamic';

// GET: Fetch all organization shift swap requests for Org Admin
export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const whereCondition: any = {
      organizationId: auth.organization.id,
    };

    if (status && status !== 'ALL') {
      whereCondition.status = status;
    }

    const swapRequests = await prisma.shiftSwapRequest.findMany({
      where: whereCondition,
      include: {
        requester: {
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
        },
        peer: {
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
        },
        shiftPattern: { select: { id: true, name: true } },
        recipients: {
          include: {
            peer: { select: { id: true, name: true, staffId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingAdminCount = await prisma.shiftSwapRequest.count({
      where: {
        organizationId: auth.organization.id,
        status: 'PEER_ACCEPTED',
      },
    });

    return NextResponse.json({
      success: true,
      pendingAdminCount,
      swapRequests,
    });
  } catch (error: any) {
    console.error('Fetch admin shift swaps error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve shift swap requests.' },
      { status: 500 }
    );
  }
}
