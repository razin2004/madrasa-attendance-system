import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import { LeaveRequestStatus, LeaveType } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { organization } = auth;
    const { searchParams } = req.nextUrl;

    const statusFilter = searchParams.get('status') as LeaveRequestStatus | null;
    const typeFilter = searchParams.get('type') as LeaveType | null;
    const staffIdFilter = searchParams.get('staffId');
    const search = searchParams.get('search')?.trim().toLowerCase();

    const where: any = {
      organizationId: organization.id,
    };

    if (statusFilter) {
      where.status = statusFilter;
    }

    if (typeFilter) {
      where.type = typeFilter;
    }

    if (staffIdFilter) {
      where.staffProfileId = staffIdFilter;
    }

    if (search) {
      where.staffProfile = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { staffId: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [requests, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          staffProfile: {
            include: {
              branchAssignments: { include: { branch: true } },
            },
          },
          reviewerUser: { select: { id: true, name: true, email: true } },
          enteredByAdmin: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leaveRequest.count({
        where: { organizationId: organization.id, status: 'PENDING' },
      }),
      prisma.leaveRequest.count({
        where: { organizationId: organization.id, status: 'APPROVED' },
      }),
      prisma.leaveRequest.count({
        where: { organizationId: organization.id, status: 'REJECTED' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      requests,
      metrics: {
        pendingCount,
        approvedCount,
        rejectedCount,
        totalCount: requests.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin leaves:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
