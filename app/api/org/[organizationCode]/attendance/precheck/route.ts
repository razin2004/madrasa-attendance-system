import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import { extractClientPublicIp } from '@/lib/ip-detection';
import {
  evaluateThreeLayerAttendance,
  getStaffTodayAttendanceStatus,
} from '@/services/attendance.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handlePrecheck(
  request: Request,
  params: { organizationCode: string }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.staffProfile) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | undefined = undefined;
    let deviceSecret: string | null = null;

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (body.latitude !== undefined && body.longitude !== undefined) {
        lat = parseFloat(body.latitude);
        lng = parseFloat(body.longitude);
        if (body.accuracy !== undefined) accuracy = parseFloat(body.accuracy);
      }
      if (body.deviceSecret) deviceSecret = body.deviceSecret;
    }

    const { searchParams } = new URL(request.url);
    if (lat === null && searchParams.get('lat')) lat = parseFloat(searchParams.get('lat')!);
    if (lng === null && searchParams.get('lng')) lng = parseFloat(searchParams.get('lng')!);
    if (accuracy === undefined && searchParams.get('accuracy')) accuracy = parseFloat(searchParams.get('accuracy')!);
    if (!deviceSecret) {
      deviceSecret =
        request.headers.get('x-shiftguard-device-secret') ||
        searchParams.get('deviceSecret') ||
        null;
    }

    const coordinates =
      lat !== null && lng !== null
        ? { latitude: lat, longitude: lng, accuracy }
        : null;

    const requestIp = extractClientPublicIp(request);

    // Run Informational 3-Layer Pre-Check
    const evaluation = await evaluateThreeLayerAttendance(
      auth.staffProfile.id,
      auth.organization.id,
      requestIp,
      deviceSecret,
      coordinates
    );

    // Get today's attendance state
    const todayStatus = await getStaffTodayAttendanceStatus(auth.staffProfile.id);

    return NextResponse.json(
      {
        success: true,
        precheck: evaluation,
        evaluation,
        todayStatus,
        staffProfile: auth.staffProfile,
        organization: auth.organization,
        staff: {
          staffId: auth.staffProfile.staffId,
          name: auth.staffProfile.name,
          deviceStatus: evaluation.layer1Device.isVerified
            ? 'REGISTERED'
            : (auth.staffProfile as any).devices?.some((d: any) => d.status === 'NOT_REGISTERED') || (auth.staffProfile as any).devices?.length === 0
            ? 'NOT_REGISTERED'
            : (auth.staffProfile as any).devices?.some((d: any) => d.status === 'RESET_REQUIRED')
            ? 'RESET_REQUIRED'
            : 'REGISTERED',
          hasPendingDeviceSlot: (auth.staffProfile as any).devices?.some((d: any) => d.status === 'NOT_REGISTERED') || false,
          isDeviceVerified: evaluation.layer1Device.isVerified,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Attendance precheck error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to perform attendance pre-check.' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  return handlePrecheck(request, params);
}

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  return handlePrecheck(request, params);
}
