import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/session';
import { restoreFullDatabaseBackup } from '@/scripts/restore-db';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Super Admin access required.' },
        { status: 401 }
      );
    }

    const backupData = await req.json();
    if (!backupData || !backupData.tables) {
      return NextResponse.json(
        { success: false, error: 'Invalid database backup JSON format.' },
        { status: 400 }
      );
    }

    await restoreFullDatabaseBackup(backupData);

    return NextResponse.json({
      success: true,
      message: 'Full database restore executed successfully.',
      summary: backupData.metadata?.summary || {},
    });
  } catch (error: any) {
    console.error('Error executing database restore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to restore database.' },
      { status: 500 }
    );
  }
}
