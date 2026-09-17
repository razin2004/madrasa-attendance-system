import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import { normalizeDate } from '@/services/leave.service';

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { organization, session } = auth;
    const body = await req.json();

    const { title, ruleType, startDate, endDate, leaveType, description } = body;

    if (!title?.trim() || !ruleType || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Title, rule type, start date, and end date are required.' },
        { status: 400 }
      );
    }

    const normStart = normalizeDate(startDate);
    const normEnd = normalizeDate(endDate);

    if (normStart > normEnd) {
      return NextResponse.json(
        { success: false, error: 'Start date cannot be after end date.' },
        { status: 400 }
      );
    }

    const rule = await prisma.leaveRestrictionRule.create({
      data: {
        organizationId: organization.id,
        title: title.trim(),
        ruleType: ruleType === 'BLACKOUT_PERIOD' ? 'BLACKOUT_PERIOD' : 'ALLOWED_WINDOW',
        startDate: normStart,
        endDate: normEnd,
        leaveType: leaveType || 'ALL',
        description: description?.trim() || null,
        createdById: session.user.id,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${ruleType === 'BLACKOUT_PERIOD' ? 'Blackout Period' : 'Allowed Leave Window'} rule created successfully.`,
      rule,
    });
  } catch (error: any) {
    console.error('Error creating leave restriction rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create leave restriction rule.' },
      { status: 500 }
    );
  }
}
