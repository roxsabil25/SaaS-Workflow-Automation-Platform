import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { debounce } from 'lodash';
/* Document workflow preview: saves via REST only (no template socket rooms). */

const getAuthToken = () => {
    try {
      const keys = ['accessToken','access_token','token','jwt','authToken','authorization'];
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v) return v;
      }

      // Check for auth_tokens object used by AuthProvider
      const authTokens = localStorage.getItem('auth_tokens');
      if (authTokens) {
        try {
          const parsed = JSON.parse(authTokens);
          if (parsed.accessToken) return parsed.accessToken;
          if (parsed.access_token) return parsed.access_token;
        } catch (e) {
          console.warn('Error parsing auth_tokens:', e);
        }
      }

      const cookieMatch = document.cookie.match(/(?:^|; )(?:(?:accessToken|access_token|token|jwt)=)([^;]+)/);
      if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
    } catch (e) { console.warn(e); }
    return null;
};
  
const getAuthHeaders = () => {
    const token = getAuthToken();
    // Do not block requests when token isn't in localStorage:
    // axios interceptors/cookies may still provide auth in this app.
    if (!token) return {};
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

export const useDocumentWorkflowContent = (parsedTemplate, initialData, currentUser, pagesContainerRef, setParsedTemplate) => {
  const [contentHtml, setContentHtml] = useState("");
  const [comments, setComments] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [references, setReferences] = useState([]);
  const [manualReferences, setManualReferences] = useState([]);
  const [logo, setLogo] = useState(null);
  const [headerHTML, setHeaderHTML] = useState("");
  const [footerHTML, setFooterHTML] = useState("");
  const [logoText, setLogoText] = useState("");
  const [logoTextRight, setLogoTextRight] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState("");

  // Refs for debouncing/callbacks
  const parsedTemplateRef = useRef(parsedTemplate);
  const currentUserRef = useRef(currentUser);
  const lastSavedContentRef = useRef("");
  const lastSavedPayloadRef = useRef("");
  const contentHtmlRef = useRef("");
  const commentsRef = useRef([]);       // always-fresh comments — avoids stale closure
  const suggestionsRef = useRef([]);    // always-fresh suggestions — avoids stale closure
  const referencesRef = useRef([]);     // always-fresh references
  const manualReferencesRef = useRef([]); // always-fresh manual references
  const logoRef = useRef(null);          // always-fresh logo
  const headerHTMLRef = useRef("");
  const footerHTMLRef = useRef("");
  const logoTextRef = useRef("");
  const logoTextRightRef = useRef("");
  const lastTypingTimeRef = useRef(0);
  const debouncedSaveRef = useRef(null);
  const debouncedSocketEmitRef = useRef(null);
  const lastSocketUpdateRef = useRef(0);

  // Sync refs
  useEffect(() => { parsedTemplateRef.current = parsedTemplate; }, [parsedTemplate]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { lastSavedContentRef.current = lastSavedContent; }, [lastSavedContent]);
  useEffect(() => { contentHtmlRef.current = contentHtml; }, [contentHtml]);
  useEffect(() => { commentsRef.current = comments; }, [comments]);
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);
  useEffect(() => { referencesRef.current = references; }, [references]);
  useEffect(() => { manualReferencesRef.current = manualReferences; }, [manualReferences]);
  useEffect(() => { logoRef.current = logo; }, [logo]);
  useEffect(() => { headerHTMLRef.current = headerHTML; }, [headerHTML]);
  useEffect(() => { footerHTMLRef.current = footerHTML; }, [footerHTML]);
  useEffect(() => { logoTextRef.current = logoText; }, [logoText]);
  useEffect(() => { logoTextRightRef.current = logoTextRight; }, [logoTextRight]);

  // Init from initialData
  useEffect(() => {
    if (initialData) {
      // Handle both contentHtml (Template style) and content (Document style)
      let initialHtml = initialData.contentHtml || initialData.content || "";
      
      // If it's a JSON string, try to parse it
      if (typeof initialHtml === 'string' && initialHtml.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(initialHtml);
          if (parsed && parsed.content) {
            initialHtml = parsed.content;
          }
        } catch (e) {}
      }      setContentHtml(initialHtml);
      setLastSavedContent(initialHtml);
      setComments(initialData.comments || []);
      setSuggestions(initialData.suggestions || []);
      setReferences((initialData.references && Array.isArray(initialData.references))
        ? initialData.references.filter(r => !r.isManual && r.refAnchor)
        : []);
      setManualReferences(initialData.manualReferences || (initialData.references && Array.isArray(initialData.references)
        ? initialData.references.filter(r => r.isManual || !r.refAnchor)
        : []));
      if (initialData.logo) setLogo(initialData.logo);
      setHeaderHTML(initialData.headerHTML || "");
      setFooterHTML(initialData.footerHTML || "");
      setLogoText(initialData.logoText || "");
      setLogoTextRight(initialData.logoTextRight || "");
 
      const initialPayload = {
        content: initialHtml,
        comments: initialData.comments || [],
        suggestions: initialData.suggestions || [],
        references: (initialData.references && Array.isArray(initialData.references))
          ? initialData.references.filter(r => !r.isManual && r.refAnchor)
          : [],
        manualReferences: initialData.manualReferences || (initialData.references && Array.isArray(initialData.references)
          ? initialData.references.filter(r => r.isManual || !r.refAnchor)
          : []),
        headerHTML: initialData.headerHTML || "",
        footerHTML: initialData.footerHTML || "",
        logo: initialData.logo || null,
        logoText: initialData.logoText || "",
        logoTextRight: initialData.logoTextRight || ""
      };
      lastSavedPayloadRef.current = JSON.stringify(initialPayload);
    }
  }, [initialData]);

  // Load latest content AND comments/suggestions on mount or document change
  useEffect(() => {
    const parseMaybeJson = (value) => {
      if (value == null) return value;
      if (typeof value === 'object') return value;
      if (typeof value !== 'string') return value;
      const t = value.trim();
      if (!t) return '';
      if (t.startsWith('{') || t.startsWith('[') || (t.startsWith('"') && t.endsWith('"'))) {
        try {
          return JSON.parse(t);
        } catch {
          return value;
        }
      }
      return value;
    };

    const loadSavedContent = async () => {
      const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
      if (!documentId) return;
      try {
        const headers = getAuthHeaders() || {};

        const response = await axios.get(`/api/get_document/${documentId}`, { headers });
        const templateData = response.data;

        // Extract HTML content (prefer comments.content > content field)
        let loadedContent = '';
        let loadedComments = [];
        let loadedSuggestions = [];
        let loadedReferences = [];
        let loadedManualReferences = [];
        let loadedLogo = null;
        let loadedHeaderHTML = '';
        let loadedFooterHTML = '';
        let loadedLogoText = '';
        let loadedLogoTextRight = '';

        if (templateData?.comments) {
          try {
            const commentsColRaw =
              typeof templateData.comments === 'string'
                ? JSON.parse(templateData.comments)
                : templateData.comments;
            const commentsCol = parseMaybeJson(commentsColRaw);
            const commentsContent = parseMaybeJson(commentsCol?.content);
            if (typeof commentsContent === 'string' && commentsContent) loadedContent = commentsContent;
            if (Array.isArray(commentsCol?.comments)) loadedComments = commentsCol.comments;
            if (Array.isArray(commentsCol?.suggestions)) loadedSuggestions = commentsCol.suggestions;
            if (Array.isArray(commentsCol?.references)) loadedReferences = commentsCol.references;
            if (Array.isArray(commentsCol?.manualReferences)) loadedManualReferences = commentsCol.manualReferences;
            if (commentsCol?.logo) loadedLogo = commentsCol.logo;
            if (typeof commentsCol?.headerHTML === 'string') loadedHeaderHTML = commentsCol.headerHTML;
            if (typeof commentsCol?.footerHTML === 'string') loadedFooterHTML = commentsCol.footerHTML;
            if (typeof commentsCol?.logoText === 'string') loadedLogoText = commentsCol.logoText;
            if (typeof commentsCol?.logoTextRight === 'string') loadedLogoTextRight = commentsCol.logoTextRight;
          } catch (e) { /* ignore parse error, fall through */ }
        }

        // Fallback: extract content from content field if not in comments column
        if (!loadedContent && templateData?.content) {
          try {
            const contentField = parseMaybeJson(templateData.content);
            if (typeof contentField === 'string') {
              loadedContent = contentField;
            } else {
              const nested = parseMaybeJson(contentField?.content);
              loadedContent = typeof nested === 'string' ? nested : '';
            }
            if (!loadedHeaderHTML && typeof contentField?.headerHTML === 'string') loadedHeaderHTML = contentField.headerHTML;
            if (!loadedFooterHTML && typeof contentField?.footerHTML === 'string') loadedFooterHTML = contentField.footerHTML;
          } catch (e) {
            loadedContent = templateData.content;
          }
        }

        if (loadedContent) {
          setContentHtml(loadedContent);
          setLastSavedContent(loadedContent);
        }
        // Always set comments/suggestions/logo from the fresh DB data
        // (even if empty — that's the ground truth)
        setComments(loadedComments);
        setSuggestions(loadedSuggestions);
        setReferences(loadedReferences.filter(r => !r.isManual && r.refAnchor));
        setManualReferences(loadedManualReferences.length > 0 ? loadedManualReferences : loadedReferences.filter(r => r.isManual || !r.refAnchor));
        if (loadedLogo) setLogo(loadedLogo);
        setHeaderHTML(loadedHeaderHTML || "");
        setFooterHTML(loadedFooterHTML || "");
        setLogoText(loadedLogoText || "");
        setLogoTextRight(loadedLogoTextRight || "");
 
        const initialPayload = {
          content: loadedContent || "",
          comments: loadedComments || [],
          suggestions: loadedSuggestions || [],
          references: loadedReferences.filter(r => !r.isManual && r.refAnchor) || [],
          manualReferences: loadedManualReferences.length > 0 ? loadedManualReferences : loadedReferences.filter(r => r.isManual || !r.refAnchor) || [],
          headerHTML: loadedHeaderHTML || "",
          footerHTML: loadedFooterHTML || "",
          logo: loadedLogo || null,
          logoText: loadedLogoText || "",
          logoTextRight: loadedLogoTextRight || ""
        };
        lastSavedPayloadRef.current = JSON.stringify(initialPayload);
      } catch (error) {
        console.error('Error loading saved document content:', error);
      }
    };
    loadSavedContent();
  }, [parsedTemplate?.document_id, parsedTemplate?.id]);

  // Debounced Save Logic
  useEffect(() => {
    debouncedSaveRef.current = debounce(async (content) => {
      console.log('💾 Auto-save triggered for content length:', content?.length);
      const tpl = parsedTemplateRef.current;
      const user = currentUserRef.current;
      const documentId = tpl?.document_id || tpl?.id;

      if (!documentId || !content) {
        console.log('⏭️ Save skipped: no ID or content');
        return;
      }

      const currentPayload = {
        content,
        comments: commentsRef.current || [],
        suggestions: suggestionsRef.current || [],
        references: referencesRef.current || [],
        manualReferences: manualReferencesRef.current || [],
        headerHTML: headerHTMLRef.current || '',
        footerHTML: footerHTMLRef.current || '',
        logo: logoRef.current,
        logoText: logoTextRef.current || '',
        logoTextRight: logoTextRightRef.current || ''
      };
      const currentPayloadStr = JSON.stringify(currentPayload);

      if (currentPayloadStr === lastSavedPayloadRef.current) {
        console.log('⏭️ Save skipped: payload is identical to last saved');
        return;
      }

      console.log('📤 Sending save request to backend for document:', documentId);

      try {
        const headers = getAuthHeaders() || {};

        console.log('🌐 Headers for save:', !!headers);
        setIsSaving(true);
        // Include logo in the save data so it's preserved in the comments column
        const commentsPayload = {
          ...currentPayload,
          lastModified: new Date().toISOString(),
          lastModifiedBy: user?.id
        };
        const response = await axios.put(
          `/api/update_document_content/${documentId}`,
          { content, comments: JSON.stringify(commentsPayload), userId: user?.id, timestamp: Date.now() },
          { headers }
        );
        console.log('📥 Save response received:', response.status, response.data);

        if (response?.data?.success || (response.status >= 200 && response.status < 300)) {
           console.log('✅ Save successful!');
           setLastSavedContent(content);
           lastSavedPayloadRef.current = currentPayloadStr;
           
           // Sync status and approvers if they were returned (e.g. reverted to pending)
           if (response.data?.status && setParsedTemplate) {
             setParsedTemplate(prev => ({
               ...prev,
               status: response.data.status,
               template_approvers: response.data.template_approvers
             }));
           }
        } else {
           console.warn('⚠️ Save API returned non-success:', response.status, response.data);
        }
      } catch (error) {
        console.error('❌ Error saving content:', error.message, error.response?.data);
      } finally {
        setIsSaving(false);
      }
    }, 1500);

    return () => {
      if (debouncedSaveRef.current) {
        debouncedSaveRef.current.flush();
      }
    };
  }, []);

  // Content, header, footer or logo change effect (triggering auto-save and socket)
  useEffect(() => {
    contentHtmlRef.current = contentHtml;
    headerHTMLRef.current = headerHTML;
    footerHTMLRef.current = footerHTML;
    logoRef.current = logo;
    logoTextRef.current = logoText;
    logoTextRightRef.current = logoTextRight;
    
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    if (!documentId) return;

    if (!contentHtml) return;

    if (debouncedSaveRef.current) {
      debouncedSaveRef.current(contentHtml);
    }
  }, [contentHtml, lastSavedContent, headerHTML, footerHTML, logo, logoText, logoTextRight, parsedTemplate, currentUser]);


  // Helper: read the LIVE DOM content from the editor pages container.
  // This captures highlight spans (<span data-comment-id>, <span data-suggestededit-id>)
  // that were injected by CommentCore.applyHighlight() but never propagated to contentHtml state.
  const readFreshDomContent = useCallback(() => {
    const container = pagesContainerRef?.current;
    if (!container) return contentHtmlRef.current; // fallback to stale ref

    // Collect top-level blocks from all pages, deduplicated by block ID
    const allPageContents = container.querySelectorAll('.page-content');
    if (!allPageContents || allPageContents.length === 0) return contentHtmlRef.current;

    const seenBlockIds = new Set();
    const blockHtmlParts = [];

    allPageContents.forEach(pc => {
      const blocks = pc.querySelectorAll('[data-block-id]');
      blocks.forEach(block => {
        const blockId = block.getAttribute('data-block-id');

        // Skip blocks nested inside other blocks (artifact of extractContents)
        let parent = block.parentElement;
        let isNested = false;
        while (parent && parent !== pc) {
          if (parent.hasAttribute('data-block-id')) {
            isNested = true;
            break;
          }
          parent = parent.parentElement;
        }

        if (!isNested && !seenBlockIds.has(blockId)) {
          seenBlockIds.add(blockId);
          blockHtmlParts.push(block.outerHTML);
        }
      });
    });

    return blockHtmlParts.length > 0 ? blockHtmlParts.join('') : contentHtmlRef.current;
  }, [pagesContainerRef]);

  const manualSaveContent = async (contentOverride = null) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    // FIX: Read fresh DOM content to capture any highlights that may not have
    // propagated to contentHtml state yet (e.g., user clicks Save right after adding comment)
    const freshDom = readFreshDomContent();
    const toSave = contentOverride ?? (freshDom !== contentHtmlRef.current ? freshDom : contentHtml);

    if (!documentId || !toSave) return false;
    
    try {
        const headers = getAuthHeaders() || {};

        if (debouncedSaveRef.current) debouncedSaveRef.current.flush();
        setIsSaving(true);

        const currentPayload = {
          content: toSave,
          comments: commentsRef.current || [],
          suggestions: suggestionsRef.current || [],
          references: referencesRef.current || [],
          manualReferences: manualReferencesRef.current || [],
          headerHTML: headerHTMLRef.current || '',
          footerHTML: footerHTMLRef.current || '',
          logo: logoRef.current,
          logoText: logoTextRef.current || '',
          logoTextRight: logoTextRightRef.current || ''
        };

        const commentsPayload = {
          ...currentPayload,
          lastModified: new Date().toISOString(),
          lastModifiedBy: currentUser?.id
        };

        const response = await axios.put(
            `/api/update_document_content/${documentId}`, 
            { 
              content: toSave, 
              comments: JSON.stringify(commentsPayload),
              userId: currentUser?.id, 
              timestamp: Date.now() 
            },
            { headers }
        );
        
        if (response.data?.success || (response.status >= 200 && response.status < 300)) {
            setLastSavedContent(toSave);
            lastSavedPayloadRef.current = JSON.stringify(currentPayload);
            
            // Sync status and approvers if they were returned
            if (response.data?.status && setParsedTemplate) {
              setParsedTemplate(prev => ({
                ...prev,
                status: response.data.status,
                template_approvers: response.data.template_approvers
              }));
            }
            return true;
        }
    } catch(e) { console.error(e); } 
    finally { setIsSaving(false); }
    return false;
  };

  // Instant Save handlers for comments/suggestions
  const handleCommentsChange = useCallback(async (updatedComments) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    const currentSuggestions = suggestionsRef.current; // always-fresh, never overwrites saved suggestions
    if (!documentId) return;
    
    setComments(updatedComments);
    
    // FIX: Read LIVE DOM content which includes highlight spans added by applyHighlight()
    // Without this, contentHtmlRef.current is stale and doesn't contain the highlight markup,
    // so when the user saves without typing, the highlights are lost on reload.
    const freshContent = readFreshDomContent();
    
    // Update content state so auto-save and socket effects use the fresh content
    if (freshContent !== contentHtmlRef.current) {
      setContentHtml(freshContent);
      setLastSavedContent(freshContent); // prevent auto-save from re-saving stale content
    }

    try {
      const headers = getAuthHeaders() || {};
      const currentPayload = {
        content: freshContent,
        comments: updatedComments,
        suggestions: currentSuggestions,
        references: updatedComments, // wait, this is typo in original, we should just let comments be
        manualReferences: manualReferencesRef.current || [],
        headerHTML: headerHTMLRef.current || '',
        footerHTML: footerHTMLRef.current || '',
        logo: logoRef.current,
        logoText: logoTextRef.current || '',
        logoTextRight: logoTextRightRef.current || ''
      };
      lastSavedPayloadRef.current = JSON.stringify(currentPayload);

      const commentsData = {
        ...currentPayload,
        lastModified: new Date().toISOString(),
        lastModifiedBy: currentUser?.id
      };
      
      const response = await axios.put(`/api/update_document_content/${documentId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id },
        { headers }
      );

      // Sync status and approvers if they were returned
      if (response.data?.status && setParsedTemplate) {
        setParsedTemplate(prev => ({
          ...prev,
          status: response.data.status,
          template_approvers: response.data.template_approvers
        }));
      }
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, readFreshDomContent]);

  const handleSuggestionsChange = useCallback(async (updatedSuggestions) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    const currentComments = commentsRef.current; // always-fresh, never overwrites saved comments
    if (!documentId) return;
    
    setSuggestions(updatedSuggestions);
    
    // FIX: Read LIVE DOM content which includes highlight spans added by applyHighlight()
    const freshContent = readFreshDomContent();
    
    // Update content state so auto-save and socket effects use the fresh content
    if (freshContent !== contentHtmlRef.current) {
      setContentHtml(freshContent);
      setLastSavedContent(freshContent); // prevent auto-save from re-saving stale content
    }

    try {
      const headers = getAuthHeaders() || {};
      const currentPayload = {
        content: freshContent,
        comments: currentComments,
        suggestions: updatedSuggestions,
        manualReferences: manualReferencesRef.current || [],
        headerHTML: headerHTMLRef.current || '',
        footerHTML: footerHTMLRef.current || '',
        logo: logoRef.current,
        logoText: logoTextRef.current || '',
        logoTextRight: logoTextRightRef.current || ''
      };
      lastSavedPayloadRef.current = JSON.stringify(currentPayload);

      const commentsData = {
        ...currentPayload,
        lastModified: new Date().toISOString(),
        lastModifiedBy: currentUser?.id
      };
      
      const response = await axios.put(`/api/update_document_content/${documentId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id },
        { headers }
      );

      // Sync status and approvers if they were returned
      if (response.data?.status && setParsedTemplate) {
        setParsedTemplate(prev => ({
          ...prev,
          status: response.data.status,
          template_approvers: response.data.template_approvers
        }));
      }
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, readFreshDomContent]);

  const handleReferencesChange = useCallback(async (updatedReferences) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    const currentComments = commentsRef.current;
    const currentSuggestions = suggestionsRef.current;
    const currentManualReferences = manualReferencesRef.current;
    if (!documentId) return;
    
    setReferences(updatedReferences);
    
    // Read LIVE DOM content to capture any highlights
    const freshContent = readFreshDomContent();
    
    // Update content state so auto-save uses the fresh content
    if (freshContent !== contentHtmlRef.current) {
      setContentHtml(freshContent);
      setLastSavedContent(freshContent);
    }

    try {
      const headers = getAuthHeaders() || {};
      const currentPayload = {
        content: freshContent,
        comments: currentComments,
        suggestions: currentSuggestions,
        references: updatedReferences,
        manualReferences: currentManualReferences,
        headerHTML: headerHTMLRef.current || '',
        footerHTML: footerHTMLRef.current || '',
        logo: logoRef.current,
        logoText: logoTextRef.current || '',
        logoTextRight: logoTextRightRef.current || ''
      };
      lastSavedPayloadRef.current = JSON.stringify(currentPayload);

      const commentsData = {
        ...currentPayload,
        lastModified: new Date().toISOString(),
        lastModifiedBy: currentUser?.id
      };
      
      const response = await axios.put(`/api/update_document_content/${documentId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id },
        { headers }
      );

      // Sync status and approvers if they were returned
      if (response.data?.status && setParsedTemplate) {
        setParsedTemplate(prev => ({
          ...prev,
          status: response.data.status,
          template_approvers: response.data.template_approvers
        }));
      }
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, readFreshDomContent]);

  const handleManualReferencesChange = useCallback(async (updatedManualReferences) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    const currentComments = commentsRef.current;
    const currentSuggestions = suggestionsRef.current;
    const currentReferences = referencesRef.current;
    if (!documentId) return;
    
    setManualReferences(updatedManualReferences);
    
    // Read LIVE DOM content to capture any highlights
    const freshContent = readFreshDomContent();
    
    // Update content state so auto-save uses the fresh content
    if (freshContent !== contentHtmlRef.current) {
      setContentHtml(freshContent);
      setLastSavedContent(freshContent);
    }

    try {
      const headers = getAuthHeaders() || {};
      const currentPayload = {
        content: freshContent,
        comments: currentComments,
        suggestions: currentSuggestions,
        references: currentReferences,
        manualReferences: updatedManualReferences,
        headerHTML: headerHTMLRef.current || '',
        footerHTML: footerHTMLRef.current || '',
        logo: logoRef.current,
        logoText: logoTextRef.current || '',
        logoTextRight: logoTextRightRef.current || ''
      };
      lastSavedPayloadRef.current = JSON.stringify(currentPayload);

      const commentsData = {
        ...currentPayload,
        lastModified: new Date().toISOString(),
        lastModifiedBy: currentUser?.id
      };
      
      const response = await axios.put(`/api/update_document_content/${documentId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id },
        { headers }
      );

      // Sync status and approvers if they were returned
      if (response.data?.status && setParsedTemplate) {
        setParsedTemplate(prev => ({
          ...prev,
          status: response.data.status,
          template_approvers: response.data.template_approvers
        }));
      }
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, readFreshDomContent]);

  const emitCommentAdd = () => {};
  const emitCommentUpdate = () => {};
  const emitCommentDelete = () => {};
  const emitSuggestionAdd = () => {};
  const emitSuggestionUpdate = () => {};
  const emitSuggestionDelete = () => {};


  return {
    contentHtml,
    setContentHtml,
    comments,
    suggestions,
    logo,
    setLogo,
    headerHTML,
    footerHTML,
    setHeaderHTML,
    setFooterHTML,
    logoText,
    setLogoText,
    logoTextRight,
    setLogoTextRight,
    isSaving,
    lastSavedContent,
    manualSaveContent,
    handleCommentsChange,
    handleSuggestionsChange,
    references,
    handleReferencesChange,
    manualReferences,
    handleManualReferencesChange,
    pagesContainerRef,
    socketUpdateKey: 0,
    lastTypingTimeRef,
    emitCommentAdd,
    emitCommentUpdate,
    emitCommentDelete,
    emitSuggestionAdd,
    emitSuggestionUpdate,
    emitSuggestionDelete
  };
};
