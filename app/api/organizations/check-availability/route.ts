import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeEmail } from '@/lib/security';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^[A-Z0-9]{3,12}$/;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codeParam = searchParams.get('code')?.trim();
    const emailParam = searchParams.get('email')?.trim();

    const responseData: {
      success: boolean;
      code?: { checked: boolean; available: boolean; message: string };
      email?: { checked: boolean; available: boolean; message: string };
    } = { success: true };

    // 1. Check Organization Code Availability
    if (codeParam) {
      const cleanCode = codeParam.toUpperCase();
      if (!CODE_REGEX.test(cleanCode)) {
        responseData.code = {
          checked: true,
          available: false,
          message: 'Code must be 3–12 uppercase letters or numbers.',
        };
      } else {
        const existingOrg = await prisma.organization.findUnique({
          where: { organizationCode: cleanCode },
        });

        if (existingOrg) {
          responseData.code = {
            checked: true,
            available: false,
            message: `Organization code "${cleanCode}" is already taken.`,
          };
        } else {
          responseData.code = {
            checked: true,
            available: true,
            message: `Organization code "${cleanCode}" is available!`,
          };
        }
      }
    }

    // 2. Check Admin / Organization Email Availability
    if (emailParam) {
      if (!EMAIL_REGEX.test(emailParam)) {
        responseData.email = {
          checked: true,
          available: false,
          message: 'Please enter a valid email address.',
        };
      } else {
        const cleanEmail = normalizeEmail(emailParam);

        // Check in User table (admin, super-admin, staff)
        const existingUser = await prisma.user.findFirst({
          where: {
            email: { equals: cleanEmail, mode: 'insensitive' },
          },
        });

        // Check in Organization table (pending or active contact emails)
        const existingOrgEmail = await prisma.organization.findFirst({
          where: {
            contactEmail: { equals: cleanEmail, mode: 'insensitive' },
            status: { in: ['PENDING', 'ACTIVE'] },
          },
        });

        if (existingUser || existingOrgEmail) {
          responseData.email = {
            checked: true,
            available: false,
            message: 'This email is already registered as an admin or organization.',
          };
        } else {
          responseData.email = {
            checked: true,
            available: true,
            message: 'Email address is available!',
          };
        }
      }
    }

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error checking registration availability:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check availability.' },
      { status: 500 }
    );
  }
}
