import { NextRequest, NextResponse } from 'next/server';
import { generateComplianceReport, generateReportHTML } from '@/lib/reports/compliance-report';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const reportData = await generateComplianceReport();

    if (format === 'html') {
      const html = generateReportHTML(reportData);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': 'attachment; filename="compliance-report.html"',
        },
      });
    }

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating compliance report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
