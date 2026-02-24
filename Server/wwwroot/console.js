
const prev_lines = [];
let line_history = 0;

// Focus the input when page loads
window.addEventListener('load', () => {
    const userInput = document.getElementById("userInput");
    if (userInput)
        userInput.focus();
});

// Handle clicks anywhere in the document to focus the current input,
// but don't steal focus if the user is making a text selection.
document.addEventListener('click', () => {
    if (window.getSelection().toString().length > 0) return;
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
            applyHighlighting(userInput);
        }
        e.preventDefault();
    }
    if (e.keyCode == 40) { // down arrow
        line_history--;
        if (line_history > 0 && prev_lines[prev_lines.length - line_history] !== undefined) {
            userInput.innerText = prev_lines[prev_lines.length - line_history];
            applyHighlighting(userInput);
        } else {
            userInput.innerHTML = "";
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

// --- Syntax highlighting ---

const PAREN_COLORS = [
    'var(--color-red)',
    'var(--color-orange)',
    'var(--color-yellow)'
];

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightBabble(text) {
    // Normalize line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Normalize non-breaking and other unicode spaces to regular spaces
    text = text.replace(/[\u00A0\u2002\u2003\u2009]/g, ' ').replace(/\u200B/g, '');

    let html = '';
    let i = 0;
    let depth = 0;

    while (i < text.length) {
        const ch = text[i];

        if (ch === '\n') {
            html += '\n';
            i++;
        } else if (ch === '(' || ch === '[') {
            depth++;
            const color = PAREN_COLORS[(depth - 1) % PAREN_COLORS.length];
            html += `<span style="color:${color}">${escapeHtml(ch)}</span>`;
            i++;
        } else if (ch === ')' || ch === ']') {
            const color = PAREN_COLORS[(Math.max(1, depth) - 1) % PAREN_COLORS.length];
            if (depth > 0) depth--;
            html += `<span style="color:${color}">${escapeHtml(ch)}</span>`;
            i++;
        } else if (ch === '"') {
            // String literal — read until closing unescaped "
            let str = '"';
            i++;
            while (i < text.length && text[i] !== '"') {
                if (text[i] === '\\' && i + 1 < text.length) {
                    str += text[i] + text[i + 1];
                    i += 2;
                } else {
                    str += text[i++];
                }
            }
            if (i < text.length) { str += '"'; i++; }
            html += `<span style="color:white">${escapeHtml(str)}</span>`;
        } else if (/[0-9]/.test(ch)) {
            // Number literal (leading digit)
            let num = '';
            while (i < text.length && /[0-9.]/.test(text[i])) num += text[i++];
            html += `<span style="color:white">${escapeHtml(num)}</span>`;
        } else if ((ch === '-' || ch === '+') && i + 1 < text.length && /[0-9]/.test(text[i + 1])) {
            // Signed number literal e.g. -2, +3, -3.14
            let num = text[i++];
            while (i < text.length && /[0-9.]/.test(text[i])) num += text[i++];
            html += `<span style="color:white">${escapeHtml(num)}</span>`;
        } else {
            // Read a full token until a delimiter is reached, then check if it's a keyword.
            let token = '';
            while (i < text.length && !/[\s()\[\]{}"`,;]/.test(text[i])) {
                token += text[i++];
            }
            if (token.length === 0) {
                // Delimiter character (space, bracket, etc.) — output as-is
                html += escapeHtml(text[i]);
                i++;
            } else if (babble.analyzer._builtins && babble.analyzer._builtins.has(token)) {
                html += `<span style="color:var(--color-orange)">${escapeHtml(token)}</span>`;
            } else {
                html += escapeHtml(token);
            }
        }
    }

    return html;
}

// Save cursor as a character offset into the element's plain text.
function getCursorCharOffset(el) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    let offset = 0;

    function walk(node) {
        if (node === range.endContainer) {
            offset += range.endOffset;
            return true;
        }
        if (node.nodeType === Node.TEXT_NODE) {
            offset += node.textContent.length;
        } else {
            for (const child of node.childNodes) {
                if (walk(child)) return true;
            }
        }
        return false;
    }

    walk(el);
    return offset;
}

// Restore cursor to a character offset into the element's plain text.
function setCursorCharOffset(el, offset) {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let remaining = offset;
    let found = false;

    function walk(node) {
        if (found) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const len = node.textContent.length;
            if (remaining <= len) {
                range.setStart(node, remaining);
                range.collapse(true);
                found = true;
                return;
            }
            remaining -= len;
        } else {
            for (const child of node.childNodes) {
                walk(child);
                if (found) return;
            }
        }
    }

    walk(el);
    if (!found) { range.selectNodeContents(el); range.collapse(false); }
    sel.removeAllRanges();
    sel.addRange(range);
}

function applyHighlighting(el) {
    const text = el.innerText;
    const offset = getCursorCharOffset(el);
    el.innerHTML = highlightBabble(text);
    setCursorCharOffset(el, offset);
}

// Apply highlighting whenever the active input changes.
document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'userInput') {
        applyHighlighting(e.target);
    }
});

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
    
    // DEBUG: Log the raw string and its character codes
    // console.log('Raw input:', JSON.stringify(line));
    // console.log('Char codes:', [...line].map(c => c.charCodeAt(0)).join(','));
    
    // Normalize whitespace: replace non-breaking spaces and other unicode spaces with regular spaces
    // This is important for contenteditable elements which may insert &nbsp; or other space chars
    line = line.replace(/\u00A0/g, ' ')  // non-breaking space
               .replace(/\u2003/g, ' ')  // em space
               .replace(/\u2002/g, ' ')  // en space
               .replace(/\u2009/g, ' ')  // thin space
               .replace(/\u200B/g, '');  // zero-width space
    
    // Trim leading/trailing whitespace but preserve internal newlines and spaces
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
            babble.executor.ex(line, addLine);
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
    userInput.classList.add("command_text");
    
    // Add the command that was just executed as read-only highlighted text
    if (currentText.trim()) {
        userInput.innerHTML = highlightBabble(currentText);
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
    } else if (responsepacket.status == "warning") {
        line.className = 'warning_response';
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
    
    if (responsepacket.message != null) {
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
    // document.cookie = `handle=${handle}; path=/; SameSite=Strict; Secure`;

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

async function getIpaddr() {
    // Get user's IP address from server
    try {
        const response = await fetch('/api/userip');
        const ip = await response.text();
        return ip;
    } catch (error) {
        return '';
    }
}

async function addNewPrompt() {
    let typeblock = document.getElementById("typing");
    
    let linebreak = document.createElement('br');
    typeblock.appendChild(linebreak);
    
    // Create new prompt line    
    let carrot = document.createElement('span');
    
    // let handle = getCookie('handle');
    let handle = babble.executor.handle;
    let promptPrefix = '';
    
    if (handle) {
        promptPrefix = `[${handle}]`;
    } else {
        // is it possible for this to change while we're on the page?
        // if not, we should just cache it once on load
        const ipaddr = await getIpaddr();
        promptPrefix = `[${ipaddr}]`;
    }
    carrot.innerHTML = `<span class='promptPrefix'>${promptPrefix}</span><span class='carrot'>&gt;</span> `;
    
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
