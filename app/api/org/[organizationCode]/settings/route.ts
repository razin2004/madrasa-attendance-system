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
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { organization } = auth;

    return NextResponse.json({
      success: true,
      settings: {
        id: organization.id,
        name: organization.name,
        organizationCode: organization.organizationCode,
        phone: organization.phone || '',
        contactPersonName: organization.contactPersonName || '',
        contactEmail: organization.contactEmail || '',
        logoUrl: organization.logoUrl || '',
        attendanceCorrectionWindowDays: organization.attendanceCorrectionWindowDays || 5,
        createdAt: organization.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await req.json();

    const {
      name,
      phone,
      contactPersonName,
      contactEmail,
      logoUrl,
      attendanceCorrectionWindowDays,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Organization name is required.' },
        { status: 400 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        contactPersonName: contactPersonName ? contactPersonName.trim() : null,
        contactEmail: contactEmail ? contactEmail.trim() : null,
        logoUrl: logoUrl !== undefined ? logoUrl : organization.logoUrl,
        attendanceCorrectionWindowDays:
          typeof attendanceCorrectionWindowDays === 'number'
            ? Math.max(1, Math.min(30, attendanceCorrectionWindowDays))
            : organization.attendanceCorrectionWindowDays,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Organization settings updated successfully.',
      settings: updated,
    });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update settings.' },
      { status: 500 }
    );
  }
}
