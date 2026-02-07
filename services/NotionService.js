require('dotenv').config();

class NotionService {
    getPrompt({ message, style }) {
        return `
        CRITICAL INSTRUCTION: You MUST analyze if the user's SOP request involves DATA STORAGE or DATABASE OPERATIONS.
        
        User's request: "${message}"
        
        FIRST, analyze: Does this SOP need a database table? Look for these clues:
        1. Mentions of: data, records, information, storage, database, table, fields, columns
        2. Processes involving: user data, transactions, logs, tracking, inventory, approvals
        3. Keywords: store, save, record, track, monitor, log, database, table, schema
        
        If YES, include a DATABASE TABLE SCHEMA section with relevant columns.
        If NO, skip the database section.
        
        Generate the SOP in this structure:
        
        ${style === 'detailed' ? `
        # 📋 SOP: [Appropriate Title]
        
        ## 📊 DATABASE TABLE SCHEMA (Only if needed!)
        If this process involves data storage, create a table like this:
        | Column | Type | Description | Sample Data |
        |--------|------|-------------|-------------|
        | [Relevant column] | [Appropriate type] | [Clear description] | [Example value] |
        
        ### 1. 🎯 PURPOSE
        ### 2. 📌 SCOPE
        ### 3. 👥 RESPONSIBILITIES
        ### 4. 🔄 PROCEDURE STEPS
        ### 5. ⚠️ QUALITY CHECKS
        ` : `
        # 📋 [Procedure Name]
        
        **🎯 Purpose:** [Why]
        **👥 Responsible:** [Who]
        
        **🔄 Steps:**
        1. [Step 1]
        2. [Step 2]
        3. [Step 3]
        
        ${style === 'standard' ? `
        **📊 Database Table (if needed):**
        | Column | Type | Description |
        |--------|------|-------------|
        | [column] | [type] | [description] |` : ''}
        `}
        
        IMPORTANT RULES for Database Tables:
        1. ONLY create tables if the SOP clearly involves data storage
        2. Columns should be RELEVANT to the specific process
        3. Use appropriate data types: VARCHAR, INT, BOOLEAN, TIMESTAMP, etc.
        4. Include Primary Key (id) and timestamps if applicable
        5. Make columns SPECIFIC to the use case
        
        Example: If SOP is about "User Registration", table might have:
        | Column | Type | Description |
        |--------|------|-------------|
        | id | INT | Primary Key |
        | username | VARCHAR(50) | User's login name |
        | email | VARCHAR(100) | User's email |
        | created_at | TIMESTAMP | Registration time |
        
        DO NOT use hardcoded or pre-defined tables. Create FRESH tables based on context.
        
        Now generate the SOP for: "${message}"
        `;
    }

    getTableAnalysisPrompt() {
        return `You are an expert SOP writer and database architect. 
                When users describe processes, you analyze if they need data storage.
                If they do, you create APPROPRIATE database table schemas.
                
                KEY RULES:
                1. Detect database needs from context clues
                2. Create relevant table structures from scratch
                3. Don't use pre-defined or hardcoded tables
                4. Make columns specific to the use case
                5. Use proper data types and constraints
                6. Format tables clearly with markdown
                
                Example analysis:
                - "Track customer orders" → Needs orders table
                - "Approve employee requests" → Needs approvals table
                - "Simple checklist" → No database needed
                
                Always think: "Does this process need to store data persistently?"`;
    }

    getContentTitle(content) {
        const titleMatch = content.match(/^#\s*(.+?)(?:\n|$)/) ||
            content.match(/SOP:\s*(.+?)(?:\n|$)/i) ||
            content.match(/📋\s*(.+?)(?:\n|$)/);
        return titleMatch ? titleMatch[1].trim() : `SOP - ${new Date().toLocaleDateString()}`;
    }

    // Check if SOP contains a database table
    hasDatabaseTable(content) {
        return content.includes('| Column |') ||
            content.includes('DATABASE TABLE') ||
            content.match(/\|.*\|.*\|.*\|/);
    }

    prepareDataWithTablesIfExist(content, style) {
        const lines = content.split('\n');
        const blocks = [];
        let inTable = false;
        let tableRows = [];
        let tableHeaders = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) {
                if (inTable) {
                    // End of table
                    blocks.push(this.createNotionTable(tableHeaders, tableRows));
                    inTable = false;
                    tableRows = [];
                    tableHeaders = [];
                }
                continue;
            }

            // Detect table start
            if ((line.includes('| Column |') || line.includes('DATABASE TABLE') ||
                line.match(/^\|.*\|.*\|.*\|$/)) && !inTable) {
                inTable = true;
                continue;
            }

            // Process table rows
            if (inTable && line.includes('|')) {
                const cells = line.split('|')
                    .map(cell => cell.trim())
                    .filter(cell => cell.length > 0);

                if (cells.length >= 2) {
                    // Check if this is header (contains Column/Type/Description)
                    if (cells.some(cell => ['Column', 'Type', 'Description', 'Sample Data'].includes(cell))) {
                        tableHeaders = cells;
                    } else {
                        tableRows.push(cells);
                    }
                }

                // Check if next line ends the table
                if (i + 1 < lines.length && !lines[i + 1].includes('|')) {
                    blocks.push(this.createNotionTable(tableHeaders, tableRows));
                    inTable = false;
                    tableRows = [];
                    tableHeaders = [];
                }
                continue;
            }

            // End table if we're in table mode but line doesn't have pipes
            if (inTable && !line.includes('|')) {
                if (tableRows.length > 0) {
                    blocks.push(this.createNotionTable(tableHeaders, tableRows));
                }
                inTable = false;
                tableRows = [];
                tableHeaders = [];
            }

            // Process non-table content
            if (!inTable) {
                const block = this.createFormattedBlock(line);
                if (block) blocks.push(block);
            }
        }

        // Handle table at end of content
        if (inTable && tableRows.length > 0) {
            blocks.push(this.createNotionTable(tableHeaders, tableRows));
        }

        return blocks;
    }

    // Create a Notion table from parsed data
    createNotionTable(headers, rows) {
        // Use the headers from the first row if no specific headers found
        const effectiveHeaders = headers.length > 0 ? headers : rows[0];
        const effectiveRows = headers.length > 0 ? rows : rows.slice(1);

        // Calculate number of columns based on headers or first row
        const tableWidth = effectiveHeaders.length > 0
            ? effectiveHeaders.length
            : (effectiveRows[0]?.length || 0);

        const tableChildren = effectiveRows.map(row => ({
            type: 'table_row',
            table_row: {
                cells: row.map(cell => [{
                    type: 'text',
                    text: {
                        content: cell.replace(/\*\*/g, '').replace(/__/g, '') || " "
                    }
                }])
            }
        }));

        // Add header row if we have headers
        if (effectiveHeaders.length > 0) {
            tableChildren.unshift({
                type: 'table_row',
                table_row: {
                    cells: effectiveHeaders.map(header => [{
                        type: 'text',
                        text: {
                            content: header.replace(/\*\*/g, '').replace(/__/g, '') || " "
                        }
                    }])
                }
            });
        }

        return {
            type: 'table',
            table: {
                table_width: tableWidth,  // ADD THIS
                has_column_header: effectiveHeaders.length > 0,
                has_row_header: false,
                children: tableChildren
            }
        };

    }

    // Create formatted blocks for non-table content
    createFormattedBlock(line) {
        // Detect headings
        if (line.match(/^#{1,3}\s/)) {
            const level = line.match(/^#{1,3}/)[0].length;
            const content = line.replace(/^#{1,3}\s/, '');
            return {
                object: "block",
                type: `heading_${level}`,
                [`heading_${level}`]: {
                    rich_text: [{
                        type: "text",
                        text: { content },
                        annotations: { bold: true }
                    }]
                }
            };
        }

        // Detect bold text
        if (line.match(/\*\*.+?\*\*/)) {
            const content = line.replace(/\*\*/g, '');
            return {
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [{
                        type: "text",
                        text: { content },
                        annotations: { bold: true }
                    }]
                }
            };
        }

        // Detect numbered lists
        if (line.match(/^\d+[\.\)]\s/)) {
            return {
                object: "block",
                type: "numbered_list_item",
                numbered_list_item: {
                    rich_text: [{
                        type: "text",
                        text: { content: line }
                    }]
                }
            };
        }

        // Default paragraph
        return {
            object: "block",
            type: "paragraph",
            paragraph: {
                rich_text: [{
                    type: "text",
                    text: { content: line }
                }]
            }
        };
    }
}
module.exports = NotionService;