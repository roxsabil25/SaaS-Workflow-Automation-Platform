// Test the HTML extraction function with real database samples

function extractCommentsFromHtml(htmlContent) {
  if (!htmlContent) return { comments: [], suggestions: [] };
  
  // Simulate DOM parsing in Node.js
  const jsdom = require('jsdom');
  const { JSDOM } = jsdom;
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div>${htmlContent}</div></body></html>`);
  const tempDiv = dom.window.document.querySelector('div');
  
  const comments = [];
  const suggestions = [];
  
  // Find all highlighted-text spans (this is how the current system saves highlights)
  const allHighlights = tempDiv.querySelectorAll('.highlighted-text');
  
  allHighlights.forEach((highlight, index) => {
    const style = highlight.getAttribute('style') || '';
    const highlightedText = highlight.textContent || '';
    
    // Detect comment highlights by background color (lightgreen)
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
    
    // Detect suggestion highlights by background color (lightblue)
    else if (style.includes('lightblue') || style.includes('background-color: lightblue')) {
      const suggestionId = highlight.getAttribute('data-suggestededit-id') || `extracted-suggestion-${Date.now()}-${index}`;
      
      // Check if it's a pending suggestion with del/ins tags
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
  
  console.log('🔧 Extracted from HTML:', {
    commentsCount: comments.length,
    suggestionsCount: suggestions.length,
    htmlLength: htmlContent.length,
    totalHighlights: allHighlights.length
  });
  
  return { comments, suggestions };
}

// Test with real database samples
console.log('Testing extraction function...\n');

const sampleHtml1 = `<p data-block-id="block_1760782630883_sjz47vxbu">oi<span class="highlighted-text" contenteditable="false" style="background-color: lightblue;"><del>uoi</del><ins>98u8u9</ins></span>uo<span class="highlighted-text" contenteditable="false" style="background-color: lightgreen;">uou</span></p>`;

const sampleHtml2 = `<p data-block-id="block_1760782007183_la191l3gm"><span class="highlighted-text" contenteditable="false" style="background-color: lightgreen;">nnnnn</span>nnnnn<span class="highlighted-text" contenteditable="false" style="background-color: lightblue;"><del>nn</del><ins>iuh</ins></span></p>`;

console.log('Sample 1:');
console.log('HTML:', sampleHtml1);
const result1 = extractCommentsFromHtml(sampleHtml1);
console.log('Results:', {
  comments: result1.comments.length,
  suggestions: result1.suggestions.length
});
console.log('Comment details:', result1.comments.map(c => ({ text: c.text, highlightedText: c.highlightedText })));
console.log('Suggestion details:', result1.suggestions.map(s => ({ text: s.text, highlightedText: s.highlightedText, status: s.status })));

console.log('\n' + '='.repeat(80) + '\n');

console.log('Sample 2:');
console.log('HTML:', sampleHtml2);
const result2 = extractCommentsFromHtml(sampleHtml2);
console.log('Results:', {
  comments: result2.comments.length,
  suggestions: result2.suggestions.length
});
console.log('Comment details:', result2.comments.map(c => ({ text: c.text, highlightedText: c.highlightedText })));
console.log('Suggestion details:', result2.suggestions.map(s => ({ text: s.text, highlightedText: s.highlightedText, status: s.status })));