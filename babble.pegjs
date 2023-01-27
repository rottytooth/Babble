Program = Command+

Command = d:(Print / DefineCall / FunctionCall) _?
{
	// filter out the blank spaces
	return d;
}

Print = "(" _? "print" e:Expression _? ")"
{
	return {
    	type:"print",
        exp:e
    };
}

FunctionCall = "(" _? f:ID p:Param+ _? ")"
{
	return {
    	type:"function_call",
    	name:f,
        params:p
    };
}

DefineCall = "(" _? d:("def"/"defn") _? i:ID e:Expression ")"
{
	return {
		type:"definition",
		command:d,
		id: i,
		expression: e
	};
}

ID = d:[a-zA-Z0-9]+ _?
{
	return d.join('')
}

Param = _? d:[a-zA-Z0-9]+ _?
{
	return d.join('');
}

Expression = Literal

Literal = NumberLiteral / StringLiteral / CharLiteral

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
{ return {
	type: 'StringLiteral',
	value: val.join("") };
}

CharLiteral = _? "'" val:[^'] "'" _?
{ return {
	type: 'CharLiteral',
	value: val };
}

_ "whitespace"
	= [ \t\n\r]*
