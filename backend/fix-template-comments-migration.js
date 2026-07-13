#!/usr/bin/env node

/**
 * PERMANENT TEMPLATE COMMENTS MIGRATION SCRIPT
 * 
 * This script fixes templates that have comments/suggestions in HTML content
 * but empty comments/suggestions arrays. This resolves the compatibility issue
 * between CreateTemplate and PendingReview pages.
 * 
 * Run this script after restarting your PC or when you notice the issue.
 */

const mysql = require('mysql2/promise');
const { JSDOM } = require('jsdom');

// Load environment variables
require('dotenv').config();

// Database configuration from environment
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'custom_docx',
  port: process.env.DB_PORT || 3306
};

/**
 * Extract comments and suggestions from HTML content
 */
function extractCommentsFromHtml(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return { comments: [], suggestions: [] };
  }
  
  // Handle double-encoded content (wrapped in extra quotes)
  let cleanContent = htmlContent;
  if (cleanContent.startsWith('"') && cleanContent.endsWith('"')) {
    try {
      cleanContent = JSON.parse(htmlContent);
    } catch (e) {
      // If JSON parsing fails, just remove the outer quotes
      cleanContent = cleanContent.slice(1, -1);
    }
  }
  
  const extractedComments = [];
  const extractedSuggestions = [];
  
  try {
    // Create a temporary DOM element to parse HTML
    const dom = new JSDOM(cleanContent);
    const document = dom.window.document;
    
    // Find all highlighted spans
    const highlightedSpans = document.querySelectorAll('span.highlighted-text');
    
    highlightedSpans.forEach((span, index) => {
      const backgroundColor = span.style.backgroundColor;
      const highlightedText = span.textContent;
      
      if (!highlightedText.trim()) return;
      
      const timestamp = new Date().toISOString();
      
      // Determine if it's a comment or suggestion by background color
      if (backgroundColor.includes('lightgreen') || backgroundColor.includes('rgb(144, 238, 144)')) {
        // This is a comment
        extractedComments.push({
          id: `extracted-comment-${Date.now()}-${index}`,
          user: 'Template Author',
          text: `Comment on: "${highlightedText}"`,
          timestamp: timestamp,
          highlightedText: highlightedText,
          selectedText: highlightedText,
          type: 'comment',
          status: 'open',
          replies: [],
          fragmentId: `fragment-extracted-comment-${Date.now()}-${index}`,
          author: 'Template Author',
          userId: null,
          userEmail: null,
          email: null,
          avatar: null
        });
      } else if (backgroundColor.includes('lightblue') || backgroundColor.includes('rgb(173, 216, 230)')) {
        // This is a suggestion
        const delElement = span.querySelector('del');
        const insElement = span.querySelector('ins');
        
        let originalText = highlightedText;
        let suggestedText = highlightedText;
        let status = 'pending';
        
        if (delElement && insElement) {
          originalText = delElement.textContent;
          suggestedText = insElement.textContent;
          status = 'pending';
        }
        
        extractedSuggestions.push({
          id: `extracted-suggestion-${Date.now()}-${index}`,
          user: 'Template Author',
          text: suggestedText,
          timestamp: timestamp,
          highlightedText: originalText,
          selectedText: originalText,
          type: 'suggestededit',
          status: status,
          replies: [],
          fragmentId: `fragment-extracted-suggestion-${Date.now()}-${index}`,
          author: 'Template Author',
          userId: null,
          userEmail: null,
          email: null,
          avatar: null
        });
      }
    });
    
    return { comments: extractedComments, suggestions: extractedSuggestions };
    
  } catch (error) {
    console.error('Error extracting comments from HTML:', error);
    return { comments: [], suggestions: [] };
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  let connection;
  
  try {
    console.log('🔧 Starting template comments migration...\n');
    
    // Connect to database
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database');
    
    // Get all templates with comments field
    const [templates] = await connection.execute(
      'SELECT id, name, comments FROM templates WHERE comments IS NOT NULL AND comments != ""'
    );
    
    console.log(`📄 Found ${templates.length} templates with comments data\n`);
    
    let processedCount = 0;
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const template of templates) {
      processedCount++;
      const templateId = template.id;
      const templateName = template.name;
      
      try {
        // Parse the existing comments data
        const existingData = JSON.parse(template.comments);
        
        // Check if comments/suggestions arrays are already populated
        const hasComments = Array.isArray(existingData.comments) && existingData.comments.length > 0;
        const hasSuggestions = Array.isArray(existingData.suggestions) && existingData.suggestions.length > 0;
        
        if (hasComments || hasSuggestions) {
          console.log(`[${processedCount}/${templates.length}] ⏭️  Skipping: ${templateName} (already has data)`);
          skippedCount++;
          continue;
        }
        
        // Extract from HTML content
        const extracted = extractCommentsFromHtml(existingData.content);
        
        if (extracted.comments.length === 0 && extracted.suggestions.length === 0) {
          console.log(`[${processedCount}/${templates.length}] ⏭️  Skipping: ${templateName} (no highlights found)`);
          skippedCount++;
          continue;
        }
        
        // Update the data with extracted comments/suggestions
        const updatedData = {
          ...existingData,
          comments: extracted.comments,
          suggestions: extracted.suggestions
        };
        
        // Update the database
        await connection.execute(
          'UPDATE templates SET comments = ? WHERE id = ?',
          [JSON.stringify(updatedData), templateId]
        );
        
        console.log(`[${processedCount}/${templates.length}] ✅ Fixed: ${templateName} (${extracted.comments.length} comments, ${extracted.suggestions.length} suggestions)`);
        fixedCount++;
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`[${processedCount}/${templates.length}] ❌ Error processing ${templateName}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Templates processed: ${processedCount}`);
    console.log(`   - Templates fixed: ${fixedCount}`);
    console.log(`   - Templates skipped: ${skippedCount}`);
    
    if (fixedCount > 0) {
      console.log(`\n✅ The comments/suggestions compatibility issue has been resolved!`);
      console.log(`   PendingReview pages should now display comments and suggestions properly.`);
    } else {
      console.log(`\nℹ️  No templates needed fixing. All comments/suggestions are already properly structured.`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

/**
 * Check if JSDOM is installed
 */
function checkDependencies() {
  try {
    require('jsdom');
    return true;
  } catch (error) {
    console.error('❌ Missing dependency: jsdom');
    console.error('Please install it by running: npm install jsdom');
    console.error('Then run this script again.');
    return false;
  }
}

// Run the migration if dependencies are available
if (checkDependencies()) {
  runMigration().catch(console.error);
}