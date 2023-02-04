const cover_start_opacity = 0.7;

const prev_lines = [];

let creator = "";

const keyevents = (e) => {
    var code = e.keyCode || e.which;
    type(String.fromCharCode(code));
    return true;
}

const specialKeys = (e) => {
    if (e.keyCode == 13) {
        type(String.fromCharCode(13));
        processLine();
        e.preventDefault(); // return key
    }
    if (e.keyCode == 8) {
        backspace();
        e.preventDefault(); // backspace
    }
}

const backspace = () => {
    let tyc = document.getElementById("typing").lastChild;
    tyc.innerText = tyc.innerText.substring(0, tyc.innerText.length - 1);
}

const type = (content) => {
    let tyc = document.getElementById("typing").lastChild;
    let cmdWindow = document.getElementById("cmdWindow");

    tyc.innerText += content;
    cmdWindow.scrollTo(0, cmdWindow.scrollHeight);
}

document.onkeypress = keyevents;
document.onkeydown = specialKeys;

window.addEventListener('paste', (event) => { 
    let paste = (event.clipboardData || window.clipboardData).getData('text');
    let typeblock = document.getElementById("typing");
    typeblock.lastChild.innerText += paste;
});

// running expressions

const processLine = () => {
    let typeblock = document.getElementById("typing");
    let line = typeblock.lastChild.innerText;

    prev_lines.push(line);

    opening = line.split('(').length-1;
    closing = line.split(')').length-1;
    line = line.trim();
    if (opening > closing) {
        // there are still open parentheses, do nothing
        return;
    } else if (closing > opening) {
        // automatic Syntax Error
        addLine({"status":"error","message":"SyntaxError: Unmatched parantheses"}); 
    } else {
        try {
            tree = babble.parser.parse(line);
            babble.executor.ex(tree[0], addLine, line, creator);
        }
        catch(err) {
            if (err.name == "SyntaxError") {
                addLine({"status":"error","message":`syntax error at line ${err.location.start.line}, col ${err.location.start.column} : ${err.message}`});
            } else {
                // record other errors back to the API if possible
            }
        }
    }
}

const addLine = (responsepacket) => {
    line = document.createElement('span');

    // we got no response at all
    if (responsepacket === undefined) {
        line.className = 'error_response';
        responsepacket = {"message":"could not determine response from server. additional info may follow"};
    } else if (responsepacket.status == "success") {
        line.className = 'server_response';
    } else if (responsepacket.status == "error") {
        line.className = 'error_response';
    }

    let typeblock = document.getElementById("typing");
    typeblock.appendChild(line);
    
    if (responsepacket.message) {
        line.innerText = responsepacket.message;
        line.innerText += "\n\n";
    }
    userline = document.createElement('span');
    typeblock.appendChild(userline);
    window.scrollTo(0, document.body.scrollHeight);
}
