PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS friends (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  music INTEGER NOT NULL DEFAULT 1 CHECK(music IN (0, 1)),
  dance INTEGER NOT NULL DEFAULT 1 CHECK(dance IN (0, 1)),
  journal INTEGER NOT NULL DEFAULT 0 CHECK(journal IN (0, 1))
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL CHECK(section IN ('music', 'dance', 'journal')),
  visibility TEXT NOT NULL DEFAULT 'self' CHECK(visibility IN ('self', 'section', 'selected', 'circle')),
  variants TEXT NOT NULL,
  media TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS readers (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  email TEXT NOT NULL REFERENCES friends(email),
  PRIMARY KEY(post_id, email)
);
