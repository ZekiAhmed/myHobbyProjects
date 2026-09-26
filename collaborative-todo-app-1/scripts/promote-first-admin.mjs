/**
 * @fileoverview One-time bootstrap for the first platform Administrator
 * (subscription-billing issue 01).
 *
 * The first Administrator is promoted by direct database write — this
 * script — because nobody has the role yet to grant it in-app. Every
 * later role change goes through the in-app promote/demote actions at
 * /admin. It refuses to run once an Administrator exists, so the
 * bootstrap stays one-time only.
 *
 * Usage: node scripts/promote-first-admin.mjs <user-email>
 */

import 'dotenv/config'
import pg from 'pg'

const [, , email] = process.argv

if (!email) {
  console.error('Usage: node scripts/promote-first-admin.mjs <user-email>')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — cannot connect.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

async function main() {
  await client.connect()
  try {
    const admins = await client.query(
      `SELECT count(*)::int AS count FROM "User" WHERE role = 'ADMINISTRATOR'`
    )
    if (admins.rows[0].count > 0) {
      console.error(
        'An Administrator already exists — this bootstrap is one-time only. ' +
          'Promote users in-app from /admin instead.'
      )
      process.exitCode = 1
      return
    }

    const found = await client.query(
      `SELECT id, email FROM "User" WHERE email = $1`,
      [email]
    )
    if (found.rowCount === 0) {
      console.error(`No user with email "${email}" exists.`)
      process.exitCode = 1
      return
    }

    const updated = await client.query(
      `UPDATE "User" SET role = 'ADMINISTRATOR' WHERE id = $1 AND role = 'REGULAR'`,
      [found.rows[0].id]
    )
    if (updated.rowCount !== 1) {
      console.error('Promotion did not apply — no rows updated.')
      process.exitCode = 1
      return
    }

    console.log(`Promoted ${email} (${found.rows[0].id}) to Administrator.`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
