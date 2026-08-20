// Enhanced markdown parser with better support for lists and tables
function simpleMarkdownParser(text) {
    if (!text) return '';
    
    // Store code blocks so they don't get processed
    const codeBlocks = [];
    text = text.replace(/```([\s\S]*?)```/g, function(match) {
        codeBlocks.push(match);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
    
    // Process text
    text = text
        // Headers
        .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>\n')
        .replace(/## (.*?)(\n|$)/g, '<h2>$1</h2>\n')
        .replace(/# (.*?)(\n|$)/g, '<h1>$1</h1>\n')
        
        // Bold and italic
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        
        // Inline code
        .replace(/`([^`]*)`/g, '<code>$1</code>')
        
        // Horizontal rule
        .replace(/^---+$/gm, '<hr>')
        
        // Tables - this is a simplified implementation
        .replace(/^\|(.+)\|$/gm, function(match, content) {
            // Split the table row into cells
            const cells = content.split('|').map(cell => cell.trim());
            
            // Check if this is a header separator row (contains only dashes and colons)
            if (cells.every(cell => /^:?-+:?$/.test(cell))) {
                return match; // Return unchanged, we'll remove these later
            }
            
            // Create table cells
            const cellsHtml = cells.map(cell => `<td>${cell}</td>`).join('');
            return `<tr>${cellsHtml}</tr>`;
        })
        // Process tables by finding consecutive table rows
        .replace(/(<tr>.*?<\/tr>)\n\|([-:\s|]+)\|\n(<tr>.*?<\/tr>(\n<tr>.*?<\/tr>)*)/g, function(match, headerRow, separatorRow, bodyRows) {
            // Convert the header row's cells to <th> instead of <td>
            const tableHeader = headerRow.replace(/<td>(.*?)<\/td>/g, '<th>$1</th>');
            return `<table><thead>${tableHeader}</thead><tbody>${bodyRows}</tbody></table>`;
        })
        // Handle tables without headers
        .replace(/(<tr>.*?<\/tr>(\n<tr>.*?<\/tr>)*)/g, function(match, rows) {
            // Only convert to a table if it's not already in a table
            if (!match.includes('<table>')) {
                return `<table><tbody>${rows}</tbody></table>`;
            }
            return match;
        })
        
        // Ordered lists - look for consecutive lines starting with numbers
        .replace(/^(\d+\. .+\n)+/gm, function(match) {
            // Split the list items
            const items = match.trim().split('\n');
            const listItems = items.map(item => {
                // Remove the number and period, then trim
                const content = item.replace(/^\d+\.\s*/, '');
                return `<li>${content}</li>`;
            }).join('');
            return `<ol>${listItems}</ol>\n`;
        })
        
        // Unordered lists - handle multiple list markers
        .replace(/^([\*\-\+] .+\n)+/gm, function(match) {
            // Split the list items
            const items = match.trim().split('\n');
            const listItems = items.map(item => {
                // Remove the list marker, then trim
                const content = item.replace(/^[\*\-\+]\s*/, '');
                return `<li>${content}</li>`;
            }).join('');
            return `<ul>${listItems}</ul>\n`;
        })
        
        // Paragraphs (lines not already processed)
        .replace(/^([^\n<][^\n]*?)(?:\n|$)/gm, function(match, content) {
            // Don't wrap empty lines in <p> tags
            if (content.trim() === '') return '\n';
            // Don't wrap lines that are likely part of lists or other block elements
            if (/^<\/(ol|ul|table|h[1-6])>/.test(content)) return content + '\n';
            return `<p>${content}</p>\n`;
        })
        
        // Clean up extra newlines
        .replace(/\n+/g, '\n');
    
    // Restore code blocks
    text = text.replace(/__CODE_BLOCK_(\d+)__/g, function(match, index) {
        const code = codeBlocks[parseInt(index)]
            .replace(/```(?:\w+)?\n([\s\S]*?)```/g, '$1')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<pre><code>${code}</code></pre>`;
    });
    
    return text;
}
