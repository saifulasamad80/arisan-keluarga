#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const REQUIRED_HEADERS = [
  'Timestamp',
  'Tipe Transaksi',
  'Keterangan Transaksi',
  'Nominal (Rp)',
  'Tanggal Transaksi',
  'Pos Dana',
]

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
  node scripts/import-legacy-transactions.mjs --file transaksi.csv --created-by <profile-uuid>
  node scripts/import-legacy-transactions.mjs --file transaksi.csv --created-by <profile-uuid> --report hasil.json
  node scripts/import-legacy-transactions.mjs --file transaksi.csv --created-by <profile-uuid> --apply

Mode default adalah dry-run. --apply membutuhkan SUPABASE_URL dan
SUPABASE_SERVICE_ROLE_KEY di environment server; jangan gunakan service role key
di frontend atau commit ke repository.`)
}

function parseArgs(argv) {
  const options = { apply: false, report: null, file: null, createdBy: null }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apply') options.apply = true
    else if (argument === '--file') options.file = argv[++index]
    else if (argument === '--created-by') options.createdBy = argv[++index]
    else if (argument === '--report') options.report = argv[++index]
    else if (argument === '--help' || argument === '-h') options.help = true
    else throw new Error(`Argumen tidak dikenal: ${argument}`)
  }
  return options
}

function normalizeHeader(value) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase()
}

// Parser kecil untuk CSV RFC 4180 agar impor dapat dijalankan tanpa dependency tambahan.
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
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((value) => value.trim() !== '')) rows.push(row)
  }
  return rows
}

function parseIndonesianDate(value) {
  const input = value.trim()
  const match = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/)
  if (!match) return null
  const [, day, month, year] = match
  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date ? null : date
}

function parseTimestamp(value) {
  const input = value.trim()
  const match = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  const [, day, month, year, hour, minute, second = '00'] = match
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}Z`
  const parsed = new Date(iso)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

function parseAmount(value) {
  const input = value.trim().replace(/\s/g, '')
  if (!input) return null
  const numeric = input.replace(/[^\d,.-]/g, '')
  let normalized = numeric
  if (numeric.includes(',') && numeric.includes('.')) {
    normalized = numeric.replace(/\./g, '').replace(',', '.')
  } else if (numeric.includes(',')) {
    normalized = numeric.replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(numeric)) {
    normalized = numeric.replace(/\./g, '')
  }
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function stableSourceKey(row, rowNumber) {
  const timestamp = row.timestamp || 'no-timestamp'
  return `google-sheets:form-responses-1:${timestamp}:${rowNumber}`
}

function buildRows(content, createdBy) {
  const csvRows = parseCsv(content)
  if (csvRows.length === 0) throw new Error('CSV kosong.')

  const headers = csvRows[0].map(normalizeHeader)
  const indexes = new Map(headers.map((header, index) => [header, index]))
  const missing = REQUIRED_HEADERS.filter((header) => !indexes.has(normalizeHeader(header)))
  if (missing.length > 0) throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`)

  const get = (values, header) => values[indexes.get(normalizeHeader(header))] ?? ''
  const valid = []
  const errors = []

  csvRows.slice(1).forEach((values, offset) => {
    const rowNumber = offset + 2
    const rawType = get(values, 'Tipe Transaksi')
    const rawDescription = get(values, 'Keterangan Transaksi').trim()
    const rawAmount = get(values, 'Nominal (Rp)')
    const rawDate = get(values, 'Tanggal Transaksi')
    const type = TYPE_MAP.get(rawType.trim().toLowerCase())
    const occurredOn = parseIndonesianDate(rawDate)
    const amount = parseAmount(rawAmount)
    const rowErrors = []

    if (!type) rowErrors.push(`Tipe transaksi tidak dikenal: ${rawType || '(kosong)'}`)
    if (rawDescription.length < 3) rowErrors.push('Keterangan minimal 3 karakter')
    if (amount === null) rowErrors.push(`Nominal tidak valid: ${rawAmount || '(kosong)'}`)
    if (!occurredOn) rowErrors.push(`Tanggal tidak valid: ${rawDate || '(kosong)'}`)

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, messages: rowErrors, values })
      return
    }

    valid.push({
      type,
      description: rawDescription,
      amount,
      category: get(values, 'Pos Dana').trim() || 'Lainnya',
      occurred_on: occurredOn,
      notes: 'Diimpor dari Google Sheets Form Responses 1',
      created_by: createdBy,
      legacy_source_key: stableSourceKey({ timestamp: get(values, 'Timestamp').trim() }, rowNumber),
      legacy_source_timestamp: parseTimestamp(get(values, 'Timestamp')),
    })
  })

  return { valid, errors, total: csvRows.length - 1 }
}

async function applyRows(rows) {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Mode --apply membutuhkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.')
  }
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  const { data, error } = await client
    .from('cash_transactions')
    .upsert(rows, { onConflict: 'legacy_source_key', ignoreDuplicates: true })
    .select('id, legacy_source_key')
  if (error) throw error
  return data ?? []
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) return usage()
  if (!options.file || !options.createdBy) {
    usage()
    throw new Error('--file dan --created-by wajib diisi.')
  }

  const content = await readFile(options.file, 'utf8')
  const result = buildRows(content, options.createdBy)
  const summary = {
    mode: options.apply ? 'apply' : 'dry-run',
    total: result.total,
    valid: result.valid.length,
    invalid: result.errors.length,
    applied: 0,
    errors: result.errors,
  }

  if (options.apply && result.valid.length > 0) {
    summary.applied = (await applyRows(result.valid)).length
  }
  if (options.report) await writeFile(options.report, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
  if (result.errors.length > 0) process.exitCode = 2
}

main().catch((error) => {
  console.error(`Gagal: ${error.message}`)
  process.exitCode = 1
})