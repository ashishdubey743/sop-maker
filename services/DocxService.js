const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, convertInchesToTwip,
  ShadingType, UnderlineType, ExternalHyperlink, ImageRun
} = require("docx");
const { nanoid } = require('nanoid');
const fs = require('fs').promises;
const path = require('path');

class DocxService {
  /**
   * Create SOP document from AI content
   * @param {string} sopContent - The SOP content from AI
   * @param {string} title - Document title
   * @returns {Promise<Buffer>} - Document buffer
   */
  async createSopDocument(sopContent, title = "Standard Operating Procedure") {
    try {
      console.log('Creating SOP document...');

      // Parse content and create document elements
      const contentElements = this.parseContentToElements(sopContent);

      // Create the document
      const doc = new Document({
        styles: {
          paragraphStyles: [
            {
              id: "Normal",
              name: "Normal",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: {
                font: "Calibri",
                size: 24, // 12pt
              },
            },
            {
              id: "Heading1",
              name: "Heading 1",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: {
                font: "Calibri",
                size: 32, // 16pt
                bold: true,
                color: "2E74B5",
              },
              paragraph: {
                spacing: { before: 240, after: 120 },
              },
            },
            {
              id: "Heading2",
              name: "Heading 2",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: {
                font: "Calibri",
                size: 28, // 14pt
                bold: true,
                color: "2E74B5",
              },
              paragraph: {
                spacing: { before: 200, after: 100 },
              },
            },
          ],
        },
        sections: [{
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          children: [
            // Title Page
            new Paragraph({
              text: title,
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            new Paragraph({
              text: "Standard Operating Procedure",
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            }),

            new Paragraph({
              text: `Document ID: SOP-${Date.now().toString().slice(-6)}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),

            new Paragraph({
              text: `Version: 1.0`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),

            new Paragraph({
              text: `Effective Date: ${new Date().toLocaleDateString()}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // Page break for content
            new Paragraph({
              children: [new TextRun({ text: "", break: 1 })],
            }),

            // Table of Contents placeholder
            new Paragraph({
              text: "Table of Contents",
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 200 },
            }),

            new Paragraph({
              text: "[Table of Contents will be generated automatically in Word]",
              italics: true,
              color: "666666",
              spacing: { after: 400 },
            }),

            // Main content
            ...contentElements,

            // Appendices section
            new Paragraph({
              text: "Appendices",
              heading: HeadingLevel.HEADING_1,
              pageBreakBefore: true,
              spacing: { before: 400, after: 200 },
            }),

            new Paragraph({
              children: [
                new TextRun({ text: "Appendix A: ", bold: true }),
                new TextRun("Document Revision History"),
              ],
            }),

            // Revision history table
            this.createRevisionHistoryTable(),
          ],
        }],
      });

      // Generate document buffer
      const buffer = await Packer.toBuffer(doc);
      console.log('Document created successfully');
      return buffer;

    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  /**
   * Parse AI content into document elements
   */
  parseContentToElements(content) {
    const elements = [];
    const lines = content.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      if (!line) {
        i++;
        continue;
      }

      // Check for headings
      if (line.match(/^#{1,6}\s/)) {
        const heading = this.parseHeading(line);
        if (heading) elements.push(heading);
      }
      // Check for numbered lists
      else if (line.match(/^\d+\.\s/)) {
        const listResult = this.parseNumberedList(lines, i);
        elements.push(...listResult.items);
        i = listResult.nextIndex;
        continue;
      }
      // Check for bullet lists
      else if (line.match(/^[-*•]\s/)) {
        const listResult = this.parseBulletList(lines, i);
        elements.push(...listResult.items);
        i = listResult.nextIndex;
        continue;
      }
      // Check for tables (simple detection)
      else if (this.looksLikeTableLine(line) && i + 1 < lines.length) {
        const tableResult = this.parseTable(lines, i);
        if (tableResult.table) {
          elements.push(tableResult.table);
          i = tableResult.nextIndex;
          continue;
        }
      }
      // Check for code blocks
      else if (line.startsWith('```')) {
        const codeResult = this.parseCodeBlock(lines, i);
        if (codeResult.elements) {
          elements.push(...codeResult.elements);
          i = codeResult.nextIndex;
          continue;
        }
      }
      // Regular paragraph
      else {
        const paragraph = this.parseParagraph(line);
        if (paragraph) elements.push(paragraph);
      }

      i++;
    }

    return elements;
  }

  /**
   * Parse heading line
   */
  parseHeading(line) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) return null;

    const [_, hashes, text] = match;
    const level = hashes.length;

    let headingLevel;
    switch (level) {
      case 1: headingLevel = HeadingLevel.HEADING_1; break;
      case 2: headingLevel = HeadingLevel.HEADING_2; break;
      case 3: headingLevel = HeadingLevel.HEADING_3; break;
      case 4: headingLevel = HeadingLevel.HEADING_4; break;
      case 5: headingLevel = HeadingLevel.HEADING_5; break;
      case 6: headingLevel = HeadingLevel.HEADING_6; break;
      default: headingLevel = HeadingLevel.HEADING_1;
    }

    return new Paragraph({
      text: text,
      heading: headingLevel,
      spacing: { before: 200, after: 100 },
    });
  }

  /**
   * Parse numbered list
   */
  parseNumberedList(lines, startIndex) {
    const items = [];
    let i = startIndex;

    while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
      const text = lines[i].trim().replace(/^\d+\.\s+/, '');
      items.push(
        new Paragraph({
          children: [
            new TextRun({ text: "•\t", bullet: { level: 0 } }),
            new TextRun(text),
          ],
          spacing: { before: 50, after: 50 },
        })
      );
      i++;
    }

    return { items, nextIndex: i };
  }

  /**
   * Parse bullet list
   */
  parseBulletList(lines, startIndex) {
    const items = [];
    let i = startIndex;

    while (i < lines.length && lines[i].trim().match(/^[-*•]\s/)) {
      const text = lines[i].trim().substring(2).trim();
      items.push(
        new Paragraph({
          children: [
            new TextRun({ text: "•\t", bullet: { level: 0 } }),
            new TextRun(text),
          ],
          spacing: { before: 50, after: 50 },
        })
      );
      i++;
    }

    return { items, nextIndex: i };
  }

  /**
   * Check if line looks like part of a table
   */
  looksLikeTableLine(line) {
    return line.includes('|') && line.split('|').length > 2;
  }

  /**
   * Parse markdown-style table
   */
  parseTable(lines, startIndex) {
    const tableLines = [];
    let i = startIndex;

    // Collect consecutive table lines
    while (i < lines.length && this.looksLikeTableLine(lines[i].trim())) {
      tableLines.push(lines[i].trim());
      i++;
    }

    if (tableLines.length < 2) {
      return { table: null, nextIndex: startIndex + 1 };
    }

    // Parse table data
    const rows = tableLines.map(line =>
      line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '')
    );

    // Remove separator row if present
    const hasSeparator = rows[1] && rows[1].every(cell =>
      cell.replace(/[-:]/g, '').trim() === ''
    );

    const dataRows = hasSeparator ? rows.slice(2) : rows.slice(1);
    const headers = rows[0];

    if (!headers || headers.length === 0) {
      return { table: null, nextIndex: i };
    }

    // Create table
    const table = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [
        // Header row
        new TableRow({
          children: headers.map(header =>
            new TableCell({
              children: [new Paragraph({ text: header, bold: true })],
              shading: {
                fill: "E7E6E6",
                type: ShadingType.CLEAR,
              },
            })
          ),
        }),
        // Data rows
        ...dataRows.map(row =>
          new TableRow({
            children: headers.map((_, index) =>
              new TableCell({
                children: [new Paragraph({ text: row[index] || '' })],
              })
            ),
          })
        ),
      ],
    });

    return { table, nextIndex: i };
  }

  /**
   * Parse code block
   */
  parseCodeBlock(lines, startIndex) {
    if (!lines[startIndex].startsWith('```')) {
      return { elements: null, nextIndex: startIndex + 1 };
    }

    const language = lines[startIndex].substring(3).trim() || 'text';
    const codeLines = [];
    let i = startIndex + 1;

    while (i < lines.length && !lines[i].startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }

    if (i >= lines.length) {
      return { elements: null, nextIndex: startIndex + 1 };
    }

    const codeBlock = new Paragraph({
      children: [
        new TextRun({
          text: codeLines.join('\n'),
          font: "Courier New",
          size: 20, // 10pt
          color: "2E8B57",
        }),
      ],
      shading: {
        fill: "F5F5F5",
        type: ShadingType.CLEAR,
      },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      },
      spacing: { before: 100, after: 100 },
    });

    const languageLabel = new Paragraph({
      text: `Code (${language}):`,
      italics: true,
      color: "666666",
      spacing: { after: 0 },
    });

    return { elements: [languageLabel, codeBlock], nextIndex: i + 1 };
  }

  /**
   * Parse regular paragraph with basic formatting
   */
  parseParagraph(line) {
    // Check for bold text: **text** or __text__
    if (line.includes('**') || line.includes('__')) {
      const children = [];
      const parts = line.split(/(\*\*|__)/);
      let isBold = false;

      for (const part of parts) {
        if (part === '**' || part === '__') {
          isBold = !isBold;
        } else if (part) {
          children.push(new TextRun({
            text: part,
            bold: isBold
          }));
        }
      }

      return new Paragraph({
        children: children,
        spacing: { before: 100, after: 100 },
      });
    }

    // Regular paragraph
    return new Paragraph({
      text: line,
      spacing: { before: 100, after: 100 },
    });
  }

  /**
   * Create revision history table
   */
  createRevisionHistoryTable() {
    return new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: "Version", bold: true })],
              shading: { fill: "E7E6E6" },
            }),
            new TableCell({
              children: [new Paragraph({ text: "Date", bold: true })],
              shading: { fill: "E7E6E6" },
            }),
            new TableCell({
              children: [new Paragraph({ text: "Description", bold: true })],
              shading: { fill: "E7E6E6" },
            }),
            new TableCell({
              children: [new Paragraph({ text: "Author", bold: true })],
              shading: { fill: "E7E6E6" },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: "1.0" })],
            }),
            new TableCell({
              children: [new Paragraph({ text: new Date().toLocaleDateString() })],
            }),
            new TableCell({
              children: [new Paragraph({ text: "Initial Release" })],
            }),
            new TableCell({
              children: [new Paragraph({ text: "System Generated" })],
            }),
          ],
        }),
      ],
    });
  }

  /**
   * Save document to file (optional helper)
   */
  async saveDocumentToFile(buffer, folder, filename) {
    filename = nanoid()+'_'+filename;
    await fs.mkdir(folder, { recursive: true });
    const filePath = path.join(folder, filename);
    await fs.writeFile(filePath, buffer);
    return filename;
  }
}

module.exports = new DocxService();