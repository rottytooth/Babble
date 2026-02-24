CREATE TABLE "Term" (
	"ID"	INTEGER NOT NULL,
	"Name"	TEXT NOT NULL,
	"Params"	TEXT,
	"ParamNum"	INTEGER,
	-- Definition: the body expression(s) of the term, stripped of its wrapper form.
	"Definition"	TEXT NOT NULL,
	-- Line: the full original source expression as a JSON AST, as a user might type it
	--   (e.g. the entire (define fr [] (+ ree 7)) form). Used by the `source` command to
	--   reconstruct and display what was originally entered.
	--   Like Definition, unknown symbol references are stored as loc indices.
	"Line"	TEXT NOT NULL,
	"Doc"	TEXT,
	"Creator"	TEXT,
	"IPAddr"	TEXT,
	"BuiltIns"	TEXT,
	-- Symbols: JSON array of Term IDs (integers) for each Babble term referenced in this
	--   definition. IDs correspond to Term.ID. Resolved to names on read.
	"Symbols"	TEXT,
	"AddedAt"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("ID" AUTOINCREMENT),
	UNIQUE("Name","ParamNum")
);

CREATE INDEX IF NOT EXISTS "idx_term_name" ON "Term" ("Name");

