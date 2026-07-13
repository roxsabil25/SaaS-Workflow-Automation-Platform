import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { debounce } from 'lodash';
import { socket } from '../../../../../utils/SocketProvider';

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
    if (!token) return null;
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

export const useTemplateContent = (parsedTemplate, initialData, currentUser, pagesContainerRef, setParsedTemplate) => {
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
      setContentHtml(initialData.contentHtml || "");
      setLastSavedContent(initialData.contentHtml || "");
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
        content: initialData.contentHtml || "",
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

  // Load latest content AND comments/suggestions on mount or template change
  useEffect(() => {
    const loadSavedContent = async () => {
      const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
      if (!templateId) return;
      try {
        const headers = getAuthHeaders() || {};

        // Use the full template endpoint so we get the 'comments' column
        // which contains both the HTML content and the comments/suggestions arrays
        const response = await axios.get(`/api/get_template/${templateId}`, { headers });
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
            const commentsCol = typeof templateData.comments === 'string'
              ? JSON.parse(templateData.comments)
              : templateData.comments;
            if (commentsCol?.content) loadedContent = commentsCol.content;
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
            const contentField = typeof templateData.content === 'string' && templateData.content.trim().startsWith('{')
              ? JSON.parse(templateData.content)
              : templateData;
            loadedContent = contentField?.content || templateData.content;
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
        console.error('Error loading saved content:', error);
      }
    };
    loadSavedContent();
  }, [parsedTemplate?.id, parsedTemplate?.template_id]);

  // Debounced Save Logic
  useEffect(() => {
    debouncedSaveRef.current = debounce(async (content) => {
      console.log('💾 Auto-save triggered for content length:', content?.length);
      const tpl = parsedTemplateRef.current;
      const user = currentUserRef.current;
      const templateId = tpl?.id || tpl?.template_id;

      if (!templateId || !content) {
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

      console.log('📤 Sending save request to backend for template:', templateId);

      try {
        const headers = getAuthHeaders();
        if (!headers) return;

        console.log('🌐 Headers for save:', !!headers);
        setIsSaving(true);
        // Include logo in the save data so it's preserved in the comments column
        const commentsPayload = {
          ...currentPayload,
          lastModified: new Date().toISOString(),
          lastModifiedBy: user?.id
        };
        const response = await axios.put(
          `/api/update_template_content/${templateId}`,
          { content, comments: JSON.stringify(commentsPayload), userId: user?.id, timestamp: Date.now() },
          { headers }
        );
        console.log('📥 Save response received:', response.status, response.data);

        if (response?.data?.success || (response.status >= 200 && response.status < 300)) {
           console.log('✅ Save successful!');
           setLastSavedContent(content);
           lastSavedPayloadRef.current = currentPayloadStr;
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
    
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (!templateId) return;

    // Check if anything actually changed since last save
    const contentChanged = contentHtml && contentHtml !== lastSavedContent;
    // For header/footer/logo, we don't track 'lastSaved' individually in state, 
    // but the debounced save will handle the deduplication via commentsPayload comparison if we wanted.
    // For now, any change to these should at least attempt a debounced save.
    
    // We only trigger if at least content exists (to avoid saving empty templates)
    if (!contentHtml) return;

    if (debouncedSaveRef.current) {
      debouncedSaveRef.current(contentHtml);
    }

    if (!debouncedSocketEmitRef.current) {
        debouncedSocketEmitRef.current = debounce((content, hHTML, fHTML, tId, uId) => {
            socket.emit('updateTemplateContent', { 
                templateId: tId, 
                content,
                headerHTML: hHTML,
                footerHTML: fHTML,
                userId: uId,
                timestamp: Date.now()
            });
        }, 300);
    }
    debouncedSocketEmitRef.current(contentHtml, headerHTML, footerHTML, templateId, currentUser?.id);

    return () => {
      if (debouncedSocketEmitRef.current) {
        debouncedSocketEmitRef.current.flush();
      }
    };
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
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    // FIX: Read fresh DOM content to capture any highlights that may not have
    // propagated to contentHtml state yet (e.g., user clicks Save right after adding comment)
    const freshDom = readFreshDomContent();
    const toSave = contentOverride ?? (freshDom !== contentHtmlRef.current ? freshDom : contentHtml);

    if (!templateId || !toSave) return false;
    
    try {
        const headers = getAuthHeaders();
        if(!headers) return false;

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
            `/api/update_template_content/${templateId}`, 
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
            return true;
        }
    } catch(e) { console.error(e); } 
    finally { setIsSaving(false); }
    return false;
  };

  // Instant Save handlers for comments/suggestions
  const handleCommentsChange = useCallback(async (updatedComments) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    const currentSuggestions = suggestionsRef.current; // always-fresh, never overwrites saved suggestions
    if (!templateId) return;
    
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
      const headers = getAuthHeaders();
      if (!headers) return;
      const currentPayload = {
        content: freshContent,
        comments: updatedComments,
        suggestions: currentSuggestions,
        references: referencesRef.current || [],
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
      
      await axios.put(`/api/update_template_content/${templateId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id },
        { headers }
      );
      socket.emit('commentsUpdated', { templateId, comments: updatedComments });
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, readFreshDomContent]);

  const handleSuggestionsChange = useCallback(async (updatedSuggestions) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    const currentComments = commentsRef.current; // always-fresh, never overwrites saved comments
    if (!templateId) return;
    
    setSuggestions(updatedSuggestions);
    
    // FIX: Read LIVE DOM content which includes highlight spans added by applyHighlight()
    const freshContent = readFreshDomContent();
    
    // Update content state so auto-save and socket effects use the fresh content
    if (freshContent !== contentHtmlRef.current) {
      setContentHtml(freshContent);
      setLastSavedContent(freshContent); // prevent auto-save from re-saving stale content
    }

    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const currentPayload = {
        content: freshContent,
        comments: currentComments,
        suggestions: updatedSuggestions,
        references: referencesRef.current || [],
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
      
      await axios.put(`/api/update_template_content/${templateId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id },
        { headers }
      );
      socket.emit('suggestionsUpdated', { templateId, suggestions: updatedSuggestions });
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, readFreshDomContent]);

  // Socket Logic
  useEffect(() => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (!templateId) return;

    socket.emit('joinTemplate', { templateId, mode: 'preview' });
    socket.emit('joinTemplateRoom', {
        templateId,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.firstName} ${currentUser?.lastName}`,
        role: currentUser?.role
    });

    const handleContentUpdate = (data) => {
        if (data.userId !== currentUser?.id) {
             const now = Date.now();
             if (now - lastSocketUpdateRef.current < 1000) return;
             
             // If user is actively typing, don't overwrite their local state with socket updates
             if (now - lastTypingTimeRef.current < 3000) return; 

             lastSocketUpdateRef.current = now;

             if (data.content !== undefined && data.content !== contentHtmlRef.current) {
                setContentHtml(data.content);
                setLastSavedContent(data.content);
             }
             
             if (data.headerHTML !== undefined && data.headerHTML !== headerHTMLRef.current) {
                setHeaderHTML(data.headerHTML || "");
             }
             
             if (data.footerHTML !== undefined && data.footerHTML !== footerHTMLRef.current) {
                setFooterHTML(data.footerHTML || "");
             }
        }
    };
    
    // Comment/Suggestion handlers
    const handleCommentAdded = ({ comment }) => {
        setComments(prev => {
             const updated = [...prev, comment];
             handleCommentsChange(updated); 
             return updated; 
        });
    };
    const handleCommentUpdated = ({ commentId, updates }) => {
        setComments(prev => {
             const updated = prev.map(c => c.id === commentId ? { ...c, ...updates } : c);
             handleCommentsChange(updated);
             return updated;
        });
    };
    const handleCommentDeleted = ({ commentId }) => {
        setComments(prev => {
             const updated = prev.filter(c => c.id !== commentId);
             handleCommentsChange(updated);
             return updated;
        });
    };
    
    const handleSuggestionAdded = ({ suggestion }) => {
         setSuggestions(prev => {
             const updated = [...prev, suggestion];
             handleSuggestionsChange(updated);
             return updated;
         });
    };
    const handleSuggestionUpdated = ({ suggestionId, updates }) => {
         setSuggestions(prev => {
             const updated = prev.map(s => s.id === suggestionId ? { ...s, ...updates } : s);
             handleSuggestionsChange(updated);
             return updated;
         });
    };
    const handleSuggestionDeleted = ({ suggestionId }) => {
         setSuggestions(prev => {
             const updated = prev.filter(s => s.id !== suggestionId);
             handleSuggestionsChange(updated);
             return updated;
         });
    };

    socket.on('templateContentUpdated', handleContentUpdate);
    socket.on('templateContentUpdate', handleContentUpdate); // Listen to legacy event too
    
    socket.on('commentAdded', handleCommentAdded);
    socket.on('commentUpdated', handleCommentUpdated);
    socket.on('commentDeleted', handleCommentDeleted);
    socket.on('suggestionAdded', handleSuggestionAdded);
    socket.on('suggestionUpdated', handleSuggestionUpdated);
    socket.on('suggestionDeleted', handleSuggestionDeleted);

    socket.on('templateApproversUpdated', ({ templateId: updatedId, template_approvers, status }) => {
        if (setParsedTemplate && String(updatedId) === String(templateId)) {
            setParsedTemplate(prev => ({
                ...prev,
                template_approvers,
                status
            }));
        }
    });

    return () => {
        socket.off('templateContentUpdated', handleContentUpdate);
        socket.off('templateContentUpdate', handleContentUpdate);
        
        socket.off('commentAdded', handleCommentAdded);
        socket.off('commentUpdated', handleCommentUpdated);
        socket.off('commentDeleted', handleCommentDeleted);
        socket.off('suggestionAdded', handleSuggestionAdded);
        socket.off('suggestionUpdated', handleSuggestionUpdated);
        socket.off('suggestionDeleted', handleSuggestionDeleted);
        socket.off('templateApproversUpdated');
        
        socket.emit('leaveTemplate', { templateId });
        socket.emit('leaveTemplateRoom', { templateId });
    };

  }, [parsedTemplate?.id, parsedTemplate?.template_id]);

  // Emitters
  const emitCommentAdd = (comment) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('addComment', { templateId, comment });
  };
  const emitCommentUpdate = (commentId, updates) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('updateComment', { templateId, commentId, updates });
  };
  const emitCommentDelete = (commentId) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('deleteComment', { templateId, commentId });
  };
  const emitSuggestionAdd = (suggestion) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('addSuggestion', { templateId, suggestion });
  };
  const emitSuggestionUpdate = (suggestionId, updates) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('updateSuggestion', { templateId, suggestionId, updates });
  };
  const emitSuggestionDelete = (suggestionId) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('deleteSuggestion', { templateId, suggestionId });
  };

  const handleReferencesChange = useCallback(async (updatedReferences) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    const currentComments = commentsRef.current;
    const currentSuggestions = suggestionsRef.current;
    const currentManualReferences = manualReferencesRef.current;
    if (!templateId) return;
    
    setReferences(updatedReferences);
    
    // Read LIVE DOM content to capture any highlights
    const freshContent = readFreshDomContent();
    
    // Update content state so auto-save uses the fresh content
    if (freshContent !== contentHtmlRef.current) {
      setContentHtml(freshContent);
      setLastSavedContent(freshContent);
    }

    try {
      const headers = getAuthHeaders();
      if (!headers) return;
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
      
      await axios.put(`/api/update_template_content/${templateId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id },
        { headers }
      );
      socket.emit('referencesUpdated', { templateId, references: updatedReferences });
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, readFreshDomContent]);

  const handleManualReferencesChange = useCallback(async (updatedManualReferences) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    const currentComments = commentsRef.current;
    const currentSuggestions = suggestionsRef.current;
    const currentReferences = referencesRef.current;
    if (!templateId) return;
    
    setManualReferences(updatedManualReferences);
    
    // Read LIVE DOM content to capture any highlights
    const freshContent = readFreshDomContent();
    
    // Update content state so auto-save uses the fresh content
    if (freshContent !== contentHtmlRef.current) {
      setContentHtml(freshContent);
      setLastSavedContent(freshContent);
    }

    try {
      const headers = getAuthHeaders();
      if (!headers) return;
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
      
      await axios.put(`/api/update_template_content/${templateId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id },
        { headers }
      );
      socket.emit('manualReferencesUpdated', { templateId, manualReferences: updatedManualReferences });
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, readFreshDomContent]);


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
    lastTypingTimeRef,
    emitCommentAdd,
    emitCommentUpdate,
    emitCommentDelete,
    emitSuggestionAdd,
    emitSuggestionUpdate,
    emitSuggestionDelete
  };
};
