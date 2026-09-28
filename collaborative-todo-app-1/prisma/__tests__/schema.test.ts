import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Contract test for the post-MVP schema (TRD §12).
 *
 * The schema file is this ticket's deliverable: later tickets build Comment,
 * Activity, and Notification features on these models. Expected values are
 * taken verbatim from the design record (docs/TRD.md §12, ADR-0001, ADR-0002),
 * not from the implementation.
 */

const schema = readFileSync(path.join(__dirname, '..', 'schema.prisma'), 'utf8')

function block(kind: 'model' | 'enum', name: string): string[] {
  const match = schema.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))
  if (!match) throw new Error(`${kind} ${name} not found in prisma/schema.prisma`)
  return match[1]
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim().replace(/\s+/g, ' '))
    .filter((line) => line.length > 0)
}

function fieldNames(lines: string[]): string[] {
  return lines
    .filter((line) => !line.startsWith('@@'))
    .map((line) => line.split(/\s+/)[0])
}

function lineStarting(lines: string[], prefix: string): string {
  const found = lines.find((line) => line.startsWith(prefix + ' ') || line === prefix)
  if (!found) throw new Error(`no line starting with "${prefix}" in block`)
  return found
}

/** Whitespace-insensitive view of a block, for index/attribute assertions. */
function squashed(lines: string[]): string {
  return lines.join('\n').replace(/\s+/g, '')
}

type RelationExpectation = {
  fields?: string
  relationName?: string
  onDelete?: string
}

function expectRelation(lines: string[], field: string, expected: RelationExpectation): void {
  const line = lineStarting(lines, field)
  if (expected.fields) expect(line).toContain(`fields: [${expected.fields}]`)
  if (expected.relationName) expect(line).toContain(`"${expected.relationName}"`)
  if (expected.onDelete) expect(line).toContain(`onDelete: ${expected.onDelete}`)
}

describe('post-mvp schema (TRD §12)', () => {
  describe('Comment', () => {
    const comment = block('model', 'Comment')

    it('has exactly the designed fields — no soft-delete/tombstone column (ADR-0001)', () => {
      expect(fieldNames(comment)).toEqual([
        'id',
        'body',
        'todoId',
        'authorId',
        'createdAt',
        'updatedAt',
        'todo',
        'author',
      ])
    })

    it('stores the body as plain long-form text with timestamps', () => {
      expect(lineStarting(comment, 'body')).toMatch(/^body\s+String\s+@db\.Text$/)
      expect(lineStarting(comment, 'createdAt')).toMatch(/^createdAt\s+DateTime\s+@default\(now\(\)\)$/)
      expect(lineStarting(comment, 'updatedAt')).toMatch(/^updatedAt\s+DateTime\s+@updatedAt$/)
    })

    it('cascades delete to todo and author', () => {
      expectRelation(comment, 'todo', { fields: 'todoId', onDelete: 'Cascade' })
      expectRelation(comment, 'author', { fields: 'authorId', onDelete: 'Cascade' })
    })

    it('indexes both foreign keys', () => {
      expect(squashed(comment)).toContain('@@index([todoId])')
      expect(squashed(comment)).toContain('@@index([authorId])')
    })
  })

  describe('Activity', () => {
    const activity = block('model', 'Activity')

    it('has exactly the designed compliance-ready columns', () => {
      expect(fieldNames(activity)).toEqual([
        'id',
        'boardId',
        'actorId',
        'action',
        'resourceType',
        'resourceId',
        'ipAddress',
        'createdAt',
        'board',
        'actor',
      ])
    })

    it('keeps action and resourceType as free strings, not enums (ADR-0002)', () => {
      expect(lineStarting(activity, 'action')).toMatch(/^action\s+String$/)
      expect(lineStarting(activity, 'resourceType')).toMatch(/^resourceType\s+String$/)
    })

    it('keeps the actor optional with SetNull so entries outlive account deletion', () => {
      expect(lineStarting(activity, 'actorId')).toMatch(/^actorId\s+String\?$/)
      expectRelation(activity, 'actor', { relationName: 'ActivityActor', onDelete: 'SetNull' })
      expect(lineStarting(activity, 'ipAddress')).toMatch(/^ipAddress\s+String\?$/)
    })

    it('cascades delete to the board', () => {
      expectRelation(activity, 'board', { fields: 'boardId', onDelete: 'Cascade' })
    })

    it('indexes board+time (newest-first feed) and actor', () => {
      expect(squashed(activity)).toContain('@@index([boardId,createdAt(sort:Desc)])')
      expect(squashed(activity)).toContain('@@index([actorId])')
    })
  })

  describe('Notification', () => {
    const notification = block('model', 'Notification')

    it('has exactly the designed fields', () => {
      expect(fieldNames(notification)).toEqual([
        'id',
        'userId',
        'actorId',
        'type',
        'boardId',
        'todoId',
        'readAt',
        'createdAt',
        'user',
        'actor',
        'board',
        'todo',
      ])
    })

    it('cascades delete with recipient, board, and todo; actor is SetNull', () => {
      expectRelation(notification, 'user', { fields: 'userId', onDelete: 'Cascade' })
      expectRelation(notification, 'board', { fields: 'boardId', onDelete: 'Cascade' })
      expectRelation(notification, 'todo', { fields: 'todoId', onDelete: 'Cascade' })
      expectRelation(notification, 'actor', { relationName: 'NotificationActor', onDelete: 'SetNull' })
    })

    it('leaves readAt nullable — null means unread', () => {
      expect(lineStarting(notification, 'readAt')).toMatch(/^readAt\s+DateTime\?$/)
    })

    it('indexes unread lookups and recency per user, plus the todo', () => {
      expect(squashed(notification)).toContain('@@index([userId,readAt])')
      expect(squashed(notification)).toContain('@@index([userId,createdAt(sort:Desc)])')
      expect(squashed(notification)).toContain('@@index([todoId])')
    })
  })

  describe('NotificationType enum', () => {
    it('is limited to assignment and comment events', () => {
      const values = block('enum', 'NotificationType')
      expect(values).toEqual(['ASSIGNED', 'COMMENTED'])
    })
  })

  describe('back-relations', () => {
    it('User carries authored comments, acted activity, and both notification roles', () => {
      const user = block('model', 'User')
      expect(user).toContain('authoredComments Comment[]')
      expect(user).toContain('activities Activity[] @relation("ActivityActor")')
      expect(user).toContain('notifications Notification[] @relation("NotificationRecipient")')
      expect(user).toContain('actedNotifications Notification[] @relation("NotificationActor")')
    })

    it('Board carries activity and notifications', () => {
      const board = block('model', 'Board')
      expect(board).toContain('activity Activity[]')
      expect(board).toContain('notifications Notification[]')
    })

    it('Todo carries comments and notifications', () => {
      const todo = block('model', 'Todo')
      expect(todo).toContain('comments Comment[]')
      expect(todo).toContain('notifications Notification[]')
    })
  })
})

/**
 * Platform Administrator role (subscription-billing issue 01).
 *
 * The platform role is deliberately distinct from the board Owner role —
 * CONTEXT.md bans "admin" for board roles, so the enum vocabulary is
 * "regular" vs "Administrator" and lives only on the user model.
 */
describe('platform Administrator role (subscription-billing 01)', () => {
  describe('User model', () => {
    const user = block('model', 'User')

    it('carries a role field typed by the UserRole enum', () => {
      expect(user).toContain('role UserRole @default(REGULAR)')
    })
  })

  describe('UserRole enum', () => {
    it('is exactly regular + administrator, defaulting conceptually to regular', () => {
      expect(block('enum', 'UserRole')).toEqual(['REGULAR', 'ADMINISTRATOR'])
    })
  })
})

/**
 * Pricing & bank-details settings (subscription-billing issue 02).
 *
 * A single admin-editable record is the source of truth the upgrade
 * screen reads (spec §Money: price, currency, account holder, account
 * number, bank name, transfer instructions; seed = 100 ETB + placeholder
 * bank fields). The 6–15 digit account-number rule is a form/action
 * validation, not a column constraint — the column stays a plain string.
 */
describe('pricing & bank-details settings (subscription-billing 02)', () => {
  describe('PricingSettings model', () => {
    const settings = block('model', 'PricingSettings')

    it('has exactly the designed fields — no extras', () => {
      expect(fieldNames(settings)).toEqual([
        'id',
        'price',
        'currency',
        'accountHolder',
        'accountNumber',
        'bankName',
        'transferInstructions',
        'createdAt',
        'updatedAt',
      ])
    })

    it('is a singleton row keyed by a constant id', () => {
      expect(lineStarting(settings, 'id')).toBe('id String @id @default("singleton")')
    })

    it('keeps price an integer amount and account number a plain string (digit validation is app-level)', () => {
      expect(lineStarting(settings, 'price')).toMatch(/^price Int$/)
      expect(lineStarting(settings, 'currency')).toMatch(/^currency String$/)
      expect(lineStarting(settings, 'accountNumber')).toMatch(/^accountNumber String$/)
      expect(lineStarting(settings, 'bankName')).toMatch(/^bankName String$/)
    })

    it('stores transfer instructions as long-form text with timestamps', () => {
      expect(lineStarting(settings, 'transferInstructions')).toMatch(
        /^transferInstructions String @db\.Text$/
      )
      expect(lineStarting(settings, 'createdAt')).toMatch(/^createdAt DateTime @default\(now\(\)\)$/)
      expect(lineStarting(settings, 'updatedAt')).toMatch(/^updatedAt DateTime @updatedAt$/)
    })
  })

  describe('migrations', () => {
    const tableMigration = readFileSync(
      path.join(__dirname, '..', 'migrations', '20260927220823_pricing_settings', 'migration.sql'),
      'utf8'
    )
    const seedMigration = readFileSync(
      path.join(
        __dirname,
        '..',
        'migrations',
        '20260928000000_seed_pricing_settings',
        'migration.sql'
      ),
      'utf8'
    )

    it('creates the PricingSettings table', () => {
      expect(tableMigration).toContain('CREATE TABLE "PricingSettings"')
    })

    it('seeds 100 ETB with placeholder bank fields owned by the migration (spec §Money)', () => {
      const insert = seedMigration.match(/INSERT INTO "PricingSettings"[\s\S]*?;/)
      expect(insert).not.toBeNull()
      const values = insert![0]
      // the singleton row with the spec's seed price and currency
      expect(values).toMatch(/'singleton',\s*100,\s*'ETB'/)
      // placeholders exist for every bank field, and the seeded account
      // number obeys the 6–15 digit rule the save action enforces
      expect(values).toMatch(/'Placeholder Account Holder'/)
      expect(values).toMatch(/'\d{6,15}'/)
      expect(values).toMatch(/'Placeholder Bank'/)
      expect(values).toMatch(/'Transfer the exact amount/)
    })
  })
})

/**
 * Payment submission lifecycle (subscription-billing issues 04 + 05).
 *
 * The record a Subscribe click creates: a unique payment reference for
 * memo matching, a price/currency snapshot (spec §Money — a later price
 * edit never invalidates an in-flight payment), and a 48-hour TTL
 * carried in `expiresAt`. Issue 05 adds the receipt columns the upload
 * route writes (bytes in PostgreSQL, spec §Receipt storage); issue 07
 * adds the decision columns the approve/reject actions write. The "at
 * most one non-terminal submission per user" rule is enforced inside
 * the subscribe transaction (spec §Payment lifecycle), not by a column.
 */
describe('payment submission (subscription-billing 04 + 05)', () => {
  describe('PaymentSubmission model', () => {
    const submission = block('model', 'PaymentSubmission')

    it('has exactly the designed fields', () => {
      expect(fieldNames(submission)).toEqual([
        'id',
        'userId',
        'reference',
        'status',
        'priceSnapshot',
        'currencySnapshot',
        'expiresAt',
        'receiptBytes',
        'receiptMimeType',
        'decidedAt',
        'decidedById',
        'rejectionReason',
        'createdAt',
        'updatedAt',
        'user',
        'decidedBy',
      ])
    })

    it('carries a unique payment reference so a transfer memo can be matched', () => {
      expect(lineStarting(submission, 'reference')).toBe('reference String @unique')
    })

    it('starts life in AWAITING_UPLOAD — the state a Subscribe click creates', () => {
      expect(lineStarting(submission, 'status')).toBe(
        'status PaymentStatus @default(AWAITING_UPLOAD)'
      )
    })

    it('snapshots price and currency at creation (spec §Money)', () => {
      expect(lineStarting(submission, 'priceSnapshot')).toMatch(/^priceSnapshot Int$/)
      expect(lineStarting(submission, 'currencySnapshot')).toMatch(/^currencySnapshot String$/)
    })

    it('carries the 48-hour TTL in expiresAt with no default — code sets it at creation', () => {
      expect(lineStarting(submission, 'expiresAt')).toMatch(/^expiresAt DateTime$/)
    })

    it('stores receipt bytes as an optional binary column (spec §Receipt storage — bytes in PostgreSQL)', () => {
      expect(lineStarting(submission, 'receiptBytes')).toBe('receiptBytes Bytes?')
    })

    it('remembers how the receipt sniffed so the admin viewer can render it', () => {
      expect(lineStarting(submission, 'receiptMimeType')).toBe('receiptMimeType String?')
    })

    it('belongs to the subscribing user and dies with the account', () => {
      expectRelation(submission, 'user', { fields: 'userId', onDelete: 'Cascade' })
    })

    it('indexes the per-user status lookup the subscribe transaction runs', () => {
      expect(squashed(submission)).toContain('@@index([userId,status])')
    })
  })

  describe('PaymentStatus enum', () => {
    it('is exactly the two-stage lifecycle from the spec (§Payment lifecycle)', () => {
      expect(block('enum', 'PaymentStatus')).toEqual([
        'AWAITING_UPLOAD',
        'PENDING',
        'APPROVED',
        'REJECTED',
        'EXPIRED',
      ])
    })
  })

  describe('User back-relation', () => {
    it('User carries their payment submissions', () => {
      expect(block('model', 'User')).toContain('submissions PaymentSubmission[]')
    })
  })

  describe('migrations', () => {
    const migration = readFileSync(
      path.join(__dirname, '..', 'migrations', '20260928120000_payment_submission', 'migration.sql'),
      'utf8'
    )

    it('creates the PaymentSubmission table', () => {
      expect(migration).toContain('CREATE TABLE "PaymentSubmission"')
    })

    it('enforces reference uniqueness with a database index, not just app code', () => {
      expect(migration).toMatch(
        /CREATE UNIQUE INDEX "PaymentSubmission_reference_key" ON "PaymentSubmission"\("reference"\)/
      )
    })
  })

  describe('receipt columns migration (issue 05)', () => {
    const migration = readFileSync(
      path.join(__dirname, '..', 'migrations', '20260928130000_receipt_bytes', 'migration.sql'),
      'utf8'
    )

    it('adds the receipt byte and mime-type columns to the existing table', () => {
      expect(migration).toMatch(/ADD COLUMN\s+"receiptBytes" BYTEA/)
      expect(migration).toMatch(/ADD COLUMN\s+"receiptMimeType" TEXT/)
    })

    it('is additive — the existing table and data are untouched', () => {
      expect(migration).not.toContain('DROP')
      expect(migration).not.toContain('ALTER TABLE "PaymentSubmission" ALTER COLUMN')
    })
  })
})

/**
 * Payment decisions & the subscription clock (subscription-billing 07).
 *
 * Approve writes the subscriber's period end (spec §Money & subscription
 * period — max(now, current end) + 1 calendar month, stacked); reject
 * stores the mandatory reason (spec §Payment lifecycle, story 41). Both
 * decisions record when and who, because the retention rule keeps this
 * metadata forever (story 50) while only the receipt bytes are pruned
 * (issue 12). Every column is nullable: an undecided row carries none
 * of them, and EXPIRED rows never will.
 */
describe('payment decisions & subscription period (subscription-billing 07)', () => {
  describe('PaymentSubmission decision columns', () => {
    const submission = block('model', 'PaymentSubmission')

    it('leaves every decision column nullable — an undecided row writes none of them', () => {
      expect(lineStarting(submission, 'decidedAt')).toBe('decidedAt DateTime?')
      expect(lineStarting(submission, 'decidedById')).toBe('decidedById String?')
      expect(lineStarting(submission, 'rejectionReason')).toBe('rejectionReason String?')
    })

    it('keeps the reviewer as a SetNull relation so the audit row outlives the account', () => {
      expectRelation(submission, 'decidedBy', { fields: 'decidedById', onDelete: 'SetNull' })
    })
  })

  describe('User period end', () => {
    const user = block('model', 'User')

    it('carries a nullable period end — null means no approval has ever happened', () => {
      expect(lineStarting(user, 'subscriptionPeriodEnd')).toBe('subscriptionPeriodEnd DateTime?')
    })

    it('relates to the submissions it made and the submissions it decided', () => {
      expect(user).toContain('submissions PaymentSubmission[]')
      expect(user).toContain(
        'decidedSubmissions PaymentSubmission[] @relation("PaymentDecisionActor")'
      )
    })
  })

  describe('migration', () => {
    const migration = readFileSync(
      path.join(__dirname, '..', 'migrations', '20260928140000_payment_decision', 'migration.sql'),
      'utf8'
    )

    it('adds the three decision columns to the existing submissions table', () => {
      expect(migration).toMatch(/ADD COLUMN\s+"decidedAt" TIMESTAMP\(3\)/)
      expect(migration).toMatch(/ADD COLUMN\s+"decidedById" TEXT/)
      expect(migration).toMatch(/ADD COLUMN\s+"rejectionReason" TEXT/)
    })

    it('adds the subscriber period end and a SetNull reviewer foreign key', () => {
      expect(migration).toMatch(/ALTER TABLE "User" ADD COLUMN\s+"subscriptionPeriodEnd" TIMESTAMP\(3\)/)
      expect(migration).toMatch(
        /ADD CONSTRAINT "PaymentSubmission_decidedById_fkey"[\s\S]*?ON DELETE SET NULL/
      )
    })

    it('is additive — no column is dropped or retyped, no row is deleted', () => {
      expect(migration).not.toContain('DROP')
      expect(migration).not.toContain('DELETE FROM')
      expect(migration).not.toContain('ALTER TABLE "PaymentSubmission" ALTER COLUMN')
    })
  })
})
