import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/api/public/tmpkey')({
  server: { handlers: { GET: async () => new Response(JSON.stringify({ url: process.env['CLINIC_SUPABASE_URL'], key: process.env['CLINIC_SUPABASE_PUBLISHABLE_KEY'] })) } },
})
