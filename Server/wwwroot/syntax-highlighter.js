(function (global) {
    const babble = global.babble = global.babble || {};

    const PAREN_COLORS = [
        'var(--color-red)',
        'var(--color-orange)',
        'var(--color-yellow)'
    ];

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function highlight(text) {
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
                html += `<span style="color:var(--color-literal)">${escapeHtml(str)}</span>`;
            } else if (/[0-9]/.test(ch)) {
                let num = '';
                while (i < text.length && /[0-9.]/.test(text[i])) num += text[i++];
                html += `<span style="color:var(--color-literal)">${escapeHtml(num)}</span>`;
            } else if ((ch === '-' || ch === '+') && i + 1 < text.length && /[0-9]/.test(text[i + 1])) {
                let num = text[i++];
                while (i < text.length && /[0-9.]/.test(text[i])) num += text[i++];
                html += `<span style="color:var(--color-literal)">${escapeHtml(num)}</span>`;
            } else if (ch === ';') {
                let comment = '';
                while (i < text.length && text[i] !== '\n') comment += text[i++];
                html += `<span style="color:#6a5f5a">${escapeHtml(comment)}</span>`;
            } else {
                let token = '';
                while (i < text.length && !/[\s()\[\]{}"`,;]/.test(text[i])) {
                    token += text[i++];
                }

                if (token.length === 0) {
                    html += escapeHtml(text[i]);
                    i++;
                } else if (babble.analyzer._builtins && babble.analyzer._builtins.has(token)) {
                    html += `<span style="color:var(--color--var)">${escapeHtml(token)}</span>`;
                } else {
                    html += escapeHtml(token);
                }
            }
        }

        return html;
    }

    function getCursorCharOffset(el) {
        const sel = global.getSelection();
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

    function setCursorCharOffset(el, offset) {
        const sel = global.getSelection();
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
        if (!found) {
            range.selectNodeContents(el);
            range.collapse(false);
        }
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function applyHighlighting(el) {
        const text = el.innerText;
        const offset = getCursorCharOffset(el);
        el.innerHTML = highlight(text);
        setCursorCharOffset(el, offset);
    }

    babble.syntaxHighlighter = {
        highlight,
        applyHighlighting
    };
})(window);
