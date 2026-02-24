-- TermDependency: junction table recording which Terms a given Term depends on.
-- Both columns are foreign keys into Term.ID.
CREATE TABLE "TermDependency" (
	"TermID"	INTEGER NOT NULL,
	"SymbolID"	INTEGER NOT NULL,
	PRIMARY KEY("TermID","SymbolID"),
	FOREIGN KEY("TermID") REFERENCES "Term"("ID"),
	FOREIGN KEY("SymbolID") REFERENCES "Term"("ID")
);

CREATE INDEX IF NOT EXISTS "idx_termdependency_term" ON "TermDependency" ("TermID");