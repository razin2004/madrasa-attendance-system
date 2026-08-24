import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import { extractClientPublicIp } from '@/lib/ip-detection';
import { recordAttendance } from '@/services/attendance.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.staffProfile || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, locationAccuracy, deviceLabel } = body;
    const deviceSecret =
      body.deviceSecret ||
      request.headers.get('x-shiftguard-device-secret') ||
      null;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'GPS location coordinates are required for attendance verification.',
        },
        { status: 400 }
      );
    }

    const requestIp = extractClientPublicIp(request);
    const userAgent = request.headers.get('user-agent');

    const result = await recordAttendance({
      organizationId: auth.organization.id,
      staffProfileId: auth.staffProfile.id,
      userId: auth.session.user.id,
      type: 'CLOCK_OUT',
      requestIp,
      rawDeviceSecret: deviceSecret,
      coordinates: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: locationAccuracy ? parseFloat(locationAccuracy) : undefined,
      },
      deviceLabel,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Clock Out verification failed.',
          evaluation: result.evaluation,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Clock Out verified successfully at ${result.record?.branch?.name || 'Branch'}.`,
      record: result.record,
      evaluation: result.evaluation,
    });
  } catch (error: any) {
    console.error('Clock out error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred during Clock Out.' },
      { status: 500 }
    );
  }
}
