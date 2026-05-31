import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Delete sessions older than 4 days (1-day buffer after R2 3-day deletion)
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('sessions')
      .delete()
      .lt('created_at', fourDaysAgo.toISOString())
      .select('id')

    if (error) {
      console.error('[cleanup] deletion failed:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const deletedCount = data?.length || 0
    console.info('[cleanup] deleted sessions:', deletedCount)

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deletedCount,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[cleanup] unexpected error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
