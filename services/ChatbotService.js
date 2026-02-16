require('dotenv').config();

class ChatbotService {
   getPrompt({ message, style }) {
    return `
You are a Senior Technical Architect and SOP Documentation Expert.

CRITICAL ANALYSIS STEP:
Before writing the SOP, analyze whether the process:
- Involves data storage
- Affects database tables
- Requires backend services
- Touches internal/external systems
- Requires infra dependencies

User Request:
"${message}"

==================================================
📋 OUTPUT STRUCTURE (MANDATORY)
==================================================

# 📋 SOP: [Generate Proper Technical Title]

---

## 1️⃣ Purpose
Clearly explain why this SOP exists.

---

## 2️⃣ Scope

### 2.1 Systems Involved
List all systems involved:
- Backend services
- APIs
- Database
- External services
- UI
- Queue systems

### 2.2 Tables / Services Affected
Explicitly list:
- Database tables impacted
- Microservices impacted
- Event queues involved
- Cron jobs affected

---

## 3️⃣ Responsibilities
Define roles:
- Developer
- DevOps
- QA
- Product
- Support

---

## 4️⃣ Architecture Overview

Provide a high-level flow explanation.

Then generate a text-based flow diagram like:

User → API → Service Layer → Database  
                ↓  
             Queue → Worker → External Service  

Use proper arrows and indentation.

---

## 5️⃣ Prerequisites

List required setup:

- Access permissions
- DB credentials
- Required ENV variables
- Required Git branch
- Required file format (if applicable)
- Feature flags (if applicable)

---

## 6️⃣ Dependencies

### Internal Services
Mention if relevant:
- Auth Service
- Vendor Service
- Queue Service
- Notification Service
- Analytics Service

### External Services
Mention if relevant:
- AWS S3
- Redis
- Aurora MySQL
- Slack Webhook
- Third-party APIs

Only include services that are contextually required.

---

## 7️⃣ Data Model / Tables Affected (Only if applicable)

If the process stores or modifies data,
create fresh database tables relevant to this use case.

Use this structure:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK, Auto Increment | Primary Key |
| ... | ... | ... | ... |

Rules:
- Always include Primary Key
- Add created_at / updated_at if relevant
- Use proper SQL types
- Do NOT reuse generic template tables
- Columns must be contextual

If NO database is involved, write:
"⚠️ No persistent data storage involved."

---

## 8️⃣ Procedure Steps

Write detailed step-by-step execution process.

If deployment related:
Include rollback steps.

If DB related:
Include backup instructions.

---

## 9️⃣ Quality Checks / Validation

- Logs to verify
- DB validation query
- API response validation
- Monitoring checks

---

## 🔟 Rollback Plan (If applicable)

Explain how to revert safely.

---

IMPORTANT RULES:

1. Do NOT hallucinate unnecessary systems.
2. Only include dependencies that logically apply.
3. Only create DB tables if data persistence is required.
4. Keep structure consistent and enterprise-grade.
5. Be technical, not generic.

Now generate the SOP for:

"${message}"
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