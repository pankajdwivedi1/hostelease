import { NextResponse } from "next/server";

export async function GET() {
  const r2WindowsUrl = "https://pub-754ab0d29b3a43b69d79a461c85d3056.r2.dev/downloads/HostelEaze-Setup.exe";
  return NextResponse.redirect(r2WindowsUrl, { status: 302 });
}
