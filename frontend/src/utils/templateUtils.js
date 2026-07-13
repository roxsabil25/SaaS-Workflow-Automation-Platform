/**
 * Utility functions for template management
 */

/**
 * Strips comment and suggestion highlight markers from HTML content.
 * Cleans up both classes and data attributes, and removes the wrapping spans while preserving inner text.
 * 
 * @param {string} html - The HTML content to clean
 * @returns {string} The cleaned HTML content
 */
export const stripCommentHighlights = (html) => {
  if (!html || typeof html !== 'string') return html;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 1. Process all elements that have comment/suggestion markers or highlight classes
    // Expanded selector to include non-span elements just in case
    const highlights = doc.querySelectorAll(
      '[data-comment-id], [data-suggestededit-id], [data-user-email], [data-edited-by], [data-edited-by-email], [title^="Edited by"], .highlighted-text, .temp-comment-highlight, .temp-suggestion-highlight, .admin-edit, .reviewer-edit, [data-backspace-strike-id], .backspace-strike-text'
    );
    
    highlights.forEach(el => {
      // Check if it's a locked element using a comprehensive check
      const isLocked = el.getAttribute('data-locked') === 'true' || 
                       el.getAttribute('data-locked') === 'partial' ||
                       el.classList.contains('locked-text') || 
                       el.classList.contains('locked') ||
                       el.getAttribute('contenteditable') === 'false';
      
      if (isLocked) {
        // RETAIN the element tag, but REMOVE comment/suggestion markers and highlight classes
        el.removeAttribute('data-comment-id');
        el.removeAttribute('data-suggestededit-id');
        el.removeAttribute('data-backspace-strike-id');
        el.removeAttribute('data-strike-created-by-id');
        el.removeAttribute('data-strike-created-by-email');
        el.removeAttribute('data-user-email');
        el.removeAttribute('data-edited-by');
        el.removeAttribute('data-edited-by-email');
        el.removeAttribute('title');
        el.classList.remove('highlighted-text', 'temp-comment-highlight', 'temp-suggestion-highlight', 'admin-edit', 'reviewer-edit', 'backspace-strike-text');
        const style = el.getAttribute('style') || '';
        if (style) {
          const cleanedStyle = style
            .split(';')
            .map(s => s.trim())
            .filter(Boolean)
            .filter(s => {
              const lower = s.toLowerCase();
              return !lower.startsWith('text-decoration') &&
                     !lower.startsWith('-webkit-text-decoration-color') &&
                     !lower.startsWith('background');
            })
            .join('; ');
          if (cleanedStyle) el.setAttribute('style', cleanedStyle);
          else el.removeAttribute('style');
        }
        
        // Handle suggestions (del/ins) if they exist inside the locked element
        // Usually we want to keep the original content (del) and remove the suggestion (ins)
        const del = el.querySelector('del');
        const ins = el.querySelector('ins');
        if (del && ins) {
          const delParent = del.parentNode;
          if (delParent) {
            while (del.firstChild) {
              delParent.insertBefore(del.firstChild, del);
            }
            delParent.removeChild(del);
          }
          if (ins.parentNode) ins.parentNode.removeChild(ins);
        }
      } else {
        // NOT locked - Unwrap the element if it's a span or dedicated highlight wrapper
        
        // First handle suggestions if they are inside this element
        const del = el.querySelector('del');
        const ins = el.querySelector('ins');
        if (del && ins) {
          const parent = el.parentNode;
          if (parent) {
            // Move children of <del> (original content) to the parent, before 'el'
            while (del.firstChild) {
              parent.insertBefore(del.firstChild, el);
            }
            parent.removeChild(el); // remove the highlight wrapper entirely
          }
        } else if (el.hasAttribute('data-backspace-strike-id') || el.classList.contains('backspace-strike-text')) {
          // Strike-through deletion markers are reviewer artifacts; remove from published output.
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        } else if (el.tagName.toLowerCase() === 'span') {
          // Normal highlight/edited-by wrapper - Unwrap the span and keep children
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        } else {
          // If it's a block element (like <p>), just strip the attributes
          el.removeAttribute('data-comment-id');
          el.removeAttribute('data-suggestededit-id');
          el.removeAttribute('data-user-email');
          el.removeAttribute('data-edited-by');
          el.removeAttribute('data-edited-by-email');
          el.removeAttribute('title');
          el.classList.remove('highlighted-text', 'temp-comment-highlight', 'temp-suggestion-highlight', 'admin-edit', 'reviewer-edit');
        }
      }
    });

    // 2. Cleanup any remaining highlight classes on any elements
    const remainingHighlights = doc.querySelectorAll(
      '.highlighted-text, .temp-comment-highlight, .temp-suggestion-highlight, .admin-edit, .reviewer-edit, .backspace-strike-text, [data-backspace-strike-id], [data-user-email], [data-edited-by], [data-edited-by-email], [title^="Edited by"]'
    );
    remainingHighlights.forEach(el => {
      el.classList.remove('highlighted-text', 'temp-comment-highlight', 'temp-suggestion-highlight', 'admin-edit', 'reviewer-edit', 'backspace-strike-text');
      if (el.classList.length === 0) el.removeAttribute('class');
      if (el.hasAttribute('title')) {
         el.removeAttribute('title');
      }
      el.removeAttribute('data-user-email');
      el.removeAttribute('data-edited-by');
      el.removeAttribute('data-edited-by-email');
      el.removeAttribute('data-backspace-strike-id');
      el.removeAttribute('data-strike-created-by-id');
      el.removeAttribute('data-strike-created-by-email');
      const style = el.getAttribute('style') || '';
      if (style) {
        const cleanedStyle = style
          .split(';')
          .map(s => s.trim())
          .filter(Boolean)
          .filter(s => {
            const lower = s.toLowerCase();
            return !lower.startsWith('text-decoration') &&
                   !lower.startsWith('-webkit-text-decoration-color') &&
                   !lower.startsWith('background');
          })
          .join('; ');
        if (cleanedStyle) el.setAttribute('style', cleanedStyle);
        else el.removeAttribute('style');
      }
    });

    // 3. Remove edited-by metadata attributes/tooltips from any remaining nodes.
    const editedByAttrs = doc.querySelectorAll(
      '[data-user-email], [data-edited-by], [data-edited-by-email], [title^="Edited by"]'
    );
    editedByAttrs.forEach(el => {
      el.removeAttribute('data-user-email');
      el.removeAttribute('data-edited-by');
      el.removeAttribute('data-edited-by-email');
      if ((el.getAttribute('title') || '').startsWith('Edited by')) {
        el.removeAttribute('title');
      }
      const style = el.getAttribute('style') || '';
      if (style) {
        const cleanedStyle = style
          .split(';')
          .map(s => s.trim())
          .filter(Boolean)
          .filter(s => {
            const lower = s.toLowerCase();
            return !lower.startsWith('text-decoration') &&
                   !lower.startsWith('-webkit-text-decoration-color');
          })
          .join('; ');
        if (cleanedStyle) el.setAttribute('style', cleanedStyle);
        else el.removeAttribute('style');
      }
    });

    // 4. Final safety pass: NEVER remove an element with data-locked="true"
    // This is a redundancy check to ensure no previous step accidentally queued it for removal
    
    // 5. Cleanup empty spans (if any were created/left by mistake)
    const allSpans = doc.querySelectorAll('span');
    allSpans.forEach(span => {
      const isLocked = span.getAttribute('data-locked') === 'true' || 
                       span.classList.contains('locked-text') || 
                       span.classList.contains('locked');
      
      // Only unwrap spans that are NOT locked and have no attributes
      if (!isLocked && !span.hasAttributes()) {
        const parent = span.parentNode;
        if (parent) {
          while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
          }
          parent.removeChild(span);
        }
      }
    });

    return doc.body.innerHTML;
  } catch (e) {
    console.error('Error stripping highlights:', e);
    // Fallback regex (SAFER: avoids stripping spans that might be locked)
    let cleaned = html.replace(/<span\s+data-(?:comment|suggestededit)-id="[^"]*"\s*>([\s\S]*?)<\/span>/gi, '$1');
    cleaned = cleaned.replace(/<span\s+class="(?:admin-edit|reviewer-edit)"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
    cleaned = cleaned.replace(/<span[^>]*(?:data-backspace-strike-id|class="[^"]*backspace-strike-text[^"]*")[^>]*>[\s\S]*?<\/span>/gi, '');
    cleaned = cleaned.replace(/\sdata-user-email="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\sdata-edited-by="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\sdata-edited-by-email="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\stitle="Edited by:[^"]*"/gi, '');
    cleaned = cleaned.replace(/\sdata-strike-created-by-id="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\sdata-strike-created-by-email="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\stitle="[^"]*"/gi, '');
    return cleaned;
  }
};

/**
 * Counts the total number of blank fields (3 or more underscores) in an HTML string.
 * It only counts underscores within text nodes to avoid matching attributes or tags.
 * 
 * @param {string} html - The HTML content to search
 * @returns {number} The count of blank fields
 */
export const countBlanksInHtml = (html) => {
  if (!html || typeof html !== 'string') return 0;
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const BLANK_REGEX = /_{3,}/g;
    let count = 0;

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text) {
          const matches = text.match(BLANK_REGEX);
          if (matches) count += matches.length;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip unwanted tags
        const tagName = node.tagName.toLowerCase();
        if (!['script', 'style', 'meta', 'link'].includes(tagName)) {
          Array.from(node.childNodes).forEach(walk);
        }
      }
    };

    walk(doc.body);
    return count;
  } catch (e) {
    console.error('Error counting blanks:', e);
    return 0;
  }
};

/**
 * Counts table dropdown option fields in an HTML string.
 *
 * @param {string} html - The HTML content to search
 * @returns {number} The count of dropdown fields
 */
export const countDropdownsInHtml = (html) => {
  if (!html || typeof html !== 'string') return 0;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let count = 0;

    doc.querySelectorAll('select.cell-dropdown').forEach(() => {
      count += 1;
    });

    return count;
  } catch (e) {
    console.error('Error counting dropdowns:', e);
    return 0;
  }
};

/**
 * Prepares template data for publication by stripping comments and highlights.
 * 
 * @param {object} template - The template object containing content and comments
 * @returns {object} The cleaned template data
 */
export const prepareTemplateForPublication = (template) => {
  if (!template) return template;

  let rawHtml = '';

  // 1) Primary source: comments column (editor saves latest edits here during review/revise)
  if (template.comments) {
    try {
      const parsed = typeof template.comments === 'string' ? JSON.parse(template.comments) : template.comments;
      if (parsed && typeof parsed === 'object') {
        if (parsed.content) rawHtml = parsed.content;
      } else if (typeof parsed === 'string' && parsed.includes('<')) {
        rawHtml = parsed;
      }
    } catch (e) {
      if (typeof template.comments === 'string' && template.comments.includes('<')) {
        rawHtml = template.comments;
      }
    }
  }

  // 2) Fallback: content column
  if (!rawHtml && template.content) {
    try {
      const parsed = typeof template.content === 'string' ? JSON.parse(template.content) : template.content;
      if (parsed && typeof parsed === 'object') {
        if (parsed.content) {
          rawHtml = parsed.content;
        } else if (parsed.sections && Array.isArray(parsed.sections)) {
          // Join sections without commas
          rawHtml = parsed.sections.map(s => `<h3>${s.title || ''}</h3><div>${s.content || ''}</div>`).join('');
        } else if (typeof parsed === 'string' && parsed.includes('<')) {
          rawHtml = parsed;
        }
      } else if (typeof parsed === 'string' && parsed.includes('<')) {
        rawHtml = parsed;
      }
    } catch (parseError) {
      if (typeof template.content === 'string') {
        rawHtml = template.content;
      }
    }
  }

  // Fallback if completely empty
  if (!rawHtml) {
    rawHtml = template.content || '';
  }

  // Ensure rawHtml is a string to prevent comma injection from arrays
  if (Array.isArray(rawHtml)) {
    rawHtml = rawHtml.join('');
  }

  // Clean the main content
  const cleanedContent = stripCommentHighlights(rawHtml);

  // Clean the content inside the comments object if it exists
  // PRESERVE metadata like headerHTML, footerHTML, logo, logoText
  let originalCommentsData = {};
  if (template.comments) {
    try {
      originalCommentsData = typeof template.comments === 'string' 
        ? JSON.parse(template.comments) 
        : template.comments;
    } catch (e) {
      console.warn("Could not parse original comments for metadata preservation", e);
    }
  }

  let cleanedComments = {
    ...originalCommentsData, // Preserve all metadata
    content: cleanedContent,
    comments: [], // Clear all comments
    suggestions: [], // Clear all suggestions
    lastPublished: new Date().toISOString()
  };

  return {
    ...template,
    content: cleanedContent,
    comments: cleanedComments
  };
};

/**
 * Prepares a document row for publication (strip highlights; clear comments/suggestions in elements).
 * @param {object} doc - Row from GET /api/get_document (normalized) or raw documents row
 * @returns {{ content: string, elements: string }}
 */
export const prepareDocumentForPublication = (doc) => {
  if (!doc) return { content: '{}', elements: '{}' };

  let html = '';
  try {
    const commentsMeta = doc.comments
      ? typeof doc.comments === 'string'
        ? JSON.parse(doc.comments)
        : doc.comments
      : null;
    if (commentsMeta?.content) html = commentsMeta.content;
  } catch (e) {
    /* ignore */
  }

  if (!html && doc.content) {
    try {
      const c = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
      if (c && typeof c === 'object' && c.content) html = c.content;
      else if (typeof doc.content === 'string' && doc.content.trim().startsWith('<')) html = doc.content;
    } catch (e) {
      if (typeof doc.content === 'string') html = doc.content;
    }
  }

  const cleanedHtml = stripCommentHighlights(html || '');

  let contentObj = {};
  try {
    contentObj =
      typeof doc.content === 'string' ? JSON.parse(doc.content || '{}') : doc.content || {};
  } catch (e) {
    contentObj = { content: cleanedHtml };
  }
  contentObj.content = cleanedHtml;

  let elements = {};
  try {
    elements =
      typeof doc.elements === 'string' ? JSON.parse(doc.elements || '{}') : doc.elements || {};
  } catch (e) {
    elements = {};
  }

  const newElements = {
    ...elements,
    comments: [],
    suggestedEdits: []
  };

  return {
    content: JSON.stringify(contentObj),
    elements: JSON.stringify(newElements)
  };
};
