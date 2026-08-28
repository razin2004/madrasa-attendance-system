import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import { validateImageFile, saveLogoFile } from '@/lib/storage';

export async function POST(
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
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No image file provided for upload.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate Image
    const validation = validateImageFile(buffer, file.name, file.type);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid logo image file.' },
        { status: 400 }
      );
    }

    // Save file to disk storage (/public/uploads/logos/...)
    const logoUrl = await saveLogoFile(buffer, file.name);

    // Update Organization logoUrl in DB
    await prisma.organization.update({
      where: { id: organization.id },
      data: { logoUrl },
    });

    return NextResponse.json({
      success: true,
      message: 'Organization logo uploaded and updated successfully.',
      logoUrl,
    });
  } catch (error: any) {
    console.error('Error uploading organization logo:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload logo.' },
      { status: 500 }
    );
  }
}
