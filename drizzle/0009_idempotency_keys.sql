ALTER TABLE posts ADD COLUMN idempotency_key uuid;
CREATE UNIQUE INDEX posts_author_idempotency_idx ON posts (author_id, idempotency_key);

ALTER TABLE post_revisions ADD COLUMN idempotency_key uuid;
CREATE UNIQUE INDEX post_revisions_author_idempotency_idx ON post_revisions (author_id, idempotency_key);

ALTER TABLE comments ADD COLUMN idempotency_key uuid;
CREATE UNIQUE INDEX comments_author_idempotency_idx ON comments (author_id, idempotency_key);

ALTER TABLE comment_revisions ADD COLUMN idempotency_key uuid;
CREATE UNIQUE INDEX comment_revisions_author_idempotency_idx ON comment_revisions (author_id, idempotency_key);

ALTER TABLE tag_requests ADD COLUMN idempotency_key uuid;
CREATE UNIQUE INDEX tag_requests_author_idempotency_idx ON tag_requests (requested_by, idempotency_key);

ALTER TABLE tag_revisions ADD COLUMN idempotency_key uuid;
CREATE UNIQUE INDEX tag_revisions_author_idempotency_idx ON tag_revisions (author_id, idempotency_key);
