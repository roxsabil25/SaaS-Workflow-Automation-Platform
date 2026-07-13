const mysql = require('mysql2/promise');
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

async function debugCommentParsing() {
  try {
    console.log('🔍 Fetching template data from database...\n');
    
    // Get all templates with comments
    const [templates] = await pool.execute(
      'SELECT id, name, status, comments FROM templates WHERE comments IS NOT NULL AND comments != "" ORDER BY updated_at DESC'
    );
    
    console.log(`Found ${templates.length} templates with comments data\n`);
    
    for (const template of templates.slice(0, 3)) { // Check first 3
      console.log('=' .repeat(80));
      console.log(`📄 Template: ${template.name} (ID: ${template.id})`);
      console.log(`Status: ${template.status}`);
      console.log(`Comments field length: ${template.comments?.length || 0}`);
      console.log('-'.repeat(40));
      
      if (template.comments) {
        console.log('Raw comments field (first 500 chars):');
        console.log(template.comments.substring(0, 500));
        console.log('\n' + '-'.repeat(40));
        
        try {
          const parsed = JSON.parse(template.comments);
          console.log('✅ JSON Parse Success');
          console.log('Parsed structure keys:', Object.keys(parsed));
          
          // Check various possible structures
          console.log('\nStructure Analysis:');
          console.log('- Type:', typeof parsed);
          console.log('- Is Array:', Array.isArray(parsed));
          
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            console.log('- Object keys:', Object.keys(parsed));
            
            // Check for nested comments/suggestions
            if (parsed.comments) {
              console.log('- Has .comments:', Array.isArray(parsed.comments), '(length:', parsed.comments?.length || 0, ')');
            }
            if (parsed.suggestions) {
              console.log('- Has .suggestions:', Array.isArray(parsed.suggestions), '(length:', parsed.suggestions?.length || 0, ')');
            }
            if (parsed.content) {
              console.log('- Has .content:', typeof parsed.content);
            }
            
            // Check for any arrays in the structure
            for (const [key, value] of Object.entries(parsed)) {
              if (Array.isArray(value)) {
                console.log(`- Array found: ${key} (length: ${value.length})`);
                if (value.length > 0) {
                  console.log(`  Sample item keys:`, Object.keys(value[0] || {}));
                }
              }
            }
          } else if (Array.isArray(parsed)) {
            console.log('- Direct array length:', parsed.length);
            if (parsed.length > 0) {
              console.log('- First item keys:', Object.keys(parsed[0] || {}));
            }
          }
          
        } catch (e) {
          console.log('❌ JSON Parse Error:', e.message);
          console.log('Raw content type:', typeof template.comments);
        }
      } else {
        console.log('No comments field data');
      }
      console.log('\n');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugCommentParsing();