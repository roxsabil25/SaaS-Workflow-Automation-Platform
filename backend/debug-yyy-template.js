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

async function debugYyyTemplate() {
  try {
    console.log('🔍 Debugging "yyy" template...\n');
    
    const [templates] = await pool.execute(
      'SELECT id, name, status, comments FROM templates WHERE name = ? LIMIT 1',
      ['yyy']
    );
    
    if (templates.length === 0) {
      console.log('Template "yyy" not found.');
      return;
    }
    
    const template = templates[0];
    console.log(`📄 Template: ${template.name} (ID: ${template.id})`);
    console.log(`Status: ${template.status}`);
    console.log(`Comments field length: ${template.comments?.length || 0}`);
    console.log('\nRaw comments field:');
    console.log(template.comments);
    
    // Parse and analyze
    const parsed = JSON.parse(template.comments);
    console.log('\nParsed structure:');
    console.log('Keys:', Object.keys(parsed));
    console.log('Content type:', typeof parsed.content);
    console.log('Content value:', parsed.content);
    console.log('Content length:', parsed.content?.length || 0);
    console.log('Comments array length:', parsed.comments?.length || 0);
    console.log('Suggestions array length:', parsed.suggestions?.length || 0);
    
    // Look for highlights in content
    if (parsed.content) {
      const highlightedTextMatches = (parsed.content.match(/highlighted-text/g) || []).length;
      const lightgreenMatches = (parsed.content.match(/lightgreen/g) || []).length;
      const lightblueMatches = (parsed.content.match(/lightblue/g) || []).length;
      
      console.log('\nContent analysis:');
      console.log('Contains highlighted-text class:', highlightedTextMatches);
      console.log('Contains lightgreen:', lightgreenMatches);
      console.log('Contains lightblue:', lightblueMatches);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugYyyTemplate();