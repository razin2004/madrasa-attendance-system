import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized access.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10);

    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const records = await prisma.attendanceRecord.findMany({
      where: {
        organizationId: auth.organization.id,
        timestamp: { gte: startOfDay, lte: endOfDay },
        verificationStatus: 'VERIFIED',
      },
      include: {
        staffProfile: {
          select: {
            id: true,
            staffId: true,
            name: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    const formattedRecords = records.map((r) => ({
      id: r.id,
      staffId: r.staffProfile.staffId,
      staffName: r.staffProfile.name,
      branchName: r.branch?.name || 'Unassigned',
      type: r.type,
      source: r.source,
      timestamp: r.timestamp.toISOString(),
      timeFormatted: r.timestamp.toISOString().slice(11, 16),
      ipMatched: r.ipMatched,
      geofenceMatched: r.geofenceMatched,
      deviceMatched: r.deviceMatched,
      isManualEntry: r.isManualEntry,
      manualReason: r.manualReason,
    }));

    return NextResponse.json({
      success: true,
      count: formattedRecords.length,
      records: formattedRecords,
    });
  } catch (error: any) {
    console.error('Error fetching live attendance feed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch live feed.' },
      { status: 500 }
    );
  }
}
