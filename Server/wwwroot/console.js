
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
    } else if (responsepacket.status == "verify_pwd") {
        line.className = 'verify_pwd_response';

        line.innerText = "pwd: ";
        
        // Add password input field
        let passwordInput = document.createElement('input');
        passwordInput.type = 'password';
        passwordInput.id = 'passwordField';
        line.appendChild(passwordInput);

        // Add event listener for Enter key
        passwordInput.addEventListener('keypress', function(e) {
            if (e.keyCode === 13) { // Enter key
                handlePasswordSubmission(passwordInput.value, responsepacket.handle);
                e.preventDefault();
            }
        });

        let typeblock = document.getElementById("typing");
        typeblock.appendChild(line);
        passwordInput.focus();

        return; // don't add another prompt yet
    }

    let typeblock = document.getElementById("typing");
    typeblock.appendChild(line);
    
    if (responsepacket.message) {
        line.innerText = responsepacket.message;
    }
    
    // Create new prompt line
    addNewPrompt();
}

function handlePasswordSubmission(password, handle) {
    // Handle password submission logic here
    console.log('Password submitted for handle:', handle);
    console.log('Password length:', password.length);
    
    // FIXME: You can add your password verification logic here
    // For example, make an API call to verify the password

    // Store the handle in session cookie
    document.cookie = `handle=${handle}; path=/; SameSite=Strict; Secure`;

    // Set the handle in babble.executor
    babble.executor.handle = handle;
    
    // Remove the password input and continue with normal flow
    const passwordField = document.getElementById('passwordField');
    if (passwordField) {
        passwordField.remove();
    }
    
    // Add new prompt line
    addNewPrompt();
}

// Get handle from session cookie or use IP address
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function addNewPrompt() {
    let typeblock = document.getElementById("typing");
    
    let linebreak = document.createElement('br');
    typeblock.appendChild(linebreak);
    
    // Create new prompt line    
    let carrot = document.createElement('span');
    
    let handle = getCookie('handle');
    let promptPrefix = '';
    
    if (handle) {
        promptPrefix = `[${handle}]`;
    } else {
        // Get user's IP address from server
        try {
            fetch('/api/userip')
                .then(response => response.text())
                .then(ip => {
                    promptPrefix = `[${ip}]`;
                    carrot.innerHTML = `<span class='promptPrefix'>${promptPrefix}</span>&gt; `;
                });
        } catch (error) {
            promptPrefix = '';
        }
    }
    
    // Set carrot content for handle case (IP case is handled in the fetch callback)
    if (handle) {
        carrot.innerHTML = "<span class='promptPrefix'>" + promptPrefix + "</span>&gt; ";
    }
    
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
