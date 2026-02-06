import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  uuid,
  varchar,
  integer,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'user']);
export const postStatusEnum = pgEnum('post_status', [
  'pending',
  'published',
  'rejected',
]);
export const reviewStatusEnum = pgEnum('review_status', [
  'pending',
  'approved',
  'rejected',
]);

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('user_email_idx').on(table.email),
  })
);

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('session_token_idx').on(table.token),
  })
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    providerIdx: uniqueIndex('account_provider_account_idx').on(
      table.providerId,
      table.accountId
    ),
  })
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    identifierIdx: uniqueIndex('verification_identifier_value_idx').on(
      table.identifier,
      table.value
    ),
  })
);

export const userProfiles = pgTable('user_profiles', {
  userId: text('user_id').primaryKey(),
  role: roleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorId: text('author_id').notNull(),
    title: varchar('title', { length: 256 }).notNull(),
    slug: varchar('slug', { length: 256 }).notNull(),
    excerpt: text('excerpt'),
    content: text('content'),
    status: postStatusEnum('status').notNull().default('pending'),
    views: integer('views').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => ({
    slugIdx: uniqueIndex('posts_slug_idx').on(table.slug),
  })
);

export const postRevisions = pgTable('post_revisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull(),
  authorId: text('author_id').notNull(),
  title: varchar('title', { length: 256 }),
  excerpt: text('excerpt'),
  content: text('content'),
  tagIds: jsonb('tag_ids').$type<string[]>(),
  tagNames: jsonb('tag_names').$type<string[]>(),
  status: reviewStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: text('reviewed_by'),
  reviewerNote: text('reviewer_note'),
});

export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull(),
  authorId: text('author_id').notNull(),
  parentId: uuid('parent_id'),
  body: text('body').notNull(),
  status: reviewStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  reviewedBy: text('reviewed_by'),
});

export const commentRevisions = pgTable('comment_revisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  commentId: uuid('comment_id').notNull(),
  authorId: text('author_id').notNull(),
  body: text('body').notNull(),
  status: reviewStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: text('reviewed_by'),
  reviewerNote: text('reviewer_note'),
});

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    createdBy: text('created_by'),
    approvedBy: text('approved_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('tags_slug_idx').on(table.slug),
  })
);

export const tagRequests = pgTable('tag_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull(),
  requestedBy: text('requested_by').notNull(),
  status: reviewStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: text('reviewed_by'),
  reviewerNote: text('reviewer_note'),
});

export const tagRevisions = pgTable('tag_revisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tagId: uuid('tag_id').notNull(),
  authorId: text('author_id').notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull(),
  status: reviewStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: text('reviewed_by'),
  reviewerNote: text('reviewer_note'),
});

export const postTags = pgTable(
  'post_tags',
  {
    postId: uuid('post_id').notNull(),
    tagId: uuid('tag_id').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.tagId] }),
  })
);

export const postLikes = pgTable(
  'post_likes',
  {
    postId: uuid('post_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.userId] }),
  })
);

export const siteSettings = pgTable('site_settings', {
  id: integer('id').primaryKey().default(1),
  faviconUrl: text('favicon_url'),
  customCss: text('custom_css'),
  customJs: text('custom_js'),
  customHtml: text('custom_html'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const analyticsSessions = pgTable(
  'analytics_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    ipHash: text('ip_hash').notNull(),
    country: text('country'),
    region: text('region'),
    city: text('city'),
    os: text('os'),
    browser: text('browser'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    lastSeenIdx: index('analytics_sessions_last_seen_idx').on(table.lastSeenAt),
    ipHashIdx: index('analytics_sessions_ip_hash_idx').on(table.ipHash),
  })
);

export const analyticsPageviews = pgTable(
  'analytics_pageviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pageId: text('page_id').notNull(),
    sessionId: text('session_id').notNull(),
    path: text('path').notNull(),
    referrer: text('referrer'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
  },
  (table) => ({
    pageIdIdx: uniqueIndex('analytics_pageviews_page_id_idx').on(table.pageId),
    sessionIdx: index('analytics_pageviews_session_idx').on(table.sessionId),
    startedIdx: index('analytics_pageviews_started_idx').on(table.startedAt),
  })
);
