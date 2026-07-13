import { useState, useEffect } from 'react';
import axios from 'axios';
import { extractCommentsPayload } from './useTemplatePreviewState';

const getAuthToken = () => {
  try {
    const keys = ['accessToken', 'access_token', 'token', 'jwt', 'authToken', 'authorization'];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v) return v;
    }
    const authTokens = localStorage.getItem('auth_tokens');
    if (authTokens) {
      try {
        const parsed = JSON.parse(authTokens);
        if (parsed.accessToken) return parsed.accessToken;
        if (parsed.access_token) return parsed.access_token;
      } catch (e) {
        /* ignore */
      }
    }
  } catch (e) {
    /* ignore */
  }
  return null;
};

const getAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

/**
 * Loads a document in template-shaped form for DocumentPreview (same tabs as TemplatePreview).
 */
export const useDocumentWorkflowPreviewState = (document) => {
  const [loading, setLoading] = useState(true);
  const [parsedTemplate, setParsedTemplate] = useState(null);
  const [initialData, setInitialData] = useState({
    contentHtml: '',
    comments: [],
    suggestions: [],
    references: [],
    manualReferences: [],
    logo: null,
    headerHTML: '',
    footerHTML: '',
    logoText: '',
    logoTextRight: ''
  });

  useEffect(() => {
    const id = document?.document_id || document?.id;
    if (!id) {
      setParsedTemplate(null);
      setInitialData({
        contentHtml: '',
        comments: [],
        suggestions: [],
        references: [],
        manualReferences: [],
        logo: null,
        headerHTML: '',
        footerHTML: '',
        logoText: '',
        logoTextRight: ''
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: templateShaped } = await axios.get(`/api/get_document/${id}`, {
          headers: getAuthHeaders()
        });
        if (cancelled) return;

        const extractedData = extractCommentsPayload(templateShaped);
        // Document content can be persisted in multiple shapes; normalize aggressively for preview.
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

        let fallbackContent = '';
        const parsedContent = parseMaybeJson(templateShaped?.content);
        if (typeof parsedContent === 'string') {
          fallbackContent = parsedContent;
        } else if (parsedContent && typeof parsedContent === 'object') {
          const nested = parseMaybeJson(parsedContent.content);
          fallbackContent = typeof nested === 'string' ? nested : '';
        }
        const normalizedContentHtml =
          extractedData?.contentHtml && String(extractedData.contentHtml).trim()
            ? extractedData.contentHtml
            : fallbackContent;
        // Normalize template_approvers (handle string vs object)
        const templateApproversRaw = templateShaped.template_approvers;
        let templateApprovers = { reviewers: [], approvers: [] };
        if (templateApproversRaw) {
          if (typeof templateApproversRaw === 'string') {
            try {
              templateApprovers = JSON.parse(templateApproversRaw);
            } catch (e) {
              console.warn('Failed to parse template_approvers string', e);
            }
          } else if (typeof templateApproversRaw === 'object') {
            templateApprovers = templateApproversRaw;
          }
        }

        const parsed = {
          ...templateShaped,
          template_approvers: templateApprovers,
          contentHtml: normalizedContentHtml || '',
          parsedComments: extractedData.comments,
          parsedSuggestions: extractedData.suggestions,
          impact_assessment: typeof templateShaped.impact === 'string' ? JSON.parse(templateShaped.impact || '{}') : (templateShaped.impact || {})
        };

        // Mirror what useTemplatePreviewState does: parse required_approvers into the
        // `approvers` array so TemplateApproversTab can display the department config.
        // normalizeDocumentRowForClient already returns required_approvers as a parsed array,
        // but we need to also set the `approvers` field so existing checks work.
        let requiredApproversArray = [];
        try {
          const ra = templateShaped.required_approvers;
          if (Array.isArray(ra)) {
            requiredApproversArray = ra;
          } else if (typeof ra === 'string' && ra) {
            requiredApproversArray = JSON.parse(ra);
          }
        } catch (e) { /* ignore */ }
        parsed.approvers = requiredApproversArray;
        // Also surface individual user configs from template_approvers in the approvers array
        // if there are no department-level configs configured
        if (requiredApproversArray.length === 0 && templateApprovers) {
          const reviewers = Array.isArray(templateApprovers.reviewers) ? templateApprovers.reviewers : [];
          const approvers = Array.isArray(templateApprovers.approvers) ? templateApprovers.approvers : [];
          // Build a synthetic department list from the workflow users for display
          const deptSet = new Set();
          [...reviewers, ...approvers].forEach(u => {
            if (u.department) deptSet.add(u.department);
          });
          if (deptSet.size > 0) {
            parsed.approvers = Array.from(deptSet).map((dept, i) => ({ department: dept, stage: i + 1, mandatory: true }));
          }
        }

        setParsedTemplate(parsed);
        setInitialData({
          ...extractedData,
          contentHtml: normalizedContentHtml || '',
          logoText: extractedData.logoText || '',
          logoTextRight: extractedData.logoTextRight || ''
        });
      } catch (e) {
        console.error('useDocumentWorkflowPreviewState', e);
        if (!cancelled) {
          setParsedTemplate(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document?.document_id, document?.id]);

  return { loading, parsedTemplate, setParsedTemplate, initialData };
};
