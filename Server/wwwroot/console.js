
const prev_lines = [];
let line_history = 0;

// Focus the input when page loads
window.addEventListener('load', () => {
    const userInput = document.getElementById("userInput");
    userInput.focus();
});

// Handle clicks anywhere in the document to focus the current input
document.addEventListener('click', () => {
    const userInput = document.getElementById("userInput");
    if (userInput) {
        userInput.focus();
    }
});

const keyevents = (e) => {
    // Let contenteditable handle normal typing
    return true;
}

const specialKeys = (e) => {
    const userInput = document.getElementById("userInput");
    
    if (!userInput) return; // Safety check
    
    if (e.keyCode == 13) { // return key
        processLine();
        e.preventDefault(); 
    }
    if (e.keyCode == 38) { // up arrow
        line_history++;
        if (prev_lines.length - line_history >= 0 && prev_lines[prev_lines.length - line_history] !== undefined) {
            userInput.innerText = prev_lines[prev_lines.length - line_history];
            // Move cursor to end
            setCursorToEnd(userInput);
        }
        e.preventDefault(); 
    }
    if (e.keyCode == 40) { // down arrow
        line_history--;
        if (line_history > 0 && prev_lines[prev_lines.length - line_history] !== undefined) {
            userInput.innerText = prev_lines[prev_lines.length - line_history];
        } else {
            userInput.innerText = "";
        }
        // Move cursor to end
        setCursorToEnd(userInput);
        e.preventDefault(); 
    }
}

// Helper function to move cursor to end of contenteditable
const setCursorToEnd = (element) => {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

const backspace = () => {
    // This is now handled by contenteditable, but keeping for compatibility
}

const type = (content) => {
    // This function is now mainly for compatibility, 
    // as contenteditable handles most typing
    let userInput = document.getElementById("userInput");
    let cmdWindow = document.getElementById("cmdWindow");
    
    if (userInput) {
        userInput.innerText += content;
        cmdWindow.scrollTo(0, cmdWindow.scrollHeight);
    }
}

document.onkeypress = keyevents;
document.onkeydown = specialKeys;

window.addEventListener('paste', (event) => { 
    // Let contenteditable handle paste naturally
    let userInput = document.getElementById("userInput");
    // Ensure focus is on the current input
    if (userInput) {
        userInput.focus();
    }
});

// running expressions

const processLine = () => {
    let userInput = document.getElementById("userInput");
    if (!userInput) return; // Safety check
    
    let line = userInput.innerText;
    line = line.trim();

    if (line.length === 0) {
        addLine({"status":"nothing"});
        return;
    }

    prev_lines.push(line);

    opening = line.split('(').length-1;
    closing = line.split(')').length-1;
    if (opening > closing) {
        // there are still open parentheses, do nothing
        return;
    } else if (closing > opening) {
        // automatic Syntax Error
        addLine({"status":"error","message":"syntax error: unmatched parantheses"}); 
    } else {
        try {
            tree = babble.parser.parse(line);
            babble.executor.ex(tree, addLine, line);
        }
        catch(err) {
            if (err.name == "SyntaxError") {
                addLine({"status":"error","message":`syntax error at line ${err.location.start.line}, col ${err.location.start.column} : ${err.message}`});
            } else {
                //TODO: record other errors back to the API if possible
            }
        }
    }
}

const addLine = (responsepacket) => {
    let userInput = document.getElementById("userInput");
    let currentText = userInput.innerText;
    
    // Make the current input read-only by removing contenteditable and id
    userInput.removeAttribute("contenteditable");
    userInput.removeAttribute("id");
    
    // Add the command that was just executed as read-only text
    if (currentText.trim()) {
        userInput.innerText = currentText;
    }
    
    let line = document.createElement('span');

    // we got no response at all
    if (responsepacket === undefined) {
        line.className = 'error_response';
        responsepacket = {"message":"could not determine response from server. additional info may follow"};
    } else if (responsepacket.status == "nothing") {
        // a blank line
    } else if (responsepacket.status == "success") {
        line.className = 'server_response';
    } else if (responsepacket.status == "error") {
        line.className = 'error_response';
    }

    let typeblock = document.getElementById("typing");
    typeblock.appendChild(line);
    
    if (responsepacket.message) {
        line.innerText = responsepacket.message;
        line.innerText += "\n";
    }
    
    // Create new prompt line
    carrot = document.createElement('span');
    carrot.innerHTML = "&gt; ";
    typeblock.appendChild(carrot);

    // Create new editable input span
    let newUserInput = document.createElement('span');
    newUserInput.setAttribute("contenteditable", "true");
    newUserInput.setAttribute("id", "userInput");
    typeblock.appendChild(newUserInput);
    
    window.scrollTo(0, document.body.scrollHeight);
    
    // Focus the new input for continued typing
    newUserInput.focus();

    line_history = 0;
}
