import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/session';
import { generateFullDatabaseBackup } from '@/scripts/backup-db';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Super Admin access required.' },
        { status: 401 }
      );
    }

    const backupData = await generateFullDatabaseBackup();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `shiftguard_backup_${dateStr}.json`;

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error downloading database backup:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate database backup.' },
      { status: 500 }
    );
  }
}
