require('dotenv').config();

class ChatbotService {
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
        
        return titleMatch ? titleMatch[1].replace('📋', '').trim() : `SOP - ${new Date().toLocaleDateString()}`;
    }
}
module.exports = new ChatbotService();