export function GET() {
  return Response.json({ status: "ok", fredKey: !!process.env.FRED_API_KEY?.trim(), secIdentity: !!process.env.SEC_USER_AGENT?.trim() });
}
