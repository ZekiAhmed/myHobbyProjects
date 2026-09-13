# 07 — Tag Management

**What to build:** Create and delete tags in board settings. Assign tags to todos in the side panel. Tags display as colored chips on todo cards. Tags are per-board, name unique per board.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `createTag(boardId, name, color)` Server Action — owner only, creates tag with hex color, revalidates `board-detail` tag
- [ ] `deleteTag(tagId)` Server Action — owner only, deletes tag (cascades to TodoTag), revalidates `board-detail` tag
- [ ] `TagManager` component — in board settings, shows existing tags with delete button, form to create new tag (name + color picker)
- [ ] Tag color picker — simple color input or preset palette (hex colors)
- [ ] TodoSidePanel updated — tag multi-select field, shows available board tags, allows assigning multiple tags
- [ ] `TodoCard` updated — displays assigned tags as colored chips
- [ ] Tag validation — name required, max length, unique per board (server-side error: "Tag name already exists")