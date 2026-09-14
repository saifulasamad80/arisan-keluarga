#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const SHEET_FILES = {
  transactions: 'form-responses-1.csv',
  events: 'Acara_Aktif.csv',
  contributionStatus: 'Status_Iuran.csv',
  deceased: 'Daftar_Almarhum.csv',
  winners: 'Riwayat_Pemenang.csv',
}

const TYPE_MAP = new Map([
  ['kas masuk', 'income'],
  ['pemasukan', 'income'],
  ['income', 'income'],
  ['kas keluar', 'expense'],
  ['pengeluaran', 'expense'],
  ['expense', 'expense'],
])

function usage() {
  console.log(`Penggunaan:
  node scripts/import-legacy-sheets.mjs --dir ./tmp --created-by <profile-uuid>
  node scripts/import-legacy-sheets.mjs --dir ./tmp --created-by <profile-uuid> --period-label "Agustus 2026" --report hasil.json
  SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/import-legacy-sheets.mjs --dir ./tmp --created-by <profile-uuid> --period-label "Agustus 2026" --apply

Default adalah dry-run. --apply wajib memakai SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY
di terminal/server aman. Jangan taruh service role key di frontend, .env.local, atau repository.`)
}

function parseArgs(argv) {
  const options = {
    apply: false,
    createdBy: null,
    dir: './tmp',
    periodLabel: 'Periode ini',
    report: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apply') options.apply = true
    else if (argument === '--created-by') options.createdBy = argv[++index]
    else if (argument === '--dir') options.dir = argv[++index]
    else if (argument === '--period-label') options.periodLabel = argv[++index]
    else if (argument === '--report') options.report = argv[++index]
    else if (argument === '--help' || argument === '-h') options.help = true
    else throw new Error(`Argumen tidak dikenal: ${argument}`)
  }
  return options
}

function normalizeHeader(value) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase()
}

function clean(value) {
  return String(value ?? '').trim()
}

function hasValues(values) {
  return values.some((value) => clean(value) !== '')
}

// Parser CSV RFC 4180 tanpa dependency tambahan.
function parseCsv(content) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]
    const next = content[index + 1]
    if (character === '"' && quoted && next === '"') {
      field += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1
      row.push(field)
      if (hasValues(row)) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    if (hasValues(row)) rows.push(row)
  }
  return rows
}

function readSheet(content, requiredHeaders, sheetName) {
  const csvRows = parseCsv(content)
  if (csvRows.length === 0) return { rows: [], errors: [] }

  const headers = csvRows[0].map(normalizeHeader)
  const indexes = new Map(headers.map((header, index) => [header, index]))
  const missing = requiredHeaders.filter((header) => !indexes.has(normalizeHeader(header)))
  if (missing.length > 0) throw new Error(`Sheet ${sheetName} kekurangan kolom: ${missing.join(', ')}`)

  const get = (values, header) => values[indexes.get(normalizeHeader(header))] ?? ''
  return {
    rows: csvRows.slice(1).map((values, offset) => ({
      values,
      rowNumber: offset + 2,
      get: (header) => get(values, header),
    })),
    errors: [],
  }
}

function parseDate(value) {
  const input = clean(value)
  if (!input) return null
  const dmy = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/)
  if (dmy) {
    const [, day, month, year] = dmy
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const parsed = new Date(`${iso}T00:00:00Z`)
    return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== iso ? null : iso
  }
  const isoMatch = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!isoMatch) return null
  const iso = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== iso ? null : iso
}

function parseTimestamp(value) {
  const input = clean(value)
  const match = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  const [, day, month, year, hour, minute, second = '00'] = match
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}Z`
  const parsed = new Date(iso)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

function parseAmount(value) {
  const input = clean(value).replace(/\s/g, '')
  if (!input) return null
  const numeric = input.replace(/[^\d,.-]/g, '')
  let normalized = numeric
  if (numeric.includes(',') && numeric.includes('.')) normalized = numeric.replace(/\./g, '').replace(',', '.')
  else if (numeric.includes(',')) normalized = numeric.replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(numeric)) normalized = numeric.replace(/\./g, '')
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function parseNonNegativeAmount(value) {
  const input = clean(value)
  if (!input) return null
  const amount = parseAmount(input)
  return amount === null ? null : amount
}

function normalizeName(value) {
  return clean(value).toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function sourceKey(sheet, rowNumber) {
  return `google-sheets:${sheet}:${rowNumber}`
}

function buildTransactions(content, createdBy) {
  const sheet = readSheet(content, ['Timestamp', 'Tipe Transaksi', 'Keterangan Transaksi', 'Nominal (Rp)', 'Tanggal Transaksi', 'Pos Dana'], 'Form Responses 1')
  const valid = []
  const errors = []
  for (const row of sheet.rows) {
    const type = TYPE_MAP.get(clean(row.get('Tipe Transaksi')).toLowerCase())
    const description = clean(row.get('Keterangan Transaksi'))
    const amount = parseAmount(row.get('Nominal (Rp)'))
    const occurredOn = parseDate(row.get('Tanggal Transaksi'))
    const rowErrors = []
    if (!type) rowErrors.push(`Tipe transaksi tidak dikenal: ${clean(row.get('Tipe Transaksi')) || '(kosong)'}`)
    if (description.length < 3) rowErrors.push('Keterangan minimal 3 karakter')
    if (amount === null) rowErrors.push(`Nominal tidak valid: ${clean(row.get('Nominal (Rp)')) || '(kosong)'}`)
    if (!occurredOn) rowErrors.push(`Tanggal tidak valid: ${clean(row.get('Tanggal Transaksi')) || '(kosong)'}`)
    if (rowErrors.length) errors.push({ row: row.rowNumber, messages: rowErrors, values: row.values })
    else valid.push({
      type,
      description,
      amount,
      category: clean(row.get('Pos Dana')) || 'Lainnya',
      occurred_on: occurredOn,
      notes: 'Diimpor dari Google Sheets Form Responses 1',
      created_by: createdBy,
      // Kompatibel dengan importer lama agar 3 transaksi yang sudah ada tidak
      // dibuat ulang ketika seluruh workbook diimpor.
      legacy_source_key: `google-sheets:form-responses-1:${clean(row.get('Timestamp')) || 'no-timestamp'}:${row.rowNumber}`,
      legacy_source_timestamp: parseTimestamp(row.get('Timestamp')),
    })
  }
  return { valid, errors, total: sheet.rows.length }
}

function buildEvents(content, createdBy) {
  const sheet = readSheet(content, ['Tanggal', 'Tuan_Rumah', 'Petugas_Doa', 'Alamat', 'Link_Maps'], 'Acara_Aktif')
  const valid = []
  const errors = []
  for (const row of sheet.rows) {
    const startsOn = parseDate(row.get('Tanggal'))
    const host = clean(row.get('Tuan_Rumah'))
    const prayerLeader = clean(row.get('Petugas_Doa'))
    const location = clean(row.get('Alamat'))
    const rowErrors = []
    if (!startsOn) rowErrors.push(`Tanggal tidak valid: ${clean(row.get('Tanggal')) || '(kosong)'}`)
    if (host.length < 3) rowErrors.push('Tuan rumah minimal 3 karakter')
    if (rowErrors.length) errors.push({ row: row.rowNumber, messages: rowErrors, values: row.values })
    else valid.push({
      title: `Arisan di ${host}`,
      description: prayerLeader ? `Petugas doa: ${prayerLeader}` : null,
      starts_at: `${startsOn}T09:00:00Z`,
      location: location || null,
      map_url: clean(row.get('Link_Maps')) || null,
      created_by: createdBy,
      legacy_source_key: sourceKey('acara-aktif', row.rowNumber),
    })
  }
  return { valid, errors, total: sheet.rows.length }
}

function buildContributionStatus(content, periodLabel) {
  const sheet = readSheet(content, ['Nama_Anggota', 'Tipe_Anggota', 'Status_Periode_Ini', 'Jumlah_Tunggakan', 'No_HP'], 'Status_Iuran')
  const valid = []
  const errors = []
  for (const row of sheet.rows) {
    const memberName = clean(row.get('Nama_Anggota'))
    const memberType = clean(row.get('Tipe_Anggota')) || 'Tidak diketahui'
    const paymentStatus = clean(row.get('Status_Periode_Ini')).toUpperCase() || 'BELUM'
    const arrears = parseNonNegativeAmount(row.get('Jumlah_Tunggakan'))
    const rowErrors = []
    if (!memberName) rowErrors.push('Nama anggota kosong')
    if (clean(row.get('Jumlah_Tunggakan')) && arrears === null) rowErrors.push(`Jumlah tunggakan tidak valid: ${clean(row.get('Jumlah_Tunggakan'))}`)
    if (rowErrors.length) errors.push({ row: row.rowNumber, messages: rowErrors, values: row.values })
    else valid.push({
      legacy_source_key: sourceKey('status-iuran', row.rowNumber),
      source_period_label: periodLabel,
      member_name: memberName,
      member_type: memberType,
      payment_status: paymentStatus,
      arrears,
      phone: clean(row.get('No_HP')) || null,
    })
  }
  return { valid, errors, total: sheet.rows.length }
}

function buildDeceased(content) {
  const sheet = readSheet(content, ['NAMA_ALMARHUM_ALMARHUMAH', 'BIN_BINTI', 'AYAH_KANDUNG'], 'Daftar_Almarhum')
  const valid = []
  const errors = []
  for (const row of sheet.rows) {
    const fullName = clean(row.get('NAMA_ALMARHUM_ALMARHUMAH'))
    const rowErrors = fullName ? [] : ['Nama almarhum/almarhumah kosong']
    if (rowErrors.length) errors.push({ row: row.rowNumber, messages: rowErrors, values: row.values })
    else valid.push({
      legacy_source_key: sourceKey('daftar-almarhum', row.rowNumber),
      full_name: fullName,
      lineage_label: clean(row.get('BIN_BINTI')) || null,
      father_name: clean(row.get('AYAH_KANDUNG')) || null,
    })
  }
  return { valid, errors, total: sheet.rows.length }
}

function buildWinners(content) {
  const sheet = readSheet(content, ['Periode_Bulan_Tahun', 'Nama_Pemenang', 'Keterangan'], 'Riwayat_Pemenang')
  const valid = []
  const errors = []
  for (const row of sheet.rows) {
    const periodLabel = clean(row.get('Periode_Bulan_Tahun'))
    const winnerName = clean(row.get('Nama_Pemenang'))
    const rowErrors = []
    if (!periodLabel) rowErrors.push('Periode pemenang kosong')
    if (!winnerName) rowErrors.push('Nama pemenang kosong')
    if (rowErrors.length) errors.push({ row: row.rowNumber, messages: rowErrors, values: row.values })
    else valid.push({
      legacy_source_key: sourceKey('riwayat-pemenang', row.rowNumber),
      period_label: periodLabel,
      winner_name: winnerName,
      description: clean(row.get('Keterangan')) || null,
    })
  }
  return { valid, errors, total: sheet.rows.length }
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

function emptyResult() {
  return { valid: [], errors: [], total: 0, skipped: true }
}

async function buildImport(dir, createdBy, periodLabel) {
  const contents = await Promise.all(Object.values(SHEET_FILES).map((file) => readOptional(`${dir}/${file}`)))
  const [transactions, events, contributionStatus, deceased, winners] = contents
  return {
    transactions: transactions ? buildTransactions(transactions, createdBy) : emptyResult(),
    events: events ? buildEvents(events, createdBy) : emptyResult(),
    contributionStatus: contributionStatus ? buildContributionStatus(contributionStatus, periodLabel) : emptyResult(),
    deceased: deceased ? buildDeceased(deceased) : emptyResult(),
    winners: winners ? buildWinners(winners) : emptyResult(),
  }
}

function normalizeProfileName(value) {
  return normalizeName(value)
}

async function applyImport(result) {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Mode --apply membutuhkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.')
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

  const { data: profiles, error: profileError } = await client.from('profiles').select('id, full_name')
  if (profileError) throw profileError
  const profilesByName = new Map()
  for (const profile of profiles ?? []) {
    const name = normalizeProfileName(profile.full_name)
    if (!name) continue
    const existing = profilesByName.get(name) ?? []
    existing.push(profile.id)
    profilesByName.set(name, existing)
  }

  const contributionRows = result.contributionStatus.valid.map((row) => {
    const matches = profilesByName.get(normalizeProfileName(row.member_name)) ?? []
    return { ...row, matched_profile_id: matches.length === 1 ? matches[0] : null }
  })

  const applied = {}
  const operations = [
    ['transactions', 'cash_transactions', result.transactions.valid],
    ['events', 'events', result.events.valid],
    ['contributionStatus', 'legacy_contribution_status', contributionRows],
    ['deceased', 'legacy_deceased_people', result.deceased.valid],
    ['winners', 'legacy_arisan_winners', result.winners.valid],
  ]
  for (const [name, table, rows] of operations) {
    if (!rows.length) {
      applied[name] = 0
      continue
    }
    const { data, error } = await client.from(table).upsert(rows, { onConflict: 'legacy_source_key', ignoreDuplicates: false }).select('id')
    if (error) throw new Error(`${table}: ${error.message}`)
    applied[name] = data?.length ?? 0
  }
  return applied
}

function summarize(result, mode, applied = {}) {
  const sheets = {}
  let invalid = 0
  let total = 0
  for (const [name, value] of Object.entries(result)) {
    sheets[name] = { total: value.total, valid: value.valid.length, invalid: value.errors.length, skipped: Boolean(value.skipped), applied: applied[name] ?? 0, errors: value.errors }
    invalid += value.errors.length
    total += value.total
  }
  return { mode, total, invalid, applied: Object.values(applied).reduce((sum, value) => sum + value, 0), sheets }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) return usage()
  if (!options.createdBy) {
    usage()
    throw new Error('--created-by wajib diisi.')
  }

  const result = await buildImport(options.dir, options.createdBy, options.periodLabel)
  const applied = options.apply ? await applyImport(result) : {}
  const summary = summarize(result, options.apply ? 'apply' : 'dry-run', applied)
  if (options.report) await writeFile(options.report, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
  if (summary.invalid > 0) process.exitCode = 2
}

main().catch((error) => {
  console.error(`Gagal: ${error.message}`)
  process.exitCode = 1
})
