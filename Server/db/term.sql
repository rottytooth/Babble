CREATE TABLE "Term" (
	"ID"	INTEGER NOT NULL,
	"Name"	TEXT NOT NULL,
	"Params"	TEXT,
	"ParamNum"	INTEGER,
	"Definition"	TEXT NOT NULL,
	"Line"	TEXT NOT NULL,
	"Doc"	TEXT,
	"Creator"	TEXT,
	"IPAddr"	TEXT,
	PRIMARY KEY("ID" AUTOINCREMENT),
	UNIQUE("Name","ParamNum")
)