import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { isValidCoordinate } from '@/lib/geolocation';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string; branchId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: params.branchId,
        organizationId: auth.organization.id,
      },
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found or access denied.' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, locationAccuracyMeters } = body;

    const numLat = parseFloat(latitude);
    const numLng = parseFloat(longitude);

    if (isNaN(numLat) || isNaN(numLng) || !isValidCoordinate(numLat, numLng)) {
      return NextResponse.json(
        { success: false, error: 'Valid GPS latitude and longitude coordinates are required.' },
        { status: 400 }
      );
    }

    const actorName = auth.session.user.name || auth.session.user.email;
    const oldLat = branch.latitude;
    const oldLng = branch.longitude;

    const updatedBranch = await prisma.branch.update({
      where: { id: branch.id },
      data: {
        latitude: numLat,
        longitude: numLng,
        locationAccuracyMeters: locationAccuracyMeters ? parseFloat(locationAccuracyMeters) : null,
        locationCapturedAt: new Date(),
        locationCapturedBy: actorName,
      },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'BRANCH_LOCATION_RECAPTURED',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: {
        branchName: branch.name,
        oldCoordinates: { latitude: oldLat, longitude: oldLng },
        newCoordinates: { latitude: numLat, longitude: numLng },
        locationAccuracyMeters: locationAccuracyMeters ? parseFloat(locationAccuracyMeters) : null,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Branch location re-captured successfully.`,
      branch: updatedBranch,
    });
  } catch (error: any) {
    console.error('Recapture location error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to re-capture branch location.' },
      { status: 500 }
    );
  }
}
