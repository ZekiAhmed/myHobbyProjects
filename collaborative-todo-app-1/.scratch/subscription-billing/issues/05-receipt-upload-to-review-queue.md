# 05 — Receipt upload → review queue

**What to build:** The subscriber uploads their transfer receipt (JPEG/PNG/WebP/PDF, up to 5 MB) from the instruction card. The upload goes through an API route handler that validates the real file signature (never the extension), stores the bytes on the submission, and flips AWAITING_UPLOAD → PENDING under a status guard — only genuinely awaiting records can transition. A memo-confirmation checkbox ("I included my reference in the memo") precedes upload, and a definitive success screen confirms submission. Each new PENDING submission triggers a best-effort email to Administrators so reviews start promptly; email failure never fails the upload.

**Blocked by:** 04 — Subscribe: payment instruction card.

**Status:** done

- [x] Upload route handler accepts the four MIME types via signature check, rejects over-5 MB and spoofed files before any database write
- [x] Successful upload stores bytes and transitions to PENDING atomically; wrong-state or unknown-reference attempts are rejected
- [x] Memo checkbox + success screen give the user a definitive "submitted, under review" state
- [x] Best-effort notification email fires to Administrators on each new PENDING; failures are logged, not surfaced as upload errors
- [x] Tests cover accepted/rejected file types, size limit, transition guards, and the fire-and-forget email behavior
