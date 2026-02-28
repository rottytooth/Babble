CREATE TABLE TermVersion (
    "VersionID" INTEGER NOT NULL,
	"TermID"	INTEGER NOT NULL,
    "ParentVersionID" INTEGER,
    "Diff" TEXT,
    "CreatedBy" TEXT,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY("VersionID" AUTOINCREMENT),
    FOREIGN KEY ("TermID") REFERENCES "Term"("TermID")
);