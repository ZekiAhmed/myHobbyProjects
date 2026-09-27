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
