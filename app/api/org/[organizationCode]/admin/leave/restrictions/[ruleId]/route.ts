import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { organizationCode: string; ruleId: string } }
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

    const rule = await prisma.leaveRestrictionRule.findUnique({
      where: { id: params.ruleId },
    });

    if (!rule || rule.organizationId !== organization.id) {
      return NextResponse.json(
        { success: false, error: 'Rule not found.' },
        { status: 404 }
      );
    }

    await prisma.leaveRestrictionRule.delete({
      where: { id: params.ruleId },
    });

    return NextResponse.json({
      success: true,
      message: 'Leave restriction rule removed successfully.',
    });
  } catch (error: any) {
    console.error('Error deleting leave restriction rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove rule.' },
      { status: 500 }
    );
  }
}
