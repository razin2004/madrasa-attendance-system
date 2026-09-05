import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Authorize Super Admin Session
    const session = await getCurrentSession();
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Super Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    // 2. Fetch Counts for Badges & Summary Stats
    const [pendingCount, activeCount, rejectedCount, suspendedCount, totalBranches, totalStaff] = await Promise.all([
      prisma.organization.count({ where: { status: 'PENDING' } }),
      prisma.organization.count({ where: { status: 'ACTIVE' } }),
      prisma.organization.count({ where: { status: 'REJECTED' } }),
      prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      prisma.branch.count(),
      prisma.staffProfile.count(),
    ]);

    // 3. Fetch Organizations based on filter
    const whereClause: any = {};
    if (statusParam && ['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'].includes(statusParam.toUpperCase())) {
      whereClause.status = statusParam.toUpperCase();
    }

    const organizations = await prisma.organization.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            branches: true,
            staffProfiles: true,
            users: true,
            attendanceRecords: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
          },
        },
      },
    });

    // 4. Fetch Governance Audit History
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'ORGANIZATION_REGISTERED',
            'ORGANIZATION_APPROVED',
            'ORGANIZATION_REJECTED',
            'ORGANIZATION_DEACTIVATED',
            'ORGANIZATION_ACTIVATED',
            'ORGANIZATION_DELETED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        organization: {
          select: {
            name: true,
            organizationCode: true,
          },
        },
        actorUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      counts: {
        pending: pendingCount,
        approved: activeCount,
        rejected: rejectedCount,
        suspended: suspendedCount,
        totalBranches,
        totalStaff,
      },
      organizations,
      auditLogs,
    });
  } catch (error: any) {
    console.error('Fetch organizations API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve organizations.' },
      { status: 500 }
    );
  }
}
