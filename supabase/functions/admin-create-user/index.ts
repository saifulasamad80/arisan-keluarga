import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Konfigurasi server belum lengkap.' }, 500)
  }

  const token = authorization.replace(/^Bearer\s+/i, '')
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Sesi admin tidak valid.' }, 401)

  const { data: adminProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || adminProfile?.role !== 'admin' || !adminProfile.is_active) {
    return json({ error: 'Hanya admin web yang boleh mendaftarkan pengurus.' }, 403)
  }

  let payload: { fullName?: unknown; email?: unknown; password?: unknown; role?: unknown }
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Data pendaftaran tidak valid.' }, 400)
  }

  const fullName = typeof payload.fullName === 'string' ? payload.fullName.trim() : ''
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  const role = payload.role === 'admin' || payload.role === 'treasurer' ? payload.role : ''

  if (fullName.length < 2 || !email || password.length < 6 || !role) {
    return json({ error: 'Nama, email, password, dan peran wajib diisi dengan benar.' }, 400)
  }

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { created_by_admin_web: true },
  })

  if (createError || !createdUser.user) {
    return json({ error: createError?.message ?? 'Akun tidak dapat dibuat.' }, 400)
  }

  const { data: namedProfile, error: nameError } = await adminClient
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', createdUser.user.id)
    .select('id')
    .maybeSingle()

  if (nameError || !namedProfile) {
    await adminClient.auth.admin.deleteUser(createdUser.user.id)
    return json({ error: 'Akun dibuat tetapi nama profil gagal disimpan.' }, 500)
  }

  const { error: updateError } = await userClient.rpc('assign_manager_role', {
    p_user_id: createdUser.user.id,
    p_role: role,
  })

  if (updateError) {
    await adminClient.auth.admin.deleteUser(createdUser.user.id)
    return json({ error: 'Akun dibuat tetapi profil gagal disiapkan.' }, 500)
  }

  return json({ success: true, userId: createdUser.user.id })
})