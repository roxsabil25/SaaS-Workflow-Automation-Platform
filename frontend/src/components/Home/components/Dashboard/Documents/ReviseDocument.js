import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { successAlert, errorAlert, toastAlert } from '../../../../../utils/alerts';
import {
  Card, Form, Input, Button, Select, DatePicker, Row, Col,
  Tag, Typography, Alert, Divider, Space, Tabs,
  Badge, Dropdown, Tooltip, message, Empty, Table, Radio, Modal
} from 'antd';
import {
  PlusOutlined, CloseOutlined, FileTextOutlined,
  FileTextTwoTone, TeamOutlined as TeamOutlinedTwo,
  EditOutlined, FileSearchOutlined, LeftOutlined,
  RightOutlined, DownOutlined,
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

const extractDocumentContent = (doc) => {
  if (!doc) return { content: '', comments: [], suggestions: [], references: [], logo: null };

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

  // Clear comments and suggestions for new revision
  loadedData.comments = [];
  loadedData.suggestions = [];

  if (doc.headerHTML) loadedData.headerHTML = doc.headerHTML;
  if (doc.footerHTML) loadedData.footerHTML = doc.footerHTML;

  loadedData.content = stripCommentHighlights(loadedData.content);
  return loadedData;
};

const mapParticipantRoleForDb = (role) => (role === 'commenter' ? 'viewer' : role);

const ReviseDocument = ({ fetchUserData, document, user, users, templates, departments = [], onCancel }) => {
  const [form] = Form.useForm();
  const creatorId = user?.id ?? user?.userId;
  const [activeTab, setActiveTab] = useState("basicInfo");
  const [tasks, setTasks] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [contentData, setContentData] = useState(null);
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

  // Replicate revision state from ReviseTemplate
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
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
    basicInfo: "complete",
    tasks: "complete",
    participants: "complete",
    content: "complete",
    impact: "complete",
    review: "complete"
  });

  // Filter templates to only show published and pending_revision status, plus the document's currently selected template version even if revised
  const availableTemplates = templates.filter(template =>
    template.status === 'published' ||
    template.status === 'pending_revision' ||
    (document && template.id === document.template_id)
  );

  // Filter out current user from selectable users
  const selectableUsers = users.filter(u => u.id !== user.id);

  // Auto-fill from parent document
  useEffect(() => {
    if (document) {
      form.setFieldsValue({
        title: document.title || '',
        templateId: document.template_id || undefined
      });

      // Load content
      const extracted = extractDocumentContent(document);
      setContentData(extracted);

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
    }
  }, [document, form]);

  const selectedTemplateIdWatch = Form.useWatch('templateId', form);
  const prevTplRef = useRef(selectedTemplateIdWatch);
  useEffect(() => {
    const prev = prevTplRef.current;
    prevTplRef.current = selectedTemplateIdWatch;
    if (prev !== undefined && prev !== selectedTemplateIdWatch) {
      setContentData(null);
      
      // Load required approvers from template
      if (selectedTemplateIdWatch) {
        const t = templates.find(tpl => tpl.id === selectedTemplateIdWatch);
        if (t && t.required_approvers) {
          try {
            const parsed = typeof t.required_approvers === 'string' 
              ? JSON.parse(t.required_approvers) 
              : t.required_approvers;
            setDocumentRequiredApprovers(parsed || []);
          } catch (e) {
            console.error("Error parsing template required approvers", e);
            setDocumentRequiredApprovers([]);
          }
        } else {
          setDocumentRequiredApprovers([]);
        }
      } else {
        setDocumentRequiredApprovers([]);
      }
    }
  }, [selectedTemplateIdWatch, templates]);

  // Validate fields on tab change
  const validateTabFields = async (tab) => {
    try {
      const tabFieldMapping = {
        basicInfo: ['title'],
        tasks: [],
        participants: [],
        content: [],
        attachments: [],
        impact: [],
        review: []
      };

      const fields = tabFieldMapping[tab];

      if (tab === 'tasks') {
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
      (key === "participants" || key === "content" || key === "review")) {
      setTabStatus(prev => ({ ...prev, [key]: "complete" }));
    }

    setActiveTab(key);
  };

  const getTabStatusColor = (tabKey) => {
    return tabStatus[tabKey] === "complete" ? "success" : "error";
  };

  // Handle task operations
  const addTask = () => {
    setTasks([...tasks, { title: '', description: '', dueDate: null }]);
  };

  const removeTask = (index) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    setTasks(newTasks);
  };

  const updateTask = (index, field, value) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setTasks(newTasks);
  };

  // Handle participant operations
  const addParticipant = (userId) => {
    const u = users.find(x => x.id === userId);
    if (u && !participants.some(p => p.userId === userId)) {
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

  const handleDocumentStatusUpdate = async (docId, newStatus) => {
    try {
      const response = await axios.put(`/api/documents/${docId}/status`, {
        status: newStatus
      });
      return response.data;
    } catch (error) {
      console.error('Error updating document status:', error);
      throw error;
    }
  };

  const handleReviseParentDocument = async (parentId, isAutoSave = false) => {
    try {
      await handleDocumentStatusUpdate(parentId, 'pending_revision');
      if (!isAutoSave) {
        message.success('Original document marked as pending revision');
      }
    } catch (error) {
      console.error('Error revising parent document:', error);
    }
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

    // Prepare tasks
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

    // Prepare content payload
    let finalContent = activeContent?.content ?? '';
    let finalLogo = activeContent?.logo ?? null;
    let finalLogoText = activeContent?.logoText ?? '';
    let finalLogoTextRight = activeContent?.logoTextRight ?? '';

    const contentObj = {
      content: finalContent,
      logo: finalLogo,
      logoText: finalLogoText,
      logoTextRight: finalLogoTextRight,
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
      headerHTML: formValues.title || '',
      footerHTML: activeContent?.footerHTML || '',
      logo: finalLogo,
      logoText: finalLogoText,
      logoTextRight: finalLogoTextRight
    };

    try {
      if (effectiveId) {
        // Update existing revision draft
        const body = {
          title: formValues.title,
          content: JSON.stringify(contentObj),
          elements: JSON.stringify(elementsObj),
          version: document.version + 1,
          revision_parent_id: document.document_id,
          impact: impactData || {},
          required_approvers: documentRequiredApprovers
        };

        if (!isAutoSave) {
          body.status = docStatus;
          if (workflowForSubmit) {
            body.approvers = workflowForSubmit;
          }
        }

        const res = await axios.put(`/api/update_document/${effectiveId}`, body);
        if (res.data.success) {
          if (!isAutoSave) {
            onCancel();
          }
          return true;
        }
      } else {
        // Create new revision draft
        if (isCreatingRef.current) return false;
        isCreatingRef.current = true;

        const payload = {
          title: formValues.title,
          created_by: creatorId,
          template_id: formValues.templateId || null,
          content: contentObj,
          comments: activeContent?.comments || [],
          suggestedEdits: activeContent?.suggestions || [],
          references: activeContent?.references || [],
          headerHTML: formValues.title || '',
          footerHTML: activeContent?.footerHTML || '',
          logo: finalLogo,
          logoText: finalLogoText,
          logoTextRight: finalLogoTextRight,
          tasks: validTasks,
          participants: participants.map((p) => ({
            user_id: p.userId,
            role: mapParticipantRoleForDb(p.role)
          })),
          status: docStatus,
          version: document.version + 1,
          revision_parent_id: document.document_id,
          impact: impactData || {},
          required_approvers: documentRequiredApprovers
        };

        if (docStatus === 'pending_review' || docStatus === 'pending_approval') {
          payload.approvers = workflowForSubmit;
        }

        const res = await axios.post('/api/create-document', payload);
        if (res.data.success) {
          const newId = res.data.document_id;
          currentDocumentIdRef.current = newId;
          setCurrentDocumentId(newId);

          // Mark parent template/document as pending revision
          await handleReviseParentDocument(document.document_id, isAutoSave);

          if (!isAutoSave) {
            onCancel();
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
        if (ok) toastAlert('Document revision saved as draft');
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
            successAlert('Document revision submitted', `Document revision submitted for ${actionText} successfully.`);
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

  const renderTabNavButtons = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
      <Button
        onClick={() => {
          onCancel();
        }}
        style={{ marginRight: 'auto' }}
      >
        ← Back to Documents
      </Button>
      <Space>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigateToTab('prev')}
          disabled={activeTab === "basicInfo"}
        >
          Previous
        </Button>
        <Button
          type="primary"
          onClick={() => navigateToTab('next')}
          disabled={activeTab === "review"}
        >
          Next <RightOutlined />
        </Button>
        {activeTab === "review" && (
          <Dropdown menu={{ items: docMenuItems }} placement="bottomRight">
            <Button type="primary">
              Submit Revision <DownOutlined />
            </Button>
          </Dropdown>
        )}
      </Space>
      {Object.values(tabStatus).some(s => s === 'incomplete') && (
        <div style={{ color: '#ff4d4f', marginTop: 8, textAlign: 'right', width: '100%' }}>
          Please complete all required fields in the highlighted tabs before submitting
        </div>
      )}
    </div>
  );

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
        name="templateId"
        label="Template"
      >
        <Select
          placeholder="Select a template (optional)"
          showSearch
          optionFilterProp="children"
          disabled
        >
          {availableTemplates.map(template => (
            <Option key={template.id} value={template.id}>
              {template.name}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="impactTemplateId"
        label="Impact Template"
        extra="Inherited from the original document. Cannot be changed during revision."
      >
        <Select
          placeholder="No impact template selected"
          disabled
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
                  <Button
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => removeTask(index)}
                    style={{ float: 'right' }}
                    size="small"
                  />
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
                  <div style={{ fontSize: 'smaller', color: '#666' }}>{user.first_name} {user.last_name}</div>
                </div>
              </Option>
            ))
          }
        </Select>
      </div>

      {participants.length > 0 ? (
        <Table
          dataSource={participants}
          rowKey="userId"
          pagination={false}
          columns={[
            {
              title: 'User',
              dataIndex: 'userId',
              key: 'user',
              render: (uid) => {
                const u = users.find(x => x.id === uid);
                return u ? `${u.first_name} ${u.last_name} (${u.email})` : 'Unknown User';
              }
            },
            {
              title: 'Permission Role',
              dataIndex: 'role',
              key: 'role',
              render: (role, record) => (
                <Select
                  value={role}
                  onChange={(val) => updateParticipantRole(record.userId, val)}
                  style={{ width: 130 }}
                >
                  <Option value="editor">Editor</Option>
                  <Option value="commenter">Commenter</Option>
                  <Option value="viewer">Viewer</Option>
                </Select>
              )
            },
            {
              title: 'Action',
              key: 'action',
              render: (_, record) => (
                <Button
                  type="link"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => removeParticipant(record.userId)}
                />
              )
            }
          ]}
        />
      ) : (
        <Empty description="No other participants added yet" />
      )}
    </Card>
  );

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
            const documentTitle = getFieldValue('title');

            const fallbackEmpty = {
              content: '',
              comments: [],
              suggestions: [],
              references: [],
              logo: null,
              headerHTML: '',
              footerHTML: '',
              logoText: '',
              logoTextRight: ''
            };

            const cd = contentData && typeof contentData === 'object' ? contentData : fallbackEmpty;

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

  const renderReviewTab = () => (
    <Card
      bordered={false}
      title={
        <span>
          Review Revision Settings
          <Tooltip title="Please review your document configuration before submitting.">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small" title="Basic Information">
            <p><strong>Title:</strong> {form.getFieldValue('title')}</p>
            <p><strong>Original Title:</strong> {document.title}</p>
            <p><strong>New Version:</strong> {document.version + 1}</p>
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Tasks Summary">
            {tasks.length > 0 ? (
              <ul>
                {tasks.map((t, idx) => (
                  <li key={idx}>
                    <strong>{t.title}</strong> {t.dueDate ? `(Due: ${moment(t.dueDate).format('YYYY-MM-DD')})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <Text type="secondary">No tasks defined</Text>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Participants Summary">
            {participants.length > 0 ? (
              <ul>
                {participants.map((p, idx) => {
                  const u = users.find(x => x.id === p.userId);
                  return (
                    <li key={idx}>
                      {u ? `${u.first_name} ${u.last_name}` : 'Unknown'} - <Tag color={roleColors[p.role]}>{p.role}</Tag>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Text type="secondary">No additional participants added</Text>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Impact Assessment Summary">
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
      </Row>

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Dropdown menu={{ items: docMenuItems }} placement="bottomRight">
          <Button type="primary" size="large">
            Submit Document Revision <DownOutlined />
          </Button>
        </Dropdown>
      </div>
    </Card>
  );

  return (
    <div className="revise-document-tabs">
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card bordered={false}>
            <Title level={3}>
              <FileTextOutlined /> Revisions & Lifecycles: Revise Document
            </Title>
            <Text type="secondary">
              You are revising the published document: <strong>{document.title}</strong> (v{document.version}).
              Creating a revision will mark the original document as <code>pending_revision</code> and generate a new <code>draft</code> version (v{document.version + 1}).
            </Text>
          </Card>
        </Col>

        <Col span={24}>
          {renderTabNavButtons()}

          <Form
            form={form}
            layout="vertical"
          >
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              type="card"
              destroyInactiveTabPane={false}
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
                      <FileTextOutlined /> Tasks
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
                  key: "attachments",
                  label: (
                    <span>
                      <PaperClipOutlined /> Attachments
                    </span>
                  ),
                  children: (
                    <AttachmentsTab
                      associationType="document"
                      associationId={currentDocumentId || document?.document_id}
                      canEdit={true}
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
                      <FileSearchOutlined /> Review & Submit
                    </Badge>
                  ),
                  children: renderReviewTab()
                }
              ]}
            />
          </Form>
        </Col>
      </Row>

      <Modal
        title={`Select Document ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`}
        visible={documentApproversModalVisible}
        onCancel={() => setDocumentApproversModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDocumentApproversModalVisible(false)}>
            Close
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={() => {
              handleSubmit(approverType === 'review' ? 'pending_review' : 'pending_approval');
              setDocumentApproversModalVisible(false);
            }}
            disabled={
              (approverType === 'review' && documentWorkflowApprovers.reviewers.length === 0) ||
              (approverType === 'approval' && documentWorkflowApprovers.approvers.length === 0) ||
              !sharedDueDate
            }
          >
            Submit for {approverType === 'review' ? 'Review' : 'Approval'}
          </Button>
        ]}
        width={800}
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="Submission Type" size="small">
              <Radio.Group
                value={approverType}
                onChange={(e) => setApproverType(e.target.value)}
                style={{ width: '100%' }}
              >
                <Radio value="review">Submit for Review</Radio>
                <Radio value="approval">Submit for Approval</Radio>
              </Radio.Group>
              <Alert
                message={
                  approverType === 'review'
                    ? "Reviewers will provide feedback and recommendations on the document"
                    : "Approvers will make the final decision to approve or reject the document"
                }
                type="info"
                style={{ marginTop: 8 }}
              />
            </Card>
          </Col>

          <Col span={24}>
            <Card title="Due Date" size="small">
              <DatePicker
                style={{ width: '100%' }}
                placeholder="Select due date"
                value={sharedDueDate}
                onChange={setSharedDueDate}
                disabledDate={(current) => current && current < moment().startOf('day')}
              />
            </Card>
          </Col>

          <Col span={24}>
            <Card title={`Add Document ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
              <Select
                style={{ width: '100%' }}
                placeholder="Select users by email"
                value={null}
                onChange={handleAddDocumentApprover}
                optionLabelProp="label"
                showSearch
                filterOption={(input, option) =>
                  option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {users
                  .filter(u => {
                    const currentArray = approverType === 'review' ? documentWorkflowApprovers.reviewers : documentWorkflowApprovers.approvers;
                    return !currentArray.some(a => a.userId === u.id) && u.template_approver === 'yes';
                  })
                  .map(u => (
                    <Option
                      key={u.id}
                      value={u.id}
                      label={u.email}
                    >
                      <div>
                        <div>{u.email}</div>
                        <div style={{ fontSize: 'smaller', color: '#666' }}>{u.first_name} {u.last_name}</div>
                        {u.department && (
                          <div style={{ fontSize: 'smaller', color: '#666' }}>
                            Department: {u.department}
                          </div>
                        )}
                      </div>
                    </Option>
                  ))
                }
              </Select>
            </Card>
          </Col>

          <Col span={24}>
            <Card title={`Selected Document ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
              {(() => {
                const currentArray = approverType === 'review' ? documentWorkflowApprovers.reviewers : documentWorkflowApprovers.approvers;
                return currentArray.length > 0 ? (
                  <Table
                    dataSource={currentArray}
                    rowKey="userId"
                    pagination={false}
                    columns={[
                      {
                        title: 'Name',
                        dataIndex: 'name',
                        key: 'name',
                      },
                      {
                        title: 'Email',
                        dataIndex: 'email',
                        key: 'email',
                      },
                      {
                        title: 'Role',
                        dataIndex: 'role',
                        key: 'role',
                        render: (role) => (
                          <Tag color={role === DOC_REVIEWER_ROLE ? 'blue' : 'green'}>
                            {role === DOC_REVIEWER_ROLE ? 'Reviewer' : 'Approver'}
                          </Tag>
                        )
                      },
                      {
                        title: 'Action',
                        key: 'action',
                        render: (_, record) => (
                          <Button
                            type="link"
                            danger
                            onClick={() => handleRemoveDocumentApprover(record.userId)}
                          >
                            Remove
                          </Button>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <Empty description={`No document ${approverType === 'review' ? 'reviewers' : 'approvers'} selected`} />
                );
              })()}
            </Card>
          </Col>
        </Row>
      </Modal>
    </div>
  );
};

export default ReviseDocument;
