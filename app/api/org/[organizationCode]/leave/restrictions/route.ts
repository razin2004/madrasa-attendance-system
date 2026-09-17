import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrganizationLeaveRestrictionRules } from '@/services/leave.service';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const orgCode = params.organizationCode?.toUpperCase();
    const org = await prisma.organization.findFirst({
      where: { organizationCode: orgCode },
      select: { id: true, name: true },
    });

    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organization not found.' },
        { status: 404 }
      );
    }

    const rules = await getOrganizationLeaveRestrictionRules(org.id);

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error: any) {
    console.error('Error fetching leave restriction rules:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch leave restriction rules.' },
      { status: 500 }
    );
  }
}
