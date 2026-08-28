import { NextRequest, NextResponse } from 'next/server';
import { runMidnightAbsenceCron } from '@/services/cron-absence.service';

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const providedSecret =
      req.headers.get('x-cron-secret') ||
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      searchParams.get('secret');

    const expectedSecret = process.env.CRON_SECRET || 'shiftguard-cron-secret-2026';

    // Verify secret for unauthorized cron invocations
    if (providedSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized cron access. Invalid CRON_SECRET.' },
        { status: 401 }
      );
    }

    const dateParam = searchParams.get('date') || undefined;

    const result = await runMidnightAbsenceCron(dateParam);

    return NextResponse.json({
      success: true,
      message: `Absence cron execution completed for date ${result.targetDate}.`,
      result,
    });
  } catch (error: any) {
    console.error('Error running midnight absence cron:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error during absence cron execution.' },
      { status: 500 }
    );
  }
}
