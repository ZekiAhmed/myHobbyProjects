-- RenameListToBoard
-- This migration renames List → Board and ListMember → BoardMember
-- to align with Kanban terminology (a "board" contains columns of todos).

-- Step 1: Rename tables
ALTER TABLE "ListMember" RENAME TO "BoardMember";
ALTER TABLE "List" RENAME TO "Board";

-- Step 2: Rename foreign key columns
ALTER TABLE "BoardMember" RENAME COLUMN "listId" TO "boardId";
ALTER TABLE "Invitation" RENAME COLUMN "listId" TO "boardId";
ALTER TABLE "Tag" RENAME COLUMN "listId" TO "boardId";
ALTER TABLE "Todo" RENAME COLUMN "listId" TO "boardId";

-- Step 3: Rename foreign key constraints
ALTER TABLE "BoardMember" RENAME CONSTRAINT "ListMember_listId_fkey" TO "BoardMember_boardId_fkey";
ALTER TABLE "BoardMember" RENAME CONSTRAINT "ListMember_userId_fkey" TO "BoardMember_userId_fkey";
ALTER TABLE "Invitation" RENAME CONSTRAINT "Invitation_listId_fkey" TO "Invitation_boardId_fkey";
ALTER TABLE "Tag" RENAME CONSTRAINT "Tag_listId_fkey" TO "Tag_boardId_fkey";
ALTER TABLE "Todo" RENAME CONSTRAINT "Todo_listId_fkey" TO "Todo_boardId_fkey";

-- Step 4: Rename primary key constraints
ALTER TABLE "Board" RENAME CONSTRAINT "List_pkey" TO "Board_pkey";
ALTER TABLE "BoardMember" RENAME CONSTRAINT "ListMember_pkey" TO "BoardMember_pkey";

-- Step 5: Rename indexes
ALTER INDEX "List_ownerId_idx" RENAME TO "Board_ownerId_idx";
ALTER INDEX "ListMember_listId_idx" RENAME TO "BoardMember_boardId_idx";
ALTER INDEX "ListMember_userId_idx" RENAME TO "BoardMember_userId_idx";
ALTER INDEX "ListMember_listId_userId_key" RENAME TO "BoardMember_boardId_userId_key";
ALTER INDEX "Invitation_listId_idx" RENAME TO "Invitation_boardId_idx";
ALTER INDEX "Tag_listId_idx" RENAME TO "Tag_boardId_idx";
ALTER INDEX "Tag_listId_name_key" RENAME TO "Tag_boardId_name_key";
ALTER INDEX "Todo_listId_idx" RENAME TO "Todo_boardId_idx";
ALTER INDEX "Todo_listId_status_idx" RENAME TO "Todo_boardId_status_idx";

-- Step 6: Update User model relation (ownedLists → ownedBoards)
-- The relation name in Prisma is "ListOwner" → "BoardOwner"
-- This is handled by Prisma's schema, not SQL