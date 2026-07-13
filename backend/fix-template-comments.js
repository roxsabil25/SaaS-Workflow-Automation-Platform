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

async function fixTemplateComments() {
  try {
    console.log('🔧 Fixing template comments...\n');
    
    // Get the first template with empty comments/suggestions arrays but with HTML highlights
    const [templates] = await pool.execute(
      `SELECT id, name, status, comments FROM templates 
       WHERE comments IS NOT NULL 
       AND comments != '' 
       AND JSON_LENGTH(JSON_EXTRACT(comments, '$.comments')) = 0
       AND JSON_LENGTH(JSON_EXTRACT(comments, '$.suggestions')) = 0
       LIMIT 1`
    );
    
    if (templates.length === 0) {
      console.log('No templates found that need fixing.');
      return;
    }
    
    const template = templates[0];
    console.log(`📄 Processing template: ${template.name} (ID: ${template.id})`);
    
    const parsedComments = JSON.parse(template.comments);
    console.log('Original data:', {
      commentsCount: parsedComments.comments?.length || 0,
      suggestionsCount: parsedComments.suggestions?.length || 0,
      hasContent: !!parsedComments.content
    });
    
    // Extract comments and suggestions from the HTML content
    const extracted = extractCommentsFromHtml(parsedComments.content);
    
    console.log('Extracted data:', {
      commentsCount: extracted.comments.length,
      suggestionsCount: extracted.suggestions.length
    });
    
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
      
      console.log('✅ Template updated successfully!');
      console.log('New data:', {
        commentsCount: updatedCommentsData.comments.length,
        suggestionsCount: updatedCommentsData.suggestions.length
      });
      
      // Show sample extracted data
      if (extracted.comments.length > 0) {
        console.log('\nSample comment:', extracted.comments[0]);
      }
      if (extracted.suggestions.length > 0) {
        console.log('\nSample suggestion:', extracted.suggestions[0]);
      }
      
    } else {
      console.log('No comments or suggestions found in HTML content.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixTemplateComments();