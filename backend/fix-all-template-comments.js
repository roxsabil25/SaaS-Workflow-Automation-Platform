const mysql = require('mysql2/promise');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'template_editor',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function extractCommentsFromHtml(htmlContent) {
  if (!htmlContent) return { comments: [], suggestions: [] };
  
  // Handle double-encoded content (content wrapped in quotes)
  let cleanContent = htmlContent;
  if (typeof cleanContent === 'string' && cleanContent.startsWith('"') && cleanContent.endsWith('"')) {
    try {
      cleanContent = JSON.parse(cleanContent);
    } catch (e) {
      // If parsing fails, use as-is
    }
  }
  
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div>${cleanContent}</div></body></html>`);
  const tempDiv = dom.window.document.querySelector('div');
  
  const comments = [];
  const suggestions = [];
  
  const allHighlights = tempDiv.querySelectorAll('.highlighted-text');
  
  allHighlights.forEach((highlight, index) => {
    const style = highlight.getAttribute('style') || '';
    const highlightedText = highlight.textContent || '';
    
    if (style.includes('lightgreen') || style.includes('background-color: lightgreen')) {
      const commentId = highlight.getAttribute('data-comment-id') || `extracted-comment-${Date.now()}-${index}`;
      
      comments.push({
        id: commentId,
        user: 'Template Author',
        text: `Comment on: "${highlightedText.substring(0, 50)}${highlightedText.length > 50 ? '...' : ''}"`,
        timestamp: new Date().toISOString(),
        highlightedText: highlightedText,
        selectedText: highlightedText,
        type: 'comment',
        status: 'open',
        replies: [],
        fragmentId: `fragment-${commentId}`,
        author: 'Template Author',
        userId: null,
        userEmail: null,
        email: null,
        avatar: null
      });
    }
    
    else if (style.includes('lightblue') || style.includes('background-color: lightblue')) {
      const suggestionId = highlight.getAttribute('data-suggestededit-id') || `extracted-suggestion-${Date.now()}-${index}`;
      
      const delElement = highlight.querySelector('del');
      const insElement = highlight.querySelector('ins');
      
      const originalText = delElement ? delElement.textContent : highlightedText;
      const suggestedText = insElement ? insElement.textContent : highlightedText;
      
      suggestions.push({
        id: suggestionId,
        user: 'Template Author',
        text: suggestedText,
        timestamp: new Date().toISOString(),
        highlightedText: originalText,
        selectedText: originalText,
        type: 'suggestededit',
        status: delElement && insElement ? 'pending' : 'approved',
        replies: [],
        fragmentId: `fragment-${suggestionId}`,
        author: 'Template Author',
        userId: null,
        userEmail: null,
        email: null,
        avatar: null
      });
    }
  });
  
  return { comments, suggestions };
}

async function fixAllTemplateComments() {
  try {
    console.log('🔧 Fixing all template comments...\n');
    
    // Get templates with empty comments/suggestions arrays but with HTML content
    const [templates] = await pool.execute(
      `SELECT id, name, status, comments FROM templates 
       WHERE comments IS NOT NULL 
       AND comments != '' 
       AND JSON_LENGTH(JSON_EXTRACT(comments, '$.comments')) = 0
       AND JSON_LENGTH(JSON_EXTRACT(comments, '$.suggestions')) = 0
       ORDER BY updated_at DESC`
    );
    
    console.log(`Found ${templates.length} templates that need fixing.\n`);
    
    let processedCount = 0;
    let fixedCount = 0;
    
    for (const template of templates) {
      processedCount++;
      console.log(`[${processedCount}/${templates.length}] Processing: ${template.name} (ID: ${template.id})`);
      
      try {
        const parsedComments = JSON.parse(template.comments);
        
        // Extract comments and suggestions from the HTML content
        const extracted = extractCommentsFromHtml(parsedComments.content);
        
        if (extracted.comments.length > 0 || extracted.suggestions.length > 0) {
          // Update the template with extracted data
          const updatedCommentsData = {
            content: parsedComments.content,
            comments: extracted.comments,
            suggestions: extracted.suggestions
          };
          
          await pool.execute(
            'UPDATE templates SET comments = ? WHERE id = ?',
            [JSON.stringify(updatedCommentsData), template.id]
          );
          
          fixedCount++;
          console.log(`  ✅ Fixed: ${extracted.comments.length} comments, ${extracted.suggestions.length} suggestions`);
        } else {
          console.log(`  ⏭️  No highlights found in HTML content`);
        }
        
      } catch (error) {
        console.log(`  ❌ Error processing template: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Summary:`);
    console.log(`- Templates processed: ${processedCount}`);
    console.log(`- Templates fixed: ${fixedCount}`);
    console.log(`- Templates skipped: ${processedCount - fixedCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixAllTemplateComments();