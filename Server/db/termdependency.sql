CREATE TABLE "TermDependency" (
	"ID"	INTEGER NOT NULL,
	"TermID"	INTEGER NOT NULL,
	"DependentTermID"	INTEGER NOT NULL,
	"CreatedAt"	TEXT DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("ID" AUTOINCREMENT),
	FOREIGN KEY("TermID") REFERENCES "Term"("ID") ON DELETE CASCADE,
	UNIQUE("TermID", "DependentTermID")
);

-- Index to speed up lookups by TermID
CREATE INDEX "idx_termdependency_termid" ON "TermDependency" ("TermID");

-- Index to speed up reverse lookups (which terms depend on a given term)
CREATE INDEX "idx_termdependency_dependenttermname" ON "TermDependency" ("DependentTermName");
