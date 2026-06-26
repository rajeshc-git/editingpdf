export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ status: 'ok', service: 'web', version: '1.0.0' })
}
