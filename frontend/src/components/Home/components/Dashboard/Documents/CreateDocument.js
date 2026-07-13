import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { successAlert, errorAlert, toastAlert } from '../../../../../utils/alerts';
import {
  Card, Form, Input, Button, Select, DatePicker, Row, Col,
  Tag, Typography, Alert, Divider, Space, Tabs,
  Badge, Dropdown, Tooltip, message, Empty
} from 'antd';
import {
  PlusOutlined, CloseOutlined, FileTextOutlined,
  FileTextTwoTone, TeamOutlined as TeamOutlinedTwo,
  EditOutlined, FileSearchOutlined, LeftOutlined,
  RightOutlined, DownOutlined, HistoryOutlined,
  InfoCircleOutlined, SaveOutlined, PaperClipOutlined,
  BookOutlined, TeamOutlined
} from '@ant-design/icons';
import EditorPlaceholder from '../../../../EditorPlaceholder';
import { stripCommentHighlights, countBlanksInHtml } from '../../../../../utils/templateUtils';
import TemplateApproversModal from '../Templates/CreateTemplate/components/TemplateApproversModal';
import { useAutoSave } from '../Templates/CreateTemplate/hooks/useAutoSave';
import moment from 'moment';
import AttachmentsTab from '../../../../Unified/UnifiedTextEditor/Preview/components/AttachmentsTab';
import ReferencesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/ReferencesTab';
import TemplateRevisionHistoryTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateRevisionHistoryTab';
import ImpactAssessment from '../Templates/CreateTemplate/components/ImpactAssessment';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

const roleColors = {
  author: 'gold',
  editor: 'blue',
  commenter: 'green',
  viewer: 'default'
};

const DOC_REVIEWER_ROLE = 'document_reviewer';
const DOC_APPROVER_ROLE = 'document_approver';

// Helper function removed in favor of utility function

const extractTemplateContent = (template) => {
  if (!template) return { content: '', comments: [], suggestions: [], references: [], logo: null, logoText: '', logoTextRight: '' };

  let loadedData = {
    content: '',
    comments: [],
    suggestions: [],
    references: [],
    logo: null,
    logoText: '',
    logoTextRight: ''
  };

  // 1) Primary source: comments column (editor saves here during review/editing)
  if (template.comments) {
    try {
      const parsed = typeof template.comments === 'string' ? JSON.parse(template.comments) : template.comments;
      if (parsed && typeof parsed === 'object') {
        if (parsed.content || parsed.logo) {
          loadedData.content = parsed.content || '';
          loadedData.comments = parsed.comments || [];
          loadedData.suggestions = parsed.suggestions || [];
          loadedData.references = (parsed.references && Array.isArray(parsed.references))
            ? parsed.references.filter(r => !r.isManual && r.refAnchor)
            : [];
          loadedData.manualReferences = parsed.manualReferences || (parsed.references && Array.isArray(parsed.references)
            ? parsed.references.filter(r => r.isManual || !r.refAnchor)
            : []);
          loadedData.logo = parsed.logo || null;
          loadedData.headerHTML = parsed.headerHTML || '';
          loadedData.footerHTML = parsed.footerHTML || '';
          loadedData.logoText = parsed.logoText || '';
          loadedData.logoTextRight = parsed.logoTextRight || '';
        } else if (typeof parsed === 'string' && parsed.includes('<')) {
          loadedData.content = parsed;
        }
      } else if (typeof parsed === 'string' && parsed.includes('<')) {
        loadedData.content = parsed;
      }
    } catch (e) {
      if (typeof template.comments === 'string' && template.comments.includes('<')) {
        loadedData.content = template.comments;
      }
    }
  }

  // 2) Fallback: content column
  if (!loadedData.content && template.content) {
    try {
      const parsed = typeof template.content === 'string' ? JSON.parse(template.content) : template.content;
      if (parsed && typeof parsed === 'object') {
        if (parsed.content) {
          loadedData.content = parsed.content;
          if (parsed.logo) loadedData.logo = parsed.logo;
        } else if (parsed.sections && Array.isArray(parsed.sections)) {
          loadedData.content = parsed.sections.map(s => `<h3>${s.title || ''}</h3><div>${s.content || ''}</div>`).join('');
        }
      } else if (typeof parsed === 'string' && parsed.includes('<')) {
        loadedData.content = parsed;
      }
    } catch (parseError) {
      if (typeof template.content === 'string') {
        loadedData.content = template.content;
      }
    }
  }

  // Ensure content is a string
  if (Array.isArray(loadedData.content)) {
    loadedData.content = loadedData.content.join('');
  }

  loadedData.content = stripCommentHighlights(loadedData.content);
  return loadedData;
};

const extractDocumentContent = (doc) => {
  if (!doc) return { content: '', comments: [], suggestions: [], references: [], logo: null, logoText: '', logoTextRight: '' };

  let loadedData = {
    content: '',
    comments: [],
    suggestions: [],
    references: [],
    logo: null,
    logoText: '',
    logoTextRight: ''
  };

  if (doc.content) {
    try {
      const parsed = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
      if (parsed && typeof parsed === 'object') {
        loadedData.content = parsed.content || '';
        loadedData.references = (parsed.references && Array.isArray(parsed.references))
          ? parsed.references.filter(r => !r.isManual && r.refAnchor)
          : [];
        loadedData.manualReferences = parsed.manualReferences || (parsed.references && Array.isArray(parsed.references)
          ? parsed.references.filter(r => r.isManual || !r.refAnchor)
          : []);
        loadedData.logo = parsed.logo || null;
        loadedData.logoText = parsed.logoText || '';
        loadedData.logoTextRight = parsed.logoTextRight || '';
      } else {
        loadedData.content = String(doc.content);
      }
    } catch (e) {
      loadedData.content = String(doc.content);
    }
  }

  // Extract fallbacks from elements or comments
  if (doc.comments) {
    try {
      const parsedComments = typeof doc.comments === 'string' ? JSON.parse(doc.comments) : doc.comments;
      if (parsedComments) {
        if (parsedComments.headerHTML) loadedData.headerHTML = parsedComments.headerHTML;
        if (parsedComments.footerHTML) loadedData.footerHTML = parsedComments.footerHTML;
        if (parsedComments.logo) loadedData.logo = parsedComments.logo;
        if (parsedComments.logoText) loadedData.logoText = parsedComments.logoText;
        if (parsedComments.logoTextRight) loadedData.logoTextRight = parsedComments.logoTextRight;
        if (parsedComments.references) {
          loadedData.references = (parsedComments.references && Array.isArray(parsedComments.references))
            ? parsedComments.references.filter(r => !r.isManual && r.refAnchor)
            : [];
          loadedData.manualReferences = parsedComments.manualReferences || parsedComments.references.filter(r => r.isManual || !r.refAnchor);
        }
      }
    } catch (e) { }
  }

  if (doc.elements) {
    try {
      const parsedElements = typeof doc.elements === 'string' ? JSON.parse(doc.elements) : doc.elements;
      if (parsedElements) {
        if (parsedElements.headerHTML) loadedData.headerHTML = parsedElements.headerHTML;
        if (parsedElements.footerHTML) loadedData.footerHTML = parsedElements.footerHTML;
        if (parsedElements.logo) loadedData.logo = parsedElements.logo;
        if (parsedElements.logoText) loadedData.logoText = parsedElements.logoText;
        if (parsedElements.logoTextRight) loadedData.logoTextRight = parsedElements.logoTextRight;
      }
    } catch (e) { }
  }

  // Clear active comments and suggestions
  loadedData.comments = [];
  loadedData.suggestions = [];

  if (doc.headerHTML) loadedData.headerHTML = doc.headerHTML;
  if (doc.footerHTML) loadedData.footerHTML = doc.footerHTML;

  loadedData.content = stripCommentHighlights(loadedData.content);
  return loadedData;
};

const mapParticipantRoleForDb = (role) => (role === 'commenter' ? 'viewer' : role);

const CreateDocument = ({ navigate, user, users, templates, template, document, departments = [], onSuccess }) => {
  const [form] = Form.useForm();
  const creatorId = user?.id ?? user?.userId;
  const [activeTab, setActiveTab] = useState("basicInfo");
  const [tasks, setTasks] = useState([{ title: '', description: '', dueDate: null }]);
  const [participants, setParticipants] = useState([]);
  const [contentData, setContentData] = useState(null);
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [tempAttachments, setTempAttachments] = useState([]);
  const [tempReferences, setTempReferences] = useState([]);
  const [tempManualReferences, setTempManualReferences] = useState([]);
  const [impactData, setImpactData] = useState({
    // existing fields
    departmentImpacts: [],
    affectedSystems: [],
    implementationEffort: 'medium',
    trainingRequired: false,
    impactNotes: '',
    // impact template
    impactTemplates: [] // Array containing at most one { id, name, content, filledValues }
  });
  const currentDocumentIdRef = useRef(null);
  const isCreatingRef = useRef(false);
  useEffect(() => {
    if (currentDocumentId) currentDocumentIdRef.current = currentDocumentId;
  }, [currentDocumentId]);

  // Sync references from contentData to tempReferences and tempManualReferences for the References tab
  useEffect(() => {
    if (contentData?.references && Array.isArray(contentData.references)) {
      setTempReferences(contentData.references.filter(r => !r.isManual && r.refAnchor));
    }
    if (contentData?.manualReferences && Array.isArray(contentData.manualReferences)) {
      setTempManualReferences(contentData.manualReferences);
    } else if (contentData?.references && Array.isArray(contentData.references)) {
      setTempManualReferences(contentData.references.filter(r => r.isManual || !r.refAnchor));
    }
  }, [contentData?.references, contentData?.manualReferences]);

  const [documentApproversModalVisible, setDocumentApproversModalVisible] = useState(false);
  const [documentWorkflowApprovers, setDocumentWorkflowApprovers] = useState({
    reviewers: [],
    approvers: []
  });
  const [documentRequiredApprovers, setDocumentRequiredApprovers] = useState([]);
  const [approverType, setApproverType] = useState('review');
  const [sharedDueDate, setSharedDueDate] = useState(null);
  const [tabStatus, setTabStatus] = useState({
    basicInfo: "incomplete",
    tasks: "incomplete",
    participants: "incomplete",
    content: "incomplete",
    impact: "incomplete",
    review: "incomplete"
  });

  // Filter templates to only show published and pending_revision status, plus the document's currently selected template version even if revised
  const availableTemplates = templates.filter(template =>
    template.status === 'published' ||
    template.status === 'pending_revision' ||
    (document && template.id === document.template_id)
  );

  // Filter out current user from selectable users
  const selectableUsers = users.filter(u => u.id !== user.id);

  // Helper: load all approver data from a template object into state
  const loadApproversFromTemplate = useCallback((t) => {
    if (!t) {
      setDocumentRequiredApprovers([]);
      setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
      return;
    }
    // Department-level config
    if (t.required_approvers) {
      try {
        const parsed = typeof t.required_approvers === 'string'
          ? JSON.parse(t.required_approvers)
          : t.required_approvers;
        setDocumentRequiredApprovers(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        setDocumentRequiredApprovers([]);
      }
    } else {
      setDocumentRequiredApprovers([]);
    }
    // User-level workflow config
    if (t.template_approvers) {
      try {
        const parsed = typeof t.template_approvers === 'string'
          ? JSON.parse(t.template_approvers)
          : t.template_approvers;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setDocumentWorkflowApprovers({
            reviewers: Array.isArray(parsed.reviewers) ? parsed.reviewers : [],
            approvers: Array.isArray(parsed.approvers) ? parsed.approvers : []
          });
        } else {
          setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
        }
      } catch (e) {
        setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
      }
    } else {
      setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
    }
  }, []);

  useEffect(() => {
    if (template?.id) {
      form.setFieldsValue({
        templateId: template.id
      });
      // Also immediately load approvers from the pre-selected template prop so
      // they are available even before the templateId watch effect fires.
      const t = templates.find(tpl => tpl.id === template.id);
      if (t) loadApproversFromTemplate(t);
    }
  }, [template, form, templates, loadApproversFromTemplate]);

  // Auto-fill from base document
  useEffect(() => {
    if (document) {
      const matchingTemplateId = document.template_id || undefined;
      const extracted = extractDocumentContent(document);
      const deptName = document.department || extracted.logoTextRight || undefined;

      form.setFieldsValue({
        title: document.title || '',
        templateId: matchingTemplateId,
        department: deptName
      });

      // Load content
      setContentData(extracted);

      // Load tasks
      if (document.tasks) {
        try {
          const parsedTasks = typeof document.tasks === 'string' ? JSON.parse(document.tasks) : document.tasks;
          if (Array.isArray(parsedTasks)) {
            setTasks(parsedTasks.map(t => ({
              title: t.title || '',
              description: t.description || '',
              dueDate: t.due_date ? moment(t.due_date) : null
            })));
          }
        } catch (e) {
          console.error("Error parsing document tasks", e);
        }
      }

      // Load participants
      if (document.participants) {
        try {
          const parsedParts = typeof document.participants === 'string' ? JSON.parse(document.participants) : document.participants;
          if (Array.isArray(parsedParts)) {
            setParticipants(parsedParts.map(p => ({
              userId: p.user_id || p.userId,
              role: p.role || 'viewer'
            })));
          }
        } catch (e) {
          console.error("Error parsing document participants", e);
        }
      }

      // Load impact assessment data
      if (document.impact) {
        try {
          const parsedImpact = typeof document.impact === 'string' ? JSON.parse(document.impact) : document.impact;
          if (parsedImpact && typeof parsedImpact === 'object') {
            let impactTemplates = parsedImpact.impactTemplates || [];
            
            // Backward compatibility: handle old single template format
            if (impactTemplates.length === 0 && parsedImpact.impactTemplateId) {
              impactTemplates = [{
                id: parsedImpact.impactTemplateId,
                name: templates.find(t => t.id === parsedImpact.impactTemplateId)?.name || 'Impact Template',
                content: parsedImpact.impactTemplateContent || '',
                filledValues: parsedImpact.impactFilledValues || [],
                dropdownValues: parsedImpact.impactDropdownValues || [],
              }];
            }

            setImpactData({
              // existing fields
              departmentImpacts: parsedImpact.departmentImpacts || [],
              affectedSystems: parsedImpact.affectedSystems || [],
              implementationEffort: parsedImpact.implementationEffort || 'medium',
              trainingRequired: parsedImpact.trainingRequired || false,
              impactNotes: parsedImpact.impactNotes || '',
              impactTemplates: impactTemplates
            });
            // Sync the Impact Template dropdown with the form
            if (impactTemplates.length > 0) {
              form.setFieldsValue({ impactTemplateId: impactTemplates[0].id });
            }
          }
        } catch (e) {
          console.error("Error parsing document impact", e);
        }
      }

      // Load required approvers from document
      if (document.required_approvers) {
        try {
          const parsed = typeof document.required_approvers === 'string'
            ? JSON.parse(document.required_approvers)
            : document.required_approvers;
          setDocumentRequiredApprovers(parsed || []);
        } catch (e) {
          console.error("Error parsing document required approvers", e);
        }
      }

      // Load workflow approvers (reviewer/approver user config) from the document's persisted state.
      // The backend normalizes documents.approvers → template_approvers for the client.
      if (document.template_approvers) {
        try {
          const parsed = typeof document.template_approvers === 'string'
            ? JSON.parse(document.template_approvers)
            : document.template_approvers;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setDocumentWorkflowApprovers({
              reviewers: Array.isArray(parsed.reviewers) ? parsed.reviewers : [],
              approvers: Array.isArray(parsed.approvers) ? parsed.approvers : []
            });
          }
        } catch (e) {
          console.error("Error parsing document template_approvers", e);
        }
      }

      // Set all form/tab status as complete since they are loaded from a valid published document
      setTabStatus({
        basicInfo: "complete",
        tasks: "complete",
        participants: "complete",
        content: "complete",
        impact: "complete",
        review: "complete"
      });
    }
  }, [document, form]);

  // Handler: user selects or clears Impact Template in BasicInfo
  const handleImpactTemplateChange = useCallback((templateId) => {
    if (!templateId) {
      setImpactData(prev => ({
        ...prev,
        impactTemplates: []
      }));
      return;
    }

    setImpactData(prev => {
      const selectedTemplate = templates.find(t => t.id === templateId);
      if (!selectedTemplate) return prev;

      const extracted = extractTemplateContent(selectedTemplate);
      const newTemplate = {
        id: templateId,
        name: selectedTemplate.name,
        content: extracted?.content || '',
        filledValues: [],
        dropdownValues: [],
      };

      return {
        ...prev,
        impactTemplates: [newTemplate]
      };
    });
  }, [templates]);

  const selectedTemplateIdWatch = Form.useWatch('templateId', form);
  const prevTplRef = useRef(selectedTemplateIdWatch);
  useEffect(() => {
    const prev = prevTplRef.current;
    prevTplRef.current = selectedTemplateIdWatch;

    // Fire when template value actually changes. The old `prev !== undefined`
    // guard was preventing this from running on programmatic initial selection
    // (e.g. when the `template` prop sets the form value on mount) — causing inconsistency.
    if (prev !== selectedTemplateIdWatch) {
      // Only clear content when switching BETWEEN two real selections,
      // not on the very first load (prev was undefined)
      if (prev !== undefined) {
        setContentData(null);
      }

      if (selectedTemplateIdWatch) {
        const t = templates.find(tpl => tpl.id === selectedTemplateIdWatch);
        loadApproversFromTemplate(t || null);
      } else {
        // Template cleared
        setDocumentRequiredApprovers([]);
        setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
      }
    }
  }, [selectedTemplateIdWatch, templates, loadApproversFromTemplate]);


  // Validate fields on tab change
  const validateTabFields = async (tab) => {
    try {
      const tabFieldMapping = {
        basicInfo: ['title', 'department'],
        tasks: [], // Tasks are optional
        participants: [], // Participants are optional
        content: [], // Content tab doesn't have form fields to validate
        settings: [], // Settings are optional
        impact: [], // Impact is optional
        review: [] // Review tab doesn't have form fields to validate
      };

      const fields = tabFieldMapping[tab];

      if (tab === 'tasks') {
        // Tasks are optional; always consider this tab complete.
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      if (tab === 'content') {
        const html = (contentData && typeof contentData.content === 'string' && contentData.content.trim()) || '';
        if (!html) {
          setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
          return false;
        }
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      if (tab === 'impact') {
        // If one or more impact templates are selected, ensure all blanks are filled
        if (impactData?.impactTemplates && impactData.impactTemplates.length > 0) {
          const allFilled = impactData.impactTemplates.every(tpl => {
            const totalBlanks = countBlanksInHtml(tpl.content);
            const filledValues = tpl.filledValues || [];
            const filledCount = filledValues.filter(v => v && String(v).trim()).length;
            return filledCount >= totalBlanks;
          });

          if (!allFilled) {
            setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
            return false;
          }
        }
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      if (!fields || fields.length === 0) {
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      await form.validateFields(fields);
      setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
      return true;
    } catch (error) {
      console.log("Validation error:", error);
      setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
      return false;
    }
  };

  // Navigation between tabs
  const navigateToTab = (direction) => {
    const tabs = ["basicInfo", "tasks", "participants", "content", "attachments", "references", "impact", "review"];
    const currentIndex = tabs.indexOf(activeTab);

    if (direction === 'next' && currentIndex < tabs.length - 1) {
      const nextTab = tabs[currentIndex + 1];
      handleTabChange(nextTab);
    } else if (direction === 'prev' && currentIndex > 0) {
      const prevTab = tabs[currentIndex - 1];
      handleTabChange(prevTab);
    }
  };

  const handleTabChange = async (key) => {
    if (activeTab) {
      await validateTabFields(activeTab);
    }

    if (tabStatus[key] === "incomplete" &&
      (key === "participants" || key === "content" || key === "settings" || key === "review")) {
      setTabStatus(prev => ({ ...prev, [key]: "complete" }));
    }

    setActiveTab(key);
  };

  // Get tab status badge color
  const getTabStatusColor = (tabKey) => {
    return tabStatus[tabKey] === "complete" ? "success" : "error";
  };

  // Handle task operations
  const addTask = () => {
    setTasks([...tasks, { title: '', description: '', dueDate: null }]);
  };

  const removeTask = (index) => {
    if (tasks.length > 1) {
      const newTasks = tasks.filter((_, i) => i !== index);
      setTasks(newTasks);
    }
  };

  const updateTask = (index, field, value) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setTasks(newTasks);
  };

  // Handle participant operations
  const addParticipant = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user && !participants.some(p => p.userId === userId)) {
      setParticipants([...participants, { userId, role: 'viewer' }]);
    }
  };

  const removeParticipant = (userId) => {
    setParticipants(participants.filter(p => p.userId !== userId));
  };

  const updateParticipantRole = (userId, role) => {
    setParticipants(participants.map(p =>
      p.userId === userId ? { ...p, role } : p
    ));
  };

  const handleAddDocumentApprover = (userId) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    const newApprover = {
      userId,
      name: `${u.first_name} ${u.last_name}`,
      email: u.email,
      department: u.department || '',
      role: approverType === 'review' ? DOC_REVIEWER_ROLE : DOC_APPROVER_ROLE,
      status: 'pending',
      dueDate: sharedDueDate,
      ...(approverType === 'approval' && { comment: '' })
    };
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    if (!documentWorkflowApprovers[targetArray].some((a) => a.userId === userId)) {
      setDocumentWorkflowApprovers((prev) => ({
        ...prev,
        [targetArray]: [...prev[targetArray], newApprover]
      }));
    }
  };

  const handleRemoveDocumentApprover = (userId) => {
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    setDocumentWorkflowApprovers((prev) => ({
      ...prev,
      [targetArray]: prev[targetArray].filter((a) => a.userId !== userId)
    }));
  };

  const validateAllTabs = async () => {
    const order = ['basicInfo', 'participants', 'content', 'impact'];
    for (const tab of order) {
      const ok = await validateTabFields(tab);
      if (!ok) {
        setActiveTab(tab);
        return { isValid: false, failedTab: tab };
      }
    }
    return { isValid: true };
  };

  const buildResolvedTemplateContent = (templateId) => {
    if (!templateId) return null;
    const t = templates.find((x) => x.id === templateId);
    return t ? extractTemplateContent(t) : null;
  };

  const buildDocumentPayload = (formValues, activeContent, docStatus, workflowForSubmit) => {
    const templateContent = buildResolvedTemplateContent(formValues.templateId);
    let finalContent = activeContent?.content;
    let finalLogo = activeContent?.logo;
    let finalLogoText = activeContent?.logoText || '';
    let finalLogoTextRight = activeContent?.logoTextRight || '';

    if (templateContent && typeof templateContent === 'object') {
      if (finalContent == null || finalContent === '') {
        finalContent = templateContent.content;
      }
      if (finalLogo == null) finalLogo = templateContent.logo;
      if (!finalLogoText) finalLogoText = templateContent.logoText || '';
      if (!finalLogoTextRight) finalLogoTextRight = templateContent.logoTextRight || '';
    }

    const title =
      (formValues.title || '').trim() || `Untitled Document - ${new Date().toLocaleDateString()}`;

    const validTasks = tasks
      .filter((task) => task.title && task.title.trim() !== '')
      .map((task) => ({
        title: task.title,
        description: task.description || null,
        due_date:
          task.dueDate && typeof task.dueDate.format === 'function'
            ? task.dueDate.format('YYYY-MM-DD HH:mm')
            : null,
        created_by: creatorId
      }));

    const documentData = {
      title,
      created_by: creatorId,
      template_id: (document && document.document_id && (formValues.templateId === document.template_id || !formValues.templateId))
        ? document.document_id
        : (formValues.templateId || null),
      content: {
        content: finalContent ?? '',
        logo: finalLogo ?? null,
        logoText: finalLogoText || '',
        logoTextRight: finalLogoTextRight || '',
        references: (activeContent?.references && Array.isArray(activeContent.references))
          ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
          : [],
        manualReferences: tempManualReferences || []
      },
      comments: activeContent?.comments || [],
      suggestedEdits: activeContent?.suggestions || [],
      references: (activeContent?.references && Array.isArray(activeContent.references))
        ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
        : [],
      manualReferences: tempManualReferences || [],
      headerHTML:
        (formValues.title || '').trim() ||
        (activeContent?.headerHTML ?? templateContent?.headerHTML) ||
        '',
      footerHTML: activeContent?.footerHTML || templateContent?.footerHTML || '',
      logo: activeContent?.logo ?? finalLogo,
      logoText: activeContent?.logoText || finalLogoText || '',
      logoTextRight: activeContent?.logoTextRight || finalLogoTextRight || '',
      tasks: validTasks,
      participants: participants.map((p) => ({
        user_id: p.userId,
        role: mapParticipantRoleForDb(p.role)
      })),
      status: docStatus,
      tempAttachments: tempAttachments,
      impact: impactData || {},
      required_approvers: documentRequiredApprovers
    };

    if (docStatus === 'pending_review' || docStatus === 'pending_approval') {
      documentData.approvers = workflowForSubmit;
    }

    return documentData;
  };

  const buildUpdateBody = (formValues, activeContent, docStatus, workflowForSubmit, touchStatus) => {
    const templateContent = buildResolvedTemplateContent(formValues.templateId);
    let finalContent = activeContent?.content ?? '';
    let finalLogo = activeContent?.logo;
    let finalLogoText = activeContent?.logoText || '';
    let finalLogoTextRight = activeContent?.logoTextRight || '';

    if (templateContent && typeof templateContent === 'object') {
      if (!finalContent) finalContent = templateContent.content || '';
      if (finalLogo == null) finalLogo = templateContent.logo;
      if (!finalLogoText) finalLogoText = templateContent.logoText || '';
      if (!finalLogoTextRight) finalLogoTextRight = templateContent.logoTextRight || '';
    }

    const title =
      (formValues.title || '').trim() || `Untitled Document - ${new Date().toLocaleDateString()}`;

    const contentObj = {
      content: finalContent,
      logo: finalLogo ?? null,
      logoText: finalLogoText || '',
      logoTextRight: finalLogoTextRight || '',
      references: (activeContent?.references && Array.isArray(activeContent.references))
        ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
        : [],
      manualReferences: tempManualReferences || []
    };
    const elementsObj = {
      comments: activeContent?.comments || [],
      suggestedEdits: activeContent?.suggestions || [],
      references: (activeContent?.references && Array.isArray(activeContent.references))
        ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
        : [],
      manualReferences: tempManualReferences || [],
      headerHTML:
        (activeContent?.headerHTML ?? templateContent?.headerHTML) ||
        (formValues.title || '').trim() ||
        '',
      footerHTML: activeContent?.footerHTML || templateContent?.footerHTML || '',
      logo: activeContent?.logo ?? finalLogo,
      logoText: activeContent?.logoText || finalLogoText || '',
      logoTextRight: activeContent?.logoTextRight || finalLogoTextRight || ''
    };

    const body = {
      title,
      content: JSON.stringify(contentObj),
      elements: JSON.stringify(elementsObj),
      impact: impactData || {},
      required_approvers: documentRequiredApprovers
    };

    if (touchStatus && docStatus) {
      body.status = docStatus;
    }
    if (workflowForSubmit) {
      body.approvers = workflowForSubmit;
    }
    return body;
  };

  const persistDocument = async (docStatus, isAutoSave, overrideContent) => {
    if (!user || creatorId == null) {
      if (!isAutoSave) errorAlert('Not signed in', 'You must be logged in to save.');
      return false;
    }
    const effectiveId = currentDocumentIdRef.current || currentDocumentId;
    const activeContent = overrideContent || contentData;
    const formValues = form.getFieldsValue(true);

    if (isAutoSave) {
      if (!effectiveId && !formValues.title?.trim()) return false;
    } else if (docStatus === 'draft') {
      try {
        await form.validateFields(['title']);
      } catch {
        message.error('Enter a document title on Basic Info before saving a draft.');
        setActiveTab('basicInfo');
        return false;
      }
    }

    let workflowForSubmit = null;
    if (docStatus === 'pending_review' || docStatus === 'pending_approval') {
      let updated = { ...documentWorkflowApprovers };
      if (sharedDueDate) {
        const targetArray = docStatus === 'pending_review' ? 'reviewers' : 'approvers';
        updated[targetArray] = updated[targetArray].map((a) => ({
          ...a,
          dueDate: sharedDueDate
        }));
      }
      workflowForSubmit = updated;
    }

    try {
      if (effectiveId) {
        const touchStatus = isAutoSave ? false : docStatus !== undefined;
        const body = buildUpdateBody(
          formValues,
          activeContent,
          docStatus,
          workflowForSubmit,
          touchStatus
        );
        if (isAutoSave) {
          delete body.status;
          delete body.approvers;
        }
        const res = await axios.put(`/api/update_document/${effectiveId}`, body);
        if (res.data.success) {
          if (isAutoSave) {
            // Silent autosave: no toast for production feel
          }
          else if (onSuccess) onSuccess();
          return true;
        }
      } else {
        // Prevent duplicate document creation (common when auto-save fires before the first create resolves).
        if (isCreatingRef.current) return false;
        isCreatingRef.current = true;
        const payload = buildDocumentPayload(formValues, activeContent, docStatus, workflowForSubmit);
        const res = await axios.post('/api/create-document', payload);
        if (res.data.success) {
          const newId = res.data.document_id;
          currentDocumentIdRef.current = newId;
          setCurrentDocumentId(newId);
          if (!isAutoSave) {
            if (onSuccess) onSuccess();
          } else {
            // Silent autosave: no toast for production feel
          }
          return true;
        }
      }
    } catch (error) {
      if (!isAutoSave) {
        errorAlert(
          'Save failed',
          error.response?.data?.message || error.response?.data?.error || error.message
        );
      }
      return false;
    } finally {
      if (!effectiveId) {
        isCreatingRef.current = false;
      }
    }
    return false;
  };

  const handleSubmit = useCallback((status = 'draft', isAutoSave = false, overrideContent = null) => {
    if (isAutoSave) {
      persistDocument('draft', true, overrideContent);
      return;
    }
    if (status === 'draft') {
      persistDocument('draft', false, null).then((ok) => {
        if (ok) toastAlert('Document saved as draft');
      });
      return;
    }
    if (status === 'pending_review' || status === 'pending_approval') {
      validateAllTabs().then((result) => {
        const { isValid, failedTab } = result;
        if (!isValid) {
          // If the impact tab is incomplete, show a specific message
          if (failedTab === "impact") {
            errorAlert(
              'Submission failed',
              'Please complete all fields in the Impact Form before submitting for review or approval.'
            );
          } else {
            errorAlert(
              'Submission failed',
              'Fill in Basic Info (title), enter body text on Content, and ensure the Impact Form is complete (if selected) before submitting.'
            );
          }
          return;
        }
        persistDocument(status, false, null).then((ok) => {
          if (ok) {
            const actionText = status === 'pending_review' ? 'review' : 'approval';
            successAlert('Document submitted', `Document submitted for ${actionText} successfully.`);
          }
        });
      });
    }
  }, [persistDocument, validateAllTabs]);

  const { debouncedSave } = useAutoSave({
    currentDocumentId,
    form,
    contentData,
    onSave: handleSubmit,
    titleField: 'title'
  });

  const docMenuItems = useMemo(
    () => [
      {
        key: 'review',
        label: 'Submit for Review',
        icon: <FileSearchOutlined />,
        onClick: () => {
          setApproverType('review');
          setDocumentApproversModalVisible(true);
        }
      },
      {
        key: 'approval',
        label: 'Submit for Approval',
        icon: <SaveOutlined />,
        onClick: () => {
          setApproverType('approval');
          setDocumentApproversModalVisible(true);
        }
      },
      {
        key: 'draft',
        label: 'Save as Draft',
        icon: <FileTextOutlined />,
        onClick: () => handleSubmit('draft')
      }
    ],
    [handleSubmit]
  );

  const canSubmit = useMemo(
    () => Object.entries(tabStatus)
      .filter(([key]) => key !== 'review')
      .every(([_, status]) => status === "complete"),
    [tabStatus]
  );

  const renderTabBarExtra = () => (
    <Space>
      <Button
        icon={<LeftOutlined />}
        onClick={() => navigateToTab('prev')}
        disabled={activeTab === 'basicInfo'}
        size="small"
      >
        Previous
      </Button>
      <Button
        type="default"
        onClick={() => navigateToTab('next')}
        disabled={activeTab === 'review'}
        size="small"
      >
        Next <RightOutlined />
      </Button>
      <Dropdown
        menu={{ items: docMenuItems }}
        placement="bottomRight"
      >
        <Button size="small" type="primary">
          Create Document <DownOutlined />
        </Button>
      </Dropdown>
    </Space>
  );

  // Basic information tab content
  const renderBasicInfoTab = () => (
    <Card bordered={false} title="Basic Document Information">
      <Form.Item
        name="title"
        label="Document Title"
        rules={[{ required: true, message: 'Please enter a document title' }]}
      >
        <Input placeholder="Enter document title" size="large" />
      </Form.Item>

      <Form.Item
        name="department"
        label="Department"
        rules={[{ required: true, message: 'Please select a department' }]}
      >
        <Select
          placeholder="Select a department"
          showSearch
          optionFilterProp="children"
          onChange={(value) => {
            setContentData((prev) => {
              const safePrev = prev && typeof prev === 'object' ? prev : {};
              const nextLogo = safePrev.logo ? { ...safePrev.logo, textRight: value || '' } : { textRight: value || '' };
              return {
                ...safePrev,
                logo: nextLogo,
                logoTextRight: value || ''
              };
            });
            debouncedSave();
          }}
        >
          {departments.map(dept => (
            <Option key={dept.id || dept.name} value={dept.name}>
              {dept.name}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="templateId"
        label="Template"
      >
        <Select
          placeholder="Select a template (optional)"
          showSearch
          optionFilterProp="children"
          filterOption={(input, option) => {
            const children = option.children;
            if (typeof children === 'string') {
              return children.toLowerCase().indexOf(input.toLowerCase()) >= 0;
            }
            // Handle complex children (div with multiple elements)
            if (children && typeof children === 'object') {
              const text = Array.isArray(children)
                ? children.map(c => {
                  if (typeof c === 'string') return c;
                  if (c && c.props && c.props.children) {
                    return typeof c.props.children === 'string' ? c.props.children : '';
                  }
                  return '';
                }).join(' ')
                : (children.props?.children || '').toString();
              return text.toLowerCase().indexOf(input.toLowerCase()) >= 0;
            }
            return false;
          }}
        >
          {availableTemplates.map(template => (
            <Option key={template.id} value={template.id}>
              <div>
                <span>{template.name}</span>
                <Tag
                  color={template.status === 'published' ? 'green' : template.status === 'revised' ? 'red' : 'orange'}
                  style={{ marginLeft: 8, fontSize: '10px' }}
                >
                  {template.status === 'published' ? 'Published' : template.status === 'revised' ? 'Revised Version' : 'Revision'}
                </Tag>
              </div>
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="impactTemplateId"
        label="Impact Template"
        extra="Optional. Select a published template to use as a structured Impact form."
      >
        <Select
          placeholder="Select an impact template (optional)"
          allowClear
          showSearch
          optionFilterProp="children"
          onChange={handleImpactTemplateChange}
          filterOption={(input, option) => {
            if (!option) return false;
            const label = typeof option.children === 'string'
              ? option.children
              : '';
            return label.toLowerCase().includes(input.toLowerCase());
          }}
        >
          {templates
            .filter(t => t.status === 'published')
            .map(t => (
              <Option key={t.id} value={t.id}>
                {t.name}
              </Option>
            ))
          }
        </Select>
      </Form.Item>
    </Card>
  );

  // Tasks tab content
  const renderTasksTab = () => (
    <Card
      bordered={false}
      title={
        <span>
          Document Tasks
          <Tooltip title="Define the tasks or sections that need to be completed for this document">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <div style={{ marginBottom: 16 }}>
        {tasks.map((task, index) => (
          <div key={index} style={{ position: 'relative', marginBottom: 16, border: '1px solid #f0f0f0', padding: 16, borderRadius: 6 }}>
            <Row gutter={16}>
              <Col span={24}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Task {index + 1}</Text>
                  {tasks.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => removeTask(index)}
                      style={{ float: 'right' }}
                      size="small"
                    />
                  )}
                </div>
              </Col>
              <Col span={24}>
                <Input
                  placeholder="Enter task title"
                  value={task.title}
                  onChange={(e) => updateTask(index, 'title', e.target.value)}
                  style={{ marginBottom: 8 }}
                />
              </Col>
              <Col span={24}>
                <TextArea
                  rows={2}
                  placeholder="Enter task description"
                  value={task.description}
                  onChange={(e) => updateTask(index, 'description', e.target.value)}
                  style={{ marginBottom: 8 }}
                />
              </Col>
              <Col span={24}>
                <DatePicker
                  placeholder="Select due date (optional)"
                  style={{ width: '100%' }}
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  value={task.dueDate}
                  onChange={(date) => updateTask(index, 'dueDate', date)}
                />
              </Col>
            </Row>
          </div>
        ))}

        <Button
          type="dashed"
          onClick={addTask}
          block
          icon={<PlusOutlined />}
        >
          Add Task
        </Button>
      </div>

      <Alert
        message="Tasks are optional"
        type="info"
        style={{ marginTop: 16 }}
      />
    </Card>
  );

  // Participants tab content
  const renderParticipantsTab = () => (
    <Card
      bordered={false}
      title={
        <span>
          Document Access & Participants
          <Tooltip title="Manage who can access this document and their permission levels">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <p><strong>Creator:</strong></p>
        <Tag color={roleColors.author}>
          {user.email} (Author)
        </Tag>
      </div>

      <Divider />

      <div style={{ marginBottom: 16 }}>
        <Text strong>Add Team Members</Text>
        <Select
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Select team members by email"
          value={null}
          onChange={addParticipant}
          optionLabelProp="label"
        >
          {selectableUsers
            .filter(user => !participants.some(p => p.userId === user.id))
            .map(user => (
              <Option
                key={user.id}
                value={user.id}
                label={user.email}
              >
                <div>
                  <div>{user.email}</div>
                  {user.first_name && user.last_name && <div style={{ fontSize: 'smaller', color: '#666' }}>{user.first_name} {user.last_name}</div>}
                </div>
              </Option>
            ))
          }
        </Select>
      </div>

      {participants.length > 0 && (
        <div>
          <Text strong>Selected Participants</Text>
          <div style={{ marginTop: 8 }}>
            {participants.map(participant => {
              const user = users.find(u => u.id === participant.userId);
              return (
                <Row
                  key={participant.userId}
                  gutter={16}
                  align="middle"
                  style={{ marginBottom: 8, padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}
                >
                  <Col flex="auto">
                    <Tag>{user?.email}</Tag>
                  </Col>
                  <Col>
                    <Select
                      value={participant.role}
                      onChange={(role) => updateParticipantRole(participant.userId, role)}
                      style={{ width: 120 }}
                    >
                      <Option value="editor">Editor</Option>
                      <Option value="commenter">Commenter</Option>
                      <Option value="viewer">Viewer</Option>
                    </Select>
                  </Col>
                  <Col>
                    <Button
                      type="text"
                      danger
                      onClick={() => removeParticipant(participant.userId)}
                      size="small"
                    >
                      Remove
                    </Button>
                  </Col>
                </Row>
              );
            })}
          </div>
        </div>
      )}

      <Alert
        message="Participants are optional. You can add team members later if needed."
        type="info"
        style={{ marginTop: 16 }}
      />
    </Card>
  );

  // Content tab content (same editor + comment system + logo merge as Create Template)
  const renderContentTab = () => (
    <Card
      bordered={false}
      title={
        <span>
          Document Content
          <Tooltip
            title="Configure the document content structure and default values."
          >
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <div style={{ padding: '0 8px 8px 8px' }}>
        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => {
            const selectedTemplateId = getFieldValue('templateId');
            const documentTitle = getFieldValue('title');

            const fallbackEmpty = {
              content: '',
              comments: [],
              suggestions: [],
              references: [],
              manualReferences: [],
              logo: null,
              headerHTML: '',
              footerHTML: '',
              logoText: '',
              logoTextRight: ''
            };

            let fallback = fallbackEmpty;
            if (selectedTemplateId) {
              const t = templates.find((x) => x.id === selectedTemplateId);
              if (t) {
                const extractedHtml = extractTemplateContent(t);
                if (extractedHtml) {
                  fallback = {
                    content: extractedHtml.content || '',
                    comments: extractedHtml.comments || [],
                    suggestions: extractedHtml.suggestions || [],
                    references: extractedHtml.references || [],
                    manualReferences: extractedHtml.manualReferences || [],
                    logo: extractedHtml.logo ?? null,
                    headerHTML: extractedHtml.headerHTML || '',
                    footerHTML: extractedHtml.footerHTML || '',
                    logoText: extractedHtml.logoText || '',
                    logoTextRight: extractedHtml.logoTextRight || ''
                  };
                }
              }
            }

            const cd = contentData && typeof contentData === 'object' ? contentData : {};
            const mergedInitial = {
              ...fallback,
              ...cd,
              content: cd.content !== undefined && cd.content !== null ? cd.content : fallback.content,
              comments: Array.isArray(cd.comments) ? cd.comments : fallback.comments,
              suggestions: Array.isArray(cd.suggestions) ? cd.suggestions : fallback.suggestions,
              references: Array.isArray(cd.references) ? cd.references : (fallback.references || []),
              manualReferences: Array.isArray(cd.manualReferences) ? cd.manualReferences : (fallback.manualReferences || []),
              logo: cd.logo !== undefined ? { ...(fallback.logo || {}), ...cd.logo } : fallback.logo,
              headerHTML: cd.headerHTML !== undefined ? cd.headerHTML : fallback.headerHTML,
              footerHTML: cd.footerHTML !== undefined ? cd.footerHTML : fallback.footerHTML,
              logoText: cd.logoText !== undefined ? cd.logoText : fallback.logoText,
              logoTextRight: cd.logoTextRight !== undefined ? cd.logoTextRight : fallback.logoTextRight
            };

            // Fix the merge logic to preserve correct keys
            mergedInitial.logo = cd.logo !== undefined ? { ...(fallback.logo || {}), ...cd.logo } : fallback.logo;

            return (
              <EditorPlaceholder
                mode="create"
                isDocument={true}
                documentId={currentDocumentId || document?.document_id}
                templateId={form.getFieldValue('templateId') || document?.template_id}
                user={user}
              />
            );
          }}
        </Form.Item>
      </div>
    </Card>
  );



  // Review tab content
  const renderReviewTab = () => (
    <Card
      bordered={false}
      title={
        <span>
          Review Document Configuration
          <Tooltip title="Please review your document settings before creating it">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small" title="Basic Information">
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => (
                <>
                  <p><strong>Title:</strong> {getFieldValue('title') || 'Not specified'}</p>
                  <p><strong>Department:</strong> {getFieldValue('department') || 'Not specified'}</p>
                  <p><strong>Template:</strong> {
                    getFieldValue('templateId')
                      ? availableTemplates.find(t => t.id === getFieldValue('templateId'))?.name || 'Template not found'
                      : 'No template selected'
                  }</p>
                </>
              )}
            </Form.Item>
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Tasks">
            {tasks.filter(task => task.title && task.title.trim() !== '').length > 0 ? (
              <div>
                {tasks
                  .filter(task => task.title && task.title.trim() !== '')
                  .map((task, index) => (
                    <div key={index} style={{ marginBottom: 8, padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}>
                      <p><strong>{task.title}</strong></p>
                      {task.description && <p style={{ margin: 0, color: '#666' }}>{task.description}</p>}
                      {task.dueDate && (
                        <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>
                          <strong>Due:</strong> {task.dueDate.format('YYYY-MM-DD HH:mm')}
                        </p>
                      )}
                    </div>
                  ))
                }
              </div>
            ) : (
              <Text type="secondary">No valid tasks defined</Text>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Participants">
            <div style={{ marginBottom: 8 }}>
              <Tag color={roleColors.author}>{user.email} (Author)</Tag>
            </div>
            {participants.length > 0 ? (
              participants.map(participant => {
                const user = users.find(u => u.id === participant.userId);
                return (
                  <Tag key={participant.userId} color={roleColors[participant.role]}>
                    {user?.email} ({participant.role})
                  </Tag>
                );
              })
            ) : (
              <Text type="secondary">No additional participants</Text>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Impact Assessment">
            {impactData.impactTemplates && impactData.impactTemplates.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                {impactData.impactTemplates.map((tpl, idx) => (
                  <div key={tpl.id || idx} style={{ marginBottom: 4 }}>
                    <Tag color="blue">Template: {tpl.name}</Tag>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      ({(tpl.filledValues || []).filter(v => v?.trim()).length} fields completed)
                    </Text>
                  </div>
                ))}
              </div>
            ) : null}
            <p><strong>Impacted Departments:</strong> {
              impactData.departmentImpacts && impactData.departmentImpacts.length > 0
                ? impactData.departmentImpacts.join(', ')
                : 'None'
            }</p>
            <p><strong>Implementation Effort:</strong> <Tag color="blue">{impactData.implementationEffort?.toUpperCase() || 'MEDIUM'}</Tag></p>
            <p><strong>Training Required:</strong> {impactData.trainingRequired ? 'Yes' : 'No'}</p>
          </Card>
        </Col>

        {/* <Col span={24}>
          <Card size="small" title="Settings">
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => (
                <>
                  <p><strong>Priority:</strong> {getFieldValue('priority') || 'Not specified'}</p>
                  <p><strong>Category:</strong> {getFieldValue('category') || 'Not specified'}</p>
                  <p><strong>Tags:</strong> {
                    getFieldValue('tags') && getFieldValue('tags').length > 0
                      ? getFieldValue('tags').map(tag => <Tag key={tag}>{tag}</Tag>)
                      : 'No tags'
                  }</p>
                  <p><strong>Description:</strong> {getFieldValue('description') || 'No description provided'}</p>
                </>
              )}
            </Form.Item>
          </Card>
        </Col> */}
      </Row>

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Dropdown menu={{ items: docMenuItems }} placement="bottomRight">
          <Button type="primary" disabled={!canSubmit && docMenuItems[0].key === 'review'}>
            Create Document <DownOutlined />
          </Button>
        </Dropdown>
        {Object.values(tabStatus).some(s => s === 'incomplete') && (
          <div style={{ color: '#ff4d4f', marginTop: 8 }}>
            Please complete all required fields in the highlighted tabs before submitting
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <div className="create-template-tabs">
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card bordered={false}>
            <Title level={3}>
              <FileTextOutlined /> Create New Document
            </Title>
            <Text type="secondary">
              {/* Create a new template that serves as the backbone for documents.
              Templates help maintain consistency and define approval workflows. */}
            </Text>
          </Card>
        </Col>

        <Col span={24}>
          <Form
            form={form}
            layout="vertical"
          >
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              type="card"
              destroyInactiveTabPane={false}
              tabBarExtraContent={renderTabBarExtra()}
              items={[
                {
                  key: "basicInfo",
                  label: (
                    <Badge dot status={getTabStatusColor("basicInfo")} offset={[5, 0]}>
                      <FileTextTwoTone /> Basic Info
                    </Badge>
                  ),
                  children: renderBasicInfoTab()
                },
                {
                  key: "tasks",
                  label: (
                    <Badge dot status={getTabStatusColor("tasks")} offset={[5, 0]}>
                      <EditOutlined /> Tasks
                    </Badge>
                  ),
                  children: renderTasksTab()
                },
                {
                  key: "participants",
                  label: (
                    <Badge dot status={getTabStatusColor("participants")} offset={[5, 0]}>
                      <TeamOutlinedTwo /> Participants
                    </Badge>
                  ),
                  children: renderParticipantsTab()
                },
                {
                  key: "content",
                  label: (
                    <Badge dot status={getTabStatusColor("content")} offset={[5, 0]}>
                      <EditOutlined /> Content
                    </Badge>
                  ),
                  children: renderContentTab()
                },
                {
                  key: "revisionHistory",
                  label: (
                    <span>
                      <HistoryOutlined /> Template History
                    </span>
                  ),
                  children: selectedTemplateIdWatch ? (
                    <TemplateRevisionHistoryTab 
                      templateId={selectedTemplateIdWatch}
                      currentVersion={templates?.find(t => t.id === selectedTemplateIdWatch)?.version}
                    />
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center' }}>
                      <Empty description="Please select a template to view its history" />
                    </div>
                  )
                },
                /* {
                  key: "settings",
                  label: (
                    <Badge dot status={getTabStatusColor("settings")} offset={[5, 0]}>
                      <SettingOutlined /> Settings
                    </Badge>
                  ),
                  children: renderSettingsTab()
                }, */
                {
                  key: "attachments",
                  label: (
                    <span>
                      <PaperClipOutlined /> Attachments
                    </span>
                  ),
                  children: (
                    <AttachmentsTab
                      associationType="document"
                      associationId={currentDocumentId}
                      templateId={selectedTemplateIdWatch}
                      canEdit={true}
                      onAttachmentsChange={setTempAttachments}
                    />
                  )
                },
                {
                  key: "references",
                  label: (
                    <span>
                      <BookOutlined /> References
                    </span>
                  ),
                  children: (
                    <ReferencesTab
                      references={tempReferences}
                      manualReferences={tempManualReferences}
                      onReferencesChange={(refs) => {
                        setTempReferences(refs);
                        setContentData(prev => {
                          const safePrev = prev && typeof prev === 'object' ? prev : {};
                          return { ...safePrev, references: refs };
                        });
                      }}
                      onManualReferencesChange={(refs) => {
                        setTempManualReferences(refs);
                        setContentData(prev => {
                          const safePrev = prev && typeof prev === 'object' ? prev : {};
                          return { ...safePrev, manualReferences: refs };
                        });
                      }}
                      canEdit={true}
                    />
                  )
                },
                {
                  key: "impact",
                  label: (
                    <Badge dot status={getTabStatusColor("impact")} offset={[5, 0]}>
                      <TeamOutlined /> Impact
                    </Badge>
                  ),
                  children: (
                    <ImpactAssessment
                      impactData={impactData}
                      setImpactData={setImpactData}
                      departments={departments}
                      impactTemplates={impactData.impactTemplates || []}
                      onImpactTemplatesChange={(updatedTemplates) =>
                        setImpactData(prev => ({ ...prev, impactTemplates: updatedTemplates }))
                      }
                    />
                  )
                },
                {
                  key: "review",
                  label: (
                    <Badge dot status={getTabStatusColor("review")} offset={[5, 0]}>
                      <FileSearchOutlined /> Review
                    </Badge>
                  ),
                  children: renderReviewTab()
                }
              ]}
            />
          </Form>
        </Col>
      </Row>

      <TemplateApproversModal
        visible={documentApproversModalVisible}
        onCancel={() => setDocumentApproversModalVisible(false)}
        approverType={approverType}
        setApproverType={setApproverType}
        sharedDueDate={sharedDueDate}
        setSharedDueDate={setSharedDueDate}
        templateApprovers={documentWorkflowApprovers}
        users={users}
        handleAddTemplateApprover={handleAddDocumentApprover}
        handleRemoveTemplateApprover={handleRemoveDocumentApprover}
        entityLabel="Document"
        reviewerRoleSlug={DOC_REVIEWER_ROLE}
        approverRoleSlug={DOC_APPROVER_ROLE}
        onSubmit={async () => {
          try {
            const isValid = await validateAllTabs();
            if (!isValid) {
              message.error('Please complete all required fields before submitting');
              return;
            }
            if (!sharedDueDate) {
              message.error('Please select a due date');
              return;
            }
            const finalStatus = approverType === 'review' ? 'pending_review' : 'pending_approval';
            handleSubmit(finalStatus);
            setDocumentApproversModalVisible(false);
          } catch (e) {
            console.error(e);
          }
        }}
      />
    </div>
  );
};

export default CreateDocument;