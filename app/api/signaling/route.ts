import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "WebRTC Signaling Server Status Check",
  })
}
