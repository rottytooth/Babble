// Clojure PEG.js Grammar

Start
  = _ forms:(Form _)* { return forms.map(f => f[0]); }

Form
  = List
  / Vector
  / Map
  / Set
  / ReaderMacro
  / Literal
  / Symbol

List
  = "(" _ forms:(Form _)* ")" {
      return { type: "list", value: forms.map(f => f[0]) };
    }

Vector
  = "[" _ forms:(Form _)* "]" {
      return { type: "vector", value: forms.map(f => f[0]) };
    }

Map
  = "{" _ pairs:(MapPair _)* "}" {
      return { type: "map", value: pairs.map(p => p[0]) };
    }

MapPair
  = key:Form _ value:Form {
      return { key: key, value: value };
    }

Set
  = "#{" _ forms:(Form _)* "}" {
      return { type: "set", value: forms.map(f => f[0]) };
    }

ReaderMacro
  = UnquoteSplice
  / Quote
  / Deref
  / Meta
  / SyntaxQuote
  / Unquote
  / Dispatch

Quote
  = "'" _ form:Form {
      return { type: "quote", value: form };
    }

Deref
  = "@" _ form:Form {
      return { type: "deref", value: form };
    }

Meta
  = "^" _ metadata:Form _ form:Form {
      return { type: "meta", metadata: metadata, value: form };
    }

Dispatch
  = "#'" _ form:Form {
      return { type: "var-quote", value: form };
    }
  / "#(" _ forms:(Form _)* ")" {
      return { type: "fn", value: forms.map(f => f[0]) };
    }
  / "#_" _ form:Form {
      return { type: "discard", value: form };
    }

SyntaxQuote
  = "`" _ form:Form {
      return { type: "syntax-quote", value: form };
    }

Unquote
  = "~" !"@" _ form:Form {
      return { type: "unquote", value: form };
    }

UnquoteSplice
  = "~@" _ form:Form {
      return { type: "unquote-splicing", value: form };
    }

Literal
  = Number
  / Nil
  / Boolean
  / Keyword
  / String
  / Character

Nil
  = "nil" !SymbolContinue {
      return { type: "nil", value: null };
    }

Boolean
  = "true" !SymbolContinue {
      return { type: "boolean", value: true };
    }
  / "false" !SymbolContinue {
      return { type: "boolean", value: false };
    }

Keyword
  = "::" name:SymbolName {
      return { type: "keyword", value: "::" + name, auto: true };
    }
  / ":" name:SymbolName {
      return { type: "keyword", value: ":" + name };
    }

String
  = '"' chars:StringChar* '"' {
      return { type: "string", value: chars.join("") };
    }

StringChar
  = "\\" char:EscapeSequence { return char; }
  / [^"\\]

EscapeSequence
  = "n" { return "\n"; }
  / "t" { return "\t"; }
  / "r" { return "\r"; }
  / '"' { return '"'; }
  / "\\" { return "\\"; }
  / char:. { return char; }

Character
  = "\\" name:CharacterName {
      return { type: "character", value: name };
    }

CharacterName
  = "newline" { return "\n"; }
  / "space" { return " "; }
  / "tab" { return "\t"; }
  / "return" { return "\r"; }
  / char:. { return char; }

Number
  = Ratio
  / Float
  / Integer

Float
  = sign:"-"? digits:[0-9]+ "." decimals:[0-9]+ exp:([eE] "-"? [0-9]+)? {
      const numStr = (sign || "") + digits.join("") + "." + decimals.join("") + (exp ? exp.flat().join("") : "");
      return { type: "float", value: parseFloat(numStr) };
    }

Integer
  = sign:"-"? digits:[0-9]+ !SymbolContinue {
      return { type: "integer", value: parseInt((sign || "") + digits.join(""), 10) };
    }

Ratio
  = sign:"-"? num:[0-9]+ "/" denom:[0-9]+ {
      return { 
        type: "ratio", 
        numerator: parseInt((sign || "") + num.join(""), 10), 
        denominator: parseInt(denom.join(""), 10) 
      };
    }

Symbol
  = name:SymbolName {
      return { type: "symbol", value: name };
    }

SymbolName
  = ns:SymbolStart chars:SymbolContinue* "/" name:SymbolStart rest:SymbolContinue* {
      return ns + chars.join("") + "/" + name + rest.join("");
    }
  / start:SymbolStart chars:SymbolContinue* {
      return start + chars.join("");
    }

SymbolStart
  = [a-zA-Z] 
  / [+*!?$%&=<>_]
  / "-" ![0-9]
  / "/"

SymbolContinue
  = [a-zA-Z0-9+*!?$%&=<>_:#'.\-/]

// Whitespace and Comments
_
  = (Whitespace / Comment)*

Whitespace
  = [ \t\n\r,]

Comment
  = ";" [^\n]* "\n"?

EOF
  = !.