import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { extractClientPublicIp } from '@/lib/ip-detection';
import { isValidCoordinate } from '@/lib/geolocation';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

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

    const branches = await prisma.branch.findMany({
      where: {
        organizationId: auth.organization.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        networkIdentities: {
          where: { isActive: true },
        },
      },
    });

    const activeCount = branches.filter((b) => b.status === 'ACTIVE').length;
    const inactiveCount = branches.filter((b) => b.status === 'INACTIVE').length;

    return NextResponse.json({
      success: true,
      branches,
      counts: {
        total: branches.length,
        active: activeCount,
        inactive: inactiveCount,
      },
    });
  } catch (error: any) {
    console.error('List branches error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve branches.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { name, address, latitude, longitude, locationAccuracyMeters, geofenceRadiusMeters } = body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Branch name is required (minimum 2 characters).' },
        { status: 400 }
      );
    }

    if (!address || typeof address !== 'string' || address.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Physical branch address is required.' },
        { status: 400 }
      );
    }

    const numLat = parseFloat(latitude);
    const numLng = parseFloat(longitude);

    if (isNaN(numLat) || isNaN(numLng) || !isValidCoordinate(numLat, numLng)) {
      return NextResponse.json(
        { success: false, error: 'Valid GPS latitude and longitude coordinates are required.' },
        { status: 400 }
      );
    }

    const radius = geofenceRadiusMeters ? parseInt(geofenceRadiusMeters, 10) : 150;
    if (isNaN(radius) || radius < 20 || radius > 5000) {
      return NextResponse.json(
        { success: false, error: 'Geofence radius must be between 20 and 5000 meters.' },
        { status: 400 }
      );
    }

    // 2. Authoritative Server-side Public IP Capture (Section 8)
    const detectedPublicIp = extractClientPublicIp(request);
    const actorName = auth.session.user.name || auth.session.user.email;

    // 3. Create Branch with Network Identity
    const branch = await prisma.branch.create({
      data: {
        organizationId: auth.organization.id,
        name: name.trim(),
        address: address.trim(),
        latitude: numLat,
        longitude: numLng,
        locationAccuracyMeters: locationAccuracyMeters ? parseFloat(locationAccuracyMeters) : null,
        geofenceRadiusMeters: radius,
        publicIp: detectedPublicIp,
        ipSource: 'CAPTURED',
        ipCapturedAt: new Date(),
        ipCapturedBy: actorName,
        locationCapturedAt: new Date(),
        locationCapturedBy: actorName,
        status: 'ACTIVE',
        networkIdentities: {
          create: {
            publicIp: detectedPublicIp,
            source: 'CAPTURED',
            capturedBy: actorName,
            isActive: true,
          },
        },
      },
    });

    // 4. Record Audit Log
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'BRANCH_CREATED',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: {
        branchName: branch.name,
        address: branch.address,
        publicIp: detectedPublicIp,
        latitude: numLat,
        longitude: numLng,
        geofenceRadiusMeters: radius,
      },
      ipAddress: detectedPublicIp,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Branch "${branch.name}" registered successfully.`,
      branch,
    });
  } catch (error: any) {
    console.error('Create branch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create branch. Please verify input data.' },
      { status: 500 }
    );
  }
}
