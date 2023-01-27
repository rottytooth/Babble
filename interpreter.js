var msg = "Hello World";
console.log(msg);

// const TokenType = {
//     LeftBracket: 'LeftBracket',
//     RightBracket: 'RightBracket',
//     Symbol: 'Symbol',
//     Number: 'Number',
//     Boolean: 'Boolean',
//     String: 'String',
//     Eof: 'Eof'
//   };
  
  var program = "(define x x)"

  const TokenOperatorType = {
    LeftBracket: '(',
    RightBracket: ')'    
  }

  const TokenType = {
    Define: 'define'
  }

  function findTokenType(value) {
    match = Object.keys(TokenType).find(key => TokenType[key] === value);
    if (match == undefined)
        return 'nonmatch';
    return match;
  }

  token_list = []

  token = "";
  for (let character of program) {
    if (character == ' ') {
        token_list.push({
            text: token,
            type: findTokenType(token)
        });
        token = "";        
        continue;
    }
    token += character;

    if(myArray.some(e => e.key1 == 'value1')) {
        console.log('Exists');
      }
    console.log(character);
  }

  

  