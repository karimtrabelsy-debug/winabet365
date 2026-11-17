const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export default async () => {
  const apiKey = process.env.MOVIODDS_API_KEY;
  if (!apiKey) return json({ configured: false, matches: [], error: 'MOVIODDS_API_KEY is not configured' });

  try {
    const upstream = await fetch('https://moviodds.com/odds?sport=soccer', {
      headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
    });
    if (!upstream.ok) return json({ configured: true, matches: [], error: `Odds provider returned ${upstream.status}` }, 502);
    const data = await upstream.json();
    const matches = Array.isArray(data.matches) ? data.matches : [];

    // Optional persistence in Supabase. The public site still works if persistence is not configured.
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
    if (supabaseUrl && supabaseSecret && matches.length) {
      const rows = matches.map((match, i) => ({
        match_id: String(match.id ?? match.match_id ?? `${match.home ?? 'home'}-${match.away ?? 'away'}-${i}`),
        payload: match,
        updated_at: new Date().toISOString()
      }));
      const save = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/odds_matches?on_conflict=match_id`, {
        method: 'POST',
        headers: {
          'apikey': supabaseSecret,
          'Authorization': `Bearer ${supabaseSecret}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(rows)
      });
      if (!save.ok) console.error('Supabase save failed:', save.status, await save.text());
    }

    return json({ configured: true, matches, fetchedAt: new Date().toISOString(), pollSeconds: 60 });
  } catch (error) {
    console.error(error);
    return json({ configured: true, matches: [], error: 'Could not retrieve odds at this time' }, 502);
  }
};
