import { useState, useEffect } from 'react';

// Helper functions (moved from original file to avoid duplication/loops)
const parseJsonSafe = (value, fallback = {}) => {
  try {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    const parsed = JSON.parse(value);
    return parsed;
  } catch (error) {
    if (typeof value === 'string' && value.trim().startsWith('<') && !value.trim().startsWith('{')) {
      return fallback;
    }
    return fallback;
  }
};

export const extractCommentsPayload = (template) => {
  let commentsData = {};
  let allComments = [];
  let allSuggestions = [];
  
  const separateCommentsData = parseJsonSafe(template.comments, {});
  
  if (separateCommentsData.content || separateCommentsData.comments || separateCommentsData.suggestions) {
    commentsData = separateCommentsData;
  } else {
    const contentData = parseJsonSafe(template.content, {});
    if (contentData.comments || contentData.suggestions) {
      commentsData = contentData;
    } else {
      commentsData = { content: template.content || '' };
    }
  }
  
  if (Array.isArray(commentsData.comments)) {
    allComments = commentsData.comments.map(comment => ({
      ...comment,
      id: comment.id || `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user: comment.user || comment.author || 'Unknown User',
      email: comment.email || comment.userEmail || '',
      text: comment.text || comment.content || '',
      timestamp: comment.timestamp || new Date().toISOString(),
      highlightedText: comment.highlightedText || comment.selectedText || null,
      fragmentId: comment.fragmentId || comment.id,
      avatar: comment.avatar || null,
      status: comment.status || 'open',
      replies: Array.isArray(comment.replies) ? comment.replies : [],
      type: comment.type || 'comment'
    }));
  }
  
  if (Array.isArray(commentsData.suggestions)) {
    allSuggestions = commentsData.suggestions.map(suggestion => ({
      ...suggestion,
      id: suggestion.id || `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user: suggestion.user || suggestion.author || 'Unknown User',
      email: suggestion.email || suggestion.userEmail || '',
      text: suggestion.text || suggestion.content || '',
      timestamp: suggestion.timestamp || new Date().toISOString(),
      highlightedText: suggestion.highlightedText || suggestion.selectedText || null,
      fragmentId: suggestion.fragmentId || suggestion.id,
      avatar: suggestion.avatar || null,
      status: suggestion.status || 'pending',
      replies: Array.isArray(suggestion.replies) ? suggestion.replies : [],
      type: suggestion.type || 'suggestededit'
    }));
  }
  
  let allReferences = [];
  let allManualReferences = [];
  if (Array.isArray(commentsData.references)) {
    allReferences = commentsData.references;
  }
  if (Array.isArray(commentsData.manualReferences)) {
    allManualReferences = commentsData.manualReferences;
  }

  let finalContent = '';
  if (commentsData.content) {
    finalContent = commentsData.content;
  } else if (template.content) {
    if (typeof template.content === 'string' && template.content.trim().startsWith('{')) {
      try {
        const contentJson = JSON.parse(template.content);
        finalContent = contentJson.content || template.content;
      } catch (e) {
        finalContent = template.content;
      }
    } else {
      finalContent = template.content;
    }
  } else {
    finalContent = '';
  }
  
  return {
    contentHtml: finalContent,
    comments: allComments,
    suggestions: allSuggestions,
    references: allReferences,
    manualReferences: allManualReferences,
    logo: separateCommentsData.logo || null,
    logoText: separateCommentsData.logoText || (separateCommentsData.logo && typeof separateCommentsData.logo === 'object' ? separateCommentsData.logo.text : '') || template.logoText || '',
    logoTextRight: separateCommentsData.logoTextRight || (separateCommentsData.logo && typeof separateCommentsData.logo === 'object' ? separateCommentsData.logo.textRight : '') || template.logoTextRight || '',
    headerHTML: separateCommentsData.headerHTML || template.headerHTML || '',
    footerHTML: separateCommentsData.footerHTML || template.footerHTML || ''
  };
};


export const useTemplatePreviewState = (template) => {
  const [loading, setLoading] = useState(true);
  
  const [parsedTemplate, setParsedTemplate] = useState(() => {
    if (template) {
      return {
        ...template,
        contentHtml: template.content || template.contentHtml || ''
      };
    }
    return {
      id: null,
      template_id: null,
      status: 'pending_review',
      contentHtml: '',
      template_approvers: { reviewers: [], approvers: [] },
      lockedElements: {},
      includeTableOfContents: false,
      allowAttachments: false
    };
  });

  const [initialData, setInitialData] = useState({
    contentHtml: '',
    comments: [],
    suggestions: [],
    references: [],
    manualReferences: []
  });

  useEffect(() => {
    const templateId = template?.id || template?.template_id;
    const currentId = parsedTemplate?.id || parsedTemplate?.template_id;
    
    // Only show loading spinner if we are switching to a completely different template
    if (templateId !== currentId) {
      setLoading(true);
    }

    if (!template) {
      setInitialData({
        contentHtml: '',
        comments: [],
        suggestions: [],
        references: [],
        manualReferences: [],
        logo: null,
        headerHTML: '',
        footerHTML: ''
      });
      setLoading(false);
      return;
    }

    let approvers = [];
    try {
      approvers = template.required_approvers ? JSON.parse(template.required_approvers) : [];
    } catch (e) { console.error("Error parsing parsed approvers", e); }
    
    let lockedElements = [];
    let includeTableOfContents = false;
    let allowAttachments = false;
    try {
      if (template.template_structure) {
        const structure = JSON.parse(template.template_structure);
        lockedElements = structure.locked_elements || [];
        includeTableOfContents = structure.includeTableOfContents || false;
        allowAttachments = structure.allowAttachments || false;
      }
    } catch (e) { console.error("Error parsing template structure", e); }
    
    const extractedData = extractCommentsPayload(template);
    
    let templateApprovers = { reviewers: [], approvers: [] };
    try {
      if (template.template_approvers) {
        templateApprovers = JSON.parse(template.template_approvers);
      }
    } catch (e) { console.error("Error parsing template_approvers", e); }
        
    const parsed = {
      ...template,
      approvers,
      template_approvers: templateApprovers,
      lockedElements,
      includeTableOfContents,
      allowAttachments,
      contentHtml: extractedData.contentHtml || '',
      parsedComments: extractedData.comments || [],
      parsedSuggestions: extractedData.suggestions || [],
      impact_assessment: typeof template.impact === 'string' ? JSON.parse(template.impact || '{}') : (template.impact || {})
    };
    
    setParsedTemplate(parsed);
    setInitialData(extractedData);
    
    setTimeout(() => setLoading(false), 0);
  }, [template]);

  return { loading, parsedTemplate, setParsedTemplate, initialData };
};
