{
	const reserved_keywords = ["let","def"];
	const builtins = ["doc","source","defn","print","println","quote","range","map","handle"];
}

Statement = (DefExpression / Expression)

Expression = (BuiltInExpression / FuncExpression)

BuiltInExpression = (IfExpression / LetExpression)

IfExpression = "(" _? "if" _ c:Expression tr:Expression fl:Expression _? ")" _?
{
	return {
    	type: "expression",
        id: "if",
        preset: true,
        condition: c,
        true_exp: tr,
        false_exp: fl
    };
}

LetExpression = "(" _? "let" _? "[" _? b:Binding+ "]" _? e:Expression* _? ")" _?
{
	return {
    	type: "expression",
        id: "let",
        preset: true,
        bindings: b,
        exp: e
    };
}

DefExpression = "(" _? "def" _?  i:Identifier _? d:DocString? _? p:Params _? e:Expression+ _? ")" _?
{
	return {
    	type: "def_expression",
        id: i,
        doc: d,
        params: p,
        exp: e
    };
}

DocString = '"' d:[^"]+ '"'
{
	return d.join("");
}

Params = _? "[" _? i:Identifier* _? "]" _?
{
	return i;
}

Binding = i:Identifier _ e:Expression _?
{
	return {
    	type: "binding",
        id: i,
        exp: e
    };	
}

FuncExpression = "(" _ func:(Identifier/Operator) args:Expression* ")" _?
{
	var preset = false;
    
    if (func.type === "operator") {
    	preset = true;
        func = func.id;
    }
    
    if (reserved_keywords.includes(func)) {
    	error("Invalid use of keyword");
    }
	if (builtins.includes(func)) {
    	preset = true;
    }
    
	return {
    	type: "expression",
    	id: func,
        preset: preset,
        args: args
    };
} / QuotedExpression

QuotedExpression = "'(" exp:Vector+ ")" _?
{
	return {
    	type: "quoted_expression",
        exp: exp
    };
} / Vector

Operator = o:("+"/"-"/"*"/"/"/"^") _?
{
	return {
    	type: "operator",
        id: o
	};        
}

Vector = "[" v:Vector+ "]" _? 
{
	return {
    	type: "vector",
        exp: v
    };
} / Set 

Set = "#{" v:Vector+ "}" _?
{
	return {
    	type: "set",
        exp: v
    };
} / Keyword / Local / Literal

Keyword = ":" i:Identifier _?
{
	return {
    	type: "keyword",
        name: i
    };
}

Local = i:Identifier _? 
{
	return {
    	type: "local",
        name: i
    };
}

Literal = l:(NumberLiteral / StringLiteral) _?
{
	return l;
}

NumberLiteral
= "-"? DecimalIntegerLiteral "." DecimalDigit* {
	return { type: "FloatLiteral", value: parseFloat(text()) };
}
/ "." DecimalDigit+ {
	return { type: "FloatLiteral", value: parseFloat(text()) };
}
/ "-"? DecimalIntegerLiteral { 
	return { type: "IntLiteral", value: parseInt(text()) };
}

DecimalIntegerLiteral
    = "0"
    / NonZeroDigit DecimalDigit*

DecimalDigit
    = [0-9]

NonZeroDigit
    = [1-9]

StringLiteral = _? '"' val:[^"]* '"' _?
{ 
	return {
      type: 'StringLiteral',
      value: val.join("") 
    };
}


Identifier = f:fla g:a* _?
{
	var id = f;
    

	if (g.length > 0)
		id = id + g.join("");

	return id;
}

fla "first letter" = [a-zA-ZÀ-꓆]
a "letter" = [a-zA-ZÀ-꓆0-9-]

_ "whitespace"
	= [ \t\n\r]*
