import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const code = params.organizationCode?.toUpperCase().trim();

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Organization code is required.' },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.findFirst({
      where: {
        organizationCode: { equals: code, mode: 'insensitive' },
      },
      select: {
        id: true,
        organizationCode: true,
        name: true,
        logoUrl: true,
        status: true,
        rejectionReason: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: `Organization with code "${code}" was not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      organization,
    });
  } catch (error: any) {
    console.error('Fetch tenant branding error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load organization branding.' },
      { status: 500 }
    );
  }
}
