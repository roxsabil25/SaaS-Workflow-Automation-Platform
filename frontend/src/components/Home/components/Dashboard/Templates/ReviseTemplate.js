import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import EditorPlaceholder from "../../../../EditorPlaceholder";
import { successAlert, errorAlert, toastAlert } from '../../../../../utils/alerts';
import { socket } from '../../../../../utils/SocketProvider';
import { 
  Card, Form, Input, Button, Steps, Select, Switch, Checkbox, 
  Row, Col, Tag, Typography, Alert, Divider, Table, Space, 
  Tabs, message, Badge, Dropdown, Modal, Empty, Tooltip, DatePicker, Radio
} from 'antd';
import { 
  FileTextOutlined, SaveOutlined, PlusOutlined, 
  UserOutlined, TeamOutlined, SettingOutlined, ArrowUpOutlined, 
  ArrowDownOutlined, FileTextTwoTone, TeamOutlined as TeamOutlinedTwo, 
  LockOutlined as LockOutlinedTwo, EditOutlined, FileSearchOutlined, 
  MessageOutlined, LeftOutlined, RightOutlined, DownOutlined, DeleteOutlined,
  InfoCircleOutlined, PaperClipOutlined, BookOutlined, HistoryOutlined
} from '@ant-design/icons';
import moment from 'moment';

import { debounce } from 'lodash';
import { stripCommentHighlights } from '../../../../../utils/templateUtils';
import AttachmentsTab from '../../../../Unified/UnifiedTextEditor/Preview/components/AttachmentsTab';
import ReferencesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/ReferencesTab';
import TemplateRevisionHistoryTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateRevisionHistoryTab';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Step } = Steps;
const { TabPane } = Tabs;
const { Option } = Select;

const ReviseTemplate = ({ fetchUserData, template, user, users, categories, departments, onCancel }) => {
  const [form] = Form.useForm();
  const [filterCategory, setCategory] = useState();
  const [contentData, setContentData] = useState(null);
  const [activeTab, setActiveTab] = useState("basicInfo");
  const [approvers, setApprovers] = useState([]);
  const [lockedElements, setLockedElements] = useState({
    content: false,
    toc: false,
    fontSize: false,
    fontStyle: false,
    headerFooter: false
  });
  const selectRef = useRef(null);
  const [currentTemplateId, setCurrentTemplateId] = useState(null);
  const [liveInitialContent, setLiveInitialContent] = useState(null);
  const [tempReferences, setTempReferences] = useState([]);
  const [tempManualReferences, setTempManualReferences] = useState([]);

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

  // Track tab completion status
  const [tabStatus, setTabStatus] = useState({
    basicInfo: "incomplete",
    approvers: "incomplete",
    structure: "incomplete",
    content: "incomplete",
    notes: "incomplete", 
    review: "incomplete"
  });

  const [templateApproversModalVisible, setTemplateApproversModalVisible] = useState(false);
  const [templateApprovers, setTemplateApprovers] = useState({
    reviewers: [],
    approvers: []
  });
  const [approverType, setApproverType] = useState('review'); // 'review' or 'approval'
  const [sharedDueDate, setSharedDueDate] = useState(null);
  const [selectedTemplateApprover, setSelectedTemplateApprover] = useState(null);

// Add this useEffect at the beginning of your component to auto-fill form data
useEffect(() => {
  if (template) {
    // Parse JSON string values
    // Parse content and comments
    let loadedContentData = { content: '', comments: [], suggestions: [], references: [], manualReferences: [] };
    try {
      if (template.comments) {
        try {
          const parsedComments = typeof template.comments === 'string' ? JSON.parse(template.comments) : template.comments;
          if (parsedComments && typeof parsedComments.content === 'string') {
            // STRIP HIGHLIGHTS AND COMMENTS FOR REVISION
            const cleanedContent = stripCommentHighlights(parsedComments.content);
            loadedContentData = { 
              content: cleanedContent,
              comments: [], // Clear comments for new revision
              suggestions: [], // Clear suggestions for new revision
              references: (parsedComments.references && Array.isArray(parsedComments.references))
                ? parsedComments.references.filter(r => !r.isManual && r.refAnchor)
                : [],
              manualReferences: parsedComments.manualReferences || (parsedComments.references && Array.isArray(parsedComments.references)
                ? parsedComments.references.filter(r => r.isManual || !r.refAnchor)
                : []),
              headerHTML: parsedComments.headerHTML || '',
              footerHTML: parsedComments.footerHTML || '',
              logo: parsedComments.logo || null,
              logoText: parsedComments.logoText || ''
            };
          } else {
            // Check if it's the old structure (just comments array)
            const content = template.content || '';
            const cleanedContent = stripCommentHighlights(content);
            loadedContentData = { 
              content: cleanedContent,
              comments: [], 
              suggestions: [],
              references: [],
              manualReferences: []
            };
          }
        } catch (e) {
          const content = template.content || '';
          const cleanedContent = stripCommentHighlights(content);
          loadedContentData = { content: cleanedContent, comments: [], suggestions: [], references: [], manualReferences: [] };
        }
      } else if (template.content) {
        // Fallback to content column
        try {
           const parsedContent = typeof template.content === 'string' ? JSON.parse(template.content) : template.content;
           if (typeof parsedContent === 'object' && parsedContent !== null) {
             const cleanedContent = stripCommentHighlights(parsedContent.content || '');
             loadedContentData = {
               ...parsedContent,
               content: cleanedContent,
               comments: [],
               suggestions: [],
               references: (parsedContent.references && Array.isArray(parsedContent.references))
                 ? parsedContent.references.filter(r => !r.isManual && r.refAnchor)
                 : [],
               manualReferences: parsedContent.manualReferences || (parsedContent.references && Array.isArray(parsedContent.references)
                 ? parsedContent.references.filter(r => r.isManual || !r.refAnchor)
                 : []),
               headerHTML: parsedContent.headerHTML || '',
               footerHTML: parsedContent.footerHTML || '',
               logo: parsedContent.logo || null,
               logoText: parsedContent.logoText || ''
             };
           } else {
             const cleanedContent = stripCommentHighlights(String(template.content));
             loadedContentData = { 
               content: cleanedContent,
               comments: [],
               suggestions: [],
               references: [],
               manualReferences: []
             };
           }
        } catch (e) {
           const cleanedContent = stripCommentHighlights(String(template.content));
           loadedContentData = { 
             content: cleanedContent,
             comments: [],
             suggestions: [],
             references: [],
             manualReferences: []
           };
        }
      }
    } catch (error) {
      console.error('Error parsing template content/comments:', error);
      loadedContentData = { content: template.content || '', comments: [], suggestions: [], references: [], manualReferences: [] };
    }

    const templateStructure = JSON.parse(template.template_structure || '{}');
    const requiredApprovers = JSON.parse(template.required_approvers || '[]');
    
    // Set state variables
    setContentData(loadedContentData);
    setLiveInitialContent(loadedContentData);
    setTempReferences(loadedContentData.references || []);
    setTempManualReferences(loadedContentData.manualReferences || []);
    
    // Set the locked elements state
    if (templateStructure.locked_elements) {
      setLockedElements(templateStructure.locked_elements);
    }
    
    // Set approvers state
    if (requiredApprovers.length > 0) {
      setApprovers(requiredApprovers.map(approver => {
        // Ensure the dueDate is converted to moment if present
        if (approver.dueDate) {
          approver.dueDate = moment(approver.dueDate);
        }
        return approver;
      }));
    }
    
    // Set form values
    form.setFieldsValue({
      name: template.name,
      description: template.description,
      category: template.category_id,
      notes: template.notes,
      
      // Structure settings
      includeTableOfContents: templateStructure.includeTableOfContents || false,
      allowAttachments: templateStructure.allowAttachments || false,
      
      // Set lock element values from templateStructure
      lockContent: templateStructure.locked_elements?.content || false,
      lockTOC: templateStructure.locked_elements?.toc || false,
      lockFontSize: templateStructure.locked_elements?.fontSize || false,
      lockFontStyle: templateStructure.locked_elements?.fontStyle || false,
      lockHeaderFooter: templateStructure.locked_elements?.headerFooter || false,
      
      // Initialize approvers in form
      approvers: requiredApprovers.map(approver => ({
        department: approver.department,
        mandatory: approver.mandatory,
        stage: approver.stage,
      })),
    });
        
    // Mark all tabs as viewed since we're editing an existing template
    setTabStatus({
      basicInfo: "complete",
      approvers: requiredApprovers.length > 0 ? "complete" : "incomplete",
      structure: "complete",
      content: "complete",
      notes: "complete",
      review: "complete"
    });
    
    // Set the category
    if (template.category_id) {
      setCategory(template.category_id);
    }
  }
}, [template, form]);

  // Auto-save timer setup
  // Auto-save logic
  const contentDataRef = useRef(contentData);
  useEffect(() => {
    contentDataRef.current = contentData;
  }, [contentData]);

  // Debounced save function
  const debouncedSave = useRef(
    debounce(() => {
      // Use current ref values to avoid stale closures
      if (currentTemplateId || form.getFieldValue('name')) {
        console.log('📝 Triggering debounced auto-save'); 
        performAutoSave();
      }
    }, 2000)
  ).current;

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const performAutoSave = () => {
     handleSubmit('draft', true, contentDataRef.current);
  };

  // Validate fields on tab change
  const validateTabFields = async (tab) => {
    try {
      // Define which fields to validate for each tab
      const tabFieldMapping = {
        basicInfo: ['name', 'description', 'category'],
        approvers: [], // We'll handle approvers validation separately
        structure: [], // No required fields in structure tab
        content: [], // Content tab validation will depend on your implementation
        notes: [], // Notes are optional
        review: [] // Review tab doesn't have form fields to validate
      };

      // Get fields for the current tab
      const fields = tabFieldMapping[tab];
            
      if (!fields || fields.length === 0) {
        // If no fields to validate or they're optional, mark as complete
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      // Validate specific fields
      await form.validateFields(fields);
      
      // If validation succeeds, mark tab as complete
      setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
      return true;
    } catch (error) {
      console.log("Validation error:", error);
      // If validation fails, tab remains incomplete
      setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
      return false;
    }
  };

  // Function to handle adding template approvers
const handleAddTemplateApprover = (userId) => {
  const user = users.find(u => u.id === userId);
  if (!user) return;

  const newApprover = {
    userId,
    name: `${user.first_name} ${user.last_name}`,
    email: user.email,
    department: user.department || '',
    role: approverType === 'review' ? 'template_reviewer' : 'template_approver',
    status: 'pending',
    dueDate: sharedDueDate,
    ...(approverType === 'approval' && { comment: '' })
  };

  const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
  
  // Check if user already exists in the current target array
  if (!templateApprovers[targetArray].some(approver => approver.userId === userId)) {
    setTemplateApprovers(prev => ({
      ...prev,
      [targetArray]: [...prev[targetArray], newApprover]
    }));
  }
  
  setSelectedTemplateApprover(null);
};

  // Function to remove template approver
const handleRemoveTemplateApprover = (userId) => {
  const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
  
  setTemplateApprovers(prev => ({
    ...prev,
    [targetArray]: prev[targetArray].filter(approver => approver.userId !== userId)
  }));
};

  // Function to open the template approvers modal
  const showTemplateApproversModal = () => {
    setTemplateApproversModalVisible(true);
  };

  // Function to close the template approvers modal
  const handleTemplateApproversModalCancel = () => {
    setTemplateApproversModalVisible(false);
  };

  // Check if at least one user is assigned for each approver
  useEffect(() => {
    // First check if there are any approvers at all
    const hasApprovers = approvers.length > 0;
    
    // Then check if all approvers have at least one participant
    const allApproversHaveParticipants = hasApprovers && 
      approvers.every(approver => (approver.participants || []).length > 0);
    
    setTabStatus(prev => ({ 
      ...prev, 
      approvers: hasApprovers && allApproversHaveParticipants ? "complete" : "incomplete" 
    }));
  }, [approvers]);

  // Track if all required tabs are complete for submission
  const canSubmit = Object.entries(tabStatus)
    .filter(([key]) => key !== 'notes') // Notes tab is optional
    .every(([_, status]) => status === "complete");

  const approverColumns = [
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 250, 
      render: (_, record) => {
        // Get already selected departments (excluding current record)
        const selectedDepartments = approvers
          .filter(approver => approver.key !== record.key)
          .map(approver => approver.department);
        
        // Filter available departments
        const availableDepartments = departments.filter(
          dept => !selectedDepartments.includes(dept.name)
        );
        
        // If current department is selected but not in available list, add it back
        const deptOptions = [
          ...availableDepartments,
          ...(record.department && 
            !availableDepartments.some(d => d.name === record.department) ? 
            [departments.find(d => d.name === record.department)] : 
            []
          )
        ].filter(Boolean);
        
        return (
          <Select
            value={record.department}
            style={{ width: '100%' }}
            onChange={(value) => handleApproverDepartmentChange(record.key, value)}
          >
            {deptOptions.map(dept => (
              <Option key={dept.id} value={dept.name}>{dept.name}</Option>
            ))}
          </Select>
        );
      },
    },
    {
      title: 'Mandatory',
      dataIndex: 'mandatory',
      key: 'mandatory',
      width: 120, 
      render: (_, record) => (
        <Tooltip title="When checked, the document cannot proceed to the next stage without this department's approval">
          <Checkbox 
            checked={record.mandatory} 
            onChange={(e) => handleApproverChange(record.key, 'mandatory', e.target.checked)}
          />
        </Tooltip>
      )
    },    
{
  title: 'Stage',
  dataIndex: 'stage',
  key: 'stage',
  width: 150, 
  render: (_, record) => {
    // Get all available stages (current stages + 1 more)
    const existingStages = [...new Set(approvers.map(a => a.stage))].sort((a, b) => a - b);
    const maxStage = Math.max(...existingStages, 0);
    
    // Generate available stage options (all existing stages plus up to maxStage+1)
    // This prevents gaps while allowing multiple approvers at the same stage
    const stageOptions = [];
    for (let i = 1; i <= maxStage + 1; i++) {
      stageOptions.push(i);
    }
    
    return (
      <Select
        value={record.stage}
        style={{ width: 80 }}
        onChange={(value) => {
          // Update the stage for this approver
          const updatedApprovers = approvers.map(approver => {
            if (approver.key === record.key) {
              return { ...approver, stage: value };
            }
            return approver;
          });
          setApprovers(updatedApprovers);
        }}
      >
        {stageOptions.map(stage => (
          <Option key={stage} value={stage}>
            {stage}
          </Option>
        ))}
      </Select>
    );
  }
},
    {
      title: '',
      key: 'action',
      width: 80, 
      render: (_, record) => (
        <Button type="link" icon={<DeleteOutlined/>} danger onClick={() => removeApprover(record.key)}></Button>
      ),
    },
  ];

  // Update display-only columns for the review tab
  const displayApproverColumns = [
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (text) => <span>{text}</span>,
    },
    {
      title: 'Mandatory',
      dataIndex: 'mandatory',
      key: 'mandatory',
      render: (text) => (
        <Tag color={text ? 'green' : 'red'}>
          {text ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (text) => <Tag>{text}</Tag>,
    },
  ];

  const handleApproverDepartmentChange = (key, value) => {
    // First update form values
    const currentApprovers = [...form.getFieldValue('approvers') || []];
    if (currentApprovers[key]) {
      // Update department
      currentApprovers[key].department = value;
      // Clear participants
      currentApprovers[key].participants = [];
      // Update form values
      form.setFieldsValue({ approvers: currentApprovers });
    }
    
    // Then update state
    const updatedApprovers = approvers.map(approver => {
      if (approver.key === key) {
        return { 
          ...approver, 
          department: value,
          participants: [] // Clear participants when department changes
        };
      }
      return approver;
    });
    
    setApprovers(updatedApprovers);
  };

  // Navigation between tabs
  const navigateToTab = (direction) => {
    const tabs = ["basicInfo", "approvers", "structure", "content", "notes", "attachments", "review"];
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
    // If the current tab has validation, validate it first
    if (activeTab) {
      const isValid = await validateTabFields(activeTab);
      // Even if not valid, we still allow changing tabs
    }
    
    // Mark the tab as viewed
    if (tabStatus[key] === "incomplete" && 
        (key === "structure" || key === "content" || key === "notes" || key === "review")) {
      setTabStatus(prev => ({ ...prev, [key]: "complete" }));
    }
    
    setActiveTab(key);
  };

  const validateAllTabs = async () => {
    const allTabs = ["basicInfo", "approvers", "structure", "content", "notes"];
    let isValid = true;
    
    for (const tab of allTabs) {
      const valid = await validateTabFields(tab);
      if (!valid) isValid = false;
    }
    
    return isValid;
  };

  // Explicitly structure data for submission
const handleSubmit = (status = 'pending', isAutoSave = false, overrideContentData = null) => {
  // Determine the actual status based on approver type
  let finalStatus = status;
  if (status === 'pending') {
    finalStatus = approverType === 'review' ? 'pending_review' : 'pending_approval';
  }

  // For pending status, validate all tabs
  if (status === 'pending' && !isAutoSave) {
    validateAllTabs().then(isValid => {
      if (!isValid) {
        errorAlert('Submission Failed','Please complete all required fields before submitting');
        return;
      }
      saveTemplateData(finalStatus);
      const actionText = approverType === 'review' ? 'Review' : 'Approval';
      successAlert('Template Submitted', `Template submitted for ${actionText} successfully`);
    });
  } else {
    // For draft or auto-save, skip validation
    saveTemplateData(finalStatus, isAutoSave, overrideContentData);
    if (!isAutoSave) {
      toastAlert('Template Saved as Draft');
    }
  }
};

  // Extract the actual saving logic to a separate function
const saveTemplateData = (status, isAutoSave = false, overrideContentData = null) => {
  const formValues = form.getFieldsValue(true);
  const activeContentData = overrideContentData || contentData;
  
  // Update the shared due date for all approvers of the current type
  const updatedTemplateApprovers = { ...templateApprovers };
  if (sharedDueDate && (status === 'pending_review' || status === 'pending_approval')) {
    const targetArray = status === 'pending_review' ? 'reviewers' : 'approvers';
    updatedTemplateApprovers[targetArray] = updatedTemplateApprovers[targetArray].map(approver => ({
      ...approver,
      dueDate: sharedDueDate
    }));
  }

  const templateData = {
      // Basic template info
      name: formValues.name,
      description: formValues.description,
      category_id: formValues.category,
      
      // User and org info
      created_by: user?.id,
      organization_id: user?.orgId,
      
      // Template approvers - formatted as JSON string for database
      template_approvers: (status === 'pending_review' || status === 'pending_approval') ? updatedTemplateApprovers : null,
      
      // Approvers and locked elements from state
      approvers: approvers,
      locked_elements: lockedElements,
      
      // Content structure settings
      includeTableOfContents: formValues.includeTableOfContents || false,
      allowAttachments: formValues.allowAttachments || false,
      
      // Content data
      content: (activeContentData && activeContentData.content) || '',

      // Comments and suggestions data - store full object in comments column
      comments: {
        content: (activeContentData && activeContentData.content) || '',
        comments: (activeContentData && activeContentData.comments) || [],
        suggestions: (activeContentData && activeContentData.suggestions) || [],
        references: (activeContentData && activeContentData.references) || [],
        manualReferences: (activeContentData && activeContentData.manualReferences) || [],
        headerHTML: (activeContentData && activeContentData.headerHTML) || '',
        footerHTML: (activeContentData && activeContentData.footerHTML) || '',
        logo: (activeContentData && activeContentData.logo) || null,
        logoText: (activeContentData && activeContentData.logoText) || ''
      },

      // Notes/Remarks
      notes: formValues.notes || '',
      
      // Status - new field
      status: status,

      version: template.version + 1,

      revision_parent_id: template.id
    };
    
    if (isAutoSave) {
      // Silent autosave for production feel
      if (currentTemplateId) {
        // toastAlert('Template auto-saved');
      }
    }

    // If we already have a template ID, update it. Otherwise create new
    if (currentTemplateId) {
      updateExistingTemplate(templateData, status, isAutoSave);
    } else {
      createNewTemplate(templateData, status, isAutoSave);
    }
  };

  // API Functions
  const handleTemplateStatusUpdate = async (templateId, newStatus) => {
    try {
      const response = await axios.put(`/api/templates/${templateId}/status`, {
        status: newStatus
      });
      
      if (response.status === 200) {
        return response.data;
      }
      throw new Error('Failed to update template status');
    } catch (error) {
      console.error('Error updating template status:', error);
      throw error;
    }
  };

  // Template Status Management Functions
  const handleReviseTemplate = async (templateId, isAutoSave = false) => {    
    try {
      await handleTemplateStatusUpdate(templateId, 'pending_revision');
      if (!isAutoSave) {
        message.success('Template successfully revised');
        fetchUserData();
      }
    } catch (error) {
      console.error('Error revising template:', error);
      if (!isAutoSave) {
        message.error('Failed to revise template. Please try again.');
      }
    }
  };

  // Function to create a new template
  const createNewTemplate = async (templateData, status, isAutoSave) => {
    try {
      const response = await axios.post('/api/newtemplate', templateData);
      
      if (response.data.success) {
        // Store the template ID for future updates
        setCurrentTemplateId(response.data.templateId);
        handleReviseTemplate(template.id, isAutoSave);
        if (!isAutoSave) {
          // Only show notification for user-initiated saves
          successAlert('Template Created', `Template has been created successfully`);
          onCancel();
        }
      }
    } catch (error) {
      console.error('Error creating template:', error);
      if (!isAutoSave) {
        // Only show error for user-initiated saves
        errorAlert('Creation Failed', error.response?.data?.message || 'There was an error creating your template');
      }
    }
  };

  // Function to update an existing template
  const updateExistingTemplate = async (templateData, status, isAutoSave) => {
    try {
      const response = await axios.put(`/api/update_template/${currentTemplateId}`, templateData);
      
      if (response.data.success) {
        if (!isAutoSave) {
          // Only show notification for user-initiated saves
          successAlert('Template Updated', `Template has been updated successfully`);
        onCancel();
        }
      }
    } catch (error) {
      console.error('Error updating template:', error);
      if (!isAutoSave) {
        // Only show error for user-initiated saves
        errorAlert('Update Failed', error.response?.data?.message || 'There was an error updating your template');
      }
    }
  };

  // Dropdown menu items
const items = [
  {
    key: 'review',
    label: 'Submit for Review',
    icon: <FileSearchOutlined />,
    onClick: () => {
      setApproverType('review');
      showTemplateApproversModal();
    }
  },
  {
    key: 'approval',
    label: 'Submit for Approval',
    icon: <SaveOutlined />,
    onClick: () => {
      setApproverType('approval');
      showTemplateApproversModal();
    }
  },
  {
    key: 'draft',
    label: 'Save as Draft',
    icon: <FileTextOutlined />,
    onClick: () => handleSubmit('draft')
  }
];

  // Update the addApprover function to ensure proper stage numbering
const addApprover = () => {
  // Get already selected departments
  const selectedDepartments = approvers.map(approver => approver.department);
  
  // Check if there are any unselected departments left
  const availableDepartments = departments.filter(
    dept => !selectedDepartments.includes(dept.name)
  );
  
  if (availableDepartments.length === 0) {
    message.warning('All departments have already been assigned as approvers.');
    return;
  }
  
  // Find all existing stages and get the maximum stage number
  const existingStages = approvers.map(a => a.stage);
  const maxStage = existingStages.length > 0 ? Math.max(...existingStages) : 0;
  
  // Default to stage 1 for the first approver, otherwise use the latest stage
  const nextStage = maxStage > 0 ? maxStage : 1;
  
  const newApprover = {
    key: approvers.length,
    department: availableDepartments[0]?.name || '',
    mandatory: false,
    stage: nextStage,
    participants: []
  };
  
  setApprovers([...approvers, newApprover]);
};

  // Update the removeApprover function to reindex stages
  const removeApprover = (key) => {
    const approverToRemove = approvers.find(a => a.key === key);
    if (!approverToRemove) return;
    
    const removedStage = approverToRemove.stage;
    
    // Remove the approver
    const filteredApprovers = approvers.filter(approver => approver.key !== key);
    
    // Adjust stages for remaining approvers
    const updatedApprovers = filteredApprovers.map(approver => {
      if (approver.stage > removedStage) {
        return { ...approver, stage: approver.stage - 1 };
      }
      return approver;
    });
    
    // Sort by stage
    const sortedApprovers = [...updatedApprovers].sort((a, b) => a.stage - b.stage);
    
    // Update keys to be sequential
    const reindexedApprovers = sortedApprovers.map((approver, index) => ({
      ...approver,
      key: index
    }));
    
    setApprovers(reindexedApprovers);
    
    // Update form values
    const updatedFormApprovers = reindexedApprovers.map(approver => {
      return {
        department: approver.department,
        participants: approver.participants,
        mandatory: approver.mandatory,
        stage: approver.stage
      };
    });
    
    form.setFieldsValue({ approvers: updatedFormApprovers });
  };

  const handleApproverChange = (key, field, value) => {
    setApprovers(approvers.map(approver => {
      if (approver.key === key) {
        return { ...approver, [field]: value };
      }
      return approver;
    }));
  };

  const handleLockElementToggle = (element) => {
    setLockedElements({
      ...lockedElements,
      [element]: !lockedElements[element]
    });
  };
    
  // Function to get parent names excluding current category
  const getParentPath = (folder_path, currentId) => {
    if (!folder_path) return [];
    
    return folder_path.split('/')
      .filter(id => id != currentId) // Exclude current category ID
      .map(id => {
        const cat = categories.find(c => c.category_id == id);
        return cat ? cat.category_name : null;
      })
      .filter(Boolean)
      .reverse(); // Show nearest parent first
  };

  // Get tab status badge color
  const getTabStatusColor = (tabKey) => {
    return tabStatus[tabKey] === "complete" ? "success" : "error";
  };

  // Initialize form with values for locked elements
  React.useEffect(() => {
    form.setFieldsValue({
      // Set initial values for form fields
      lockContent: lockedElements.content,
      lockTOC: lockedElements.toc,
      lockFontSize: lockedElements.fontSize,
      lockFontStyle: lockedElements.fontStyle,
      lockHeaderFooter: lockedElements.headerFooter,
    });
  }, [form]);

  // Effects for form-state synchronization
  React.useEffect(() => {
    // Update form values when lockedElements state changes
    form.setFieldsValue({
      lockContent: lockedElements.content,
      lockTOC: lockedElements.toc,
      lockFontSize: lockedElements.fontSize,
      lockFontStyle: lockedElements.fontStyle,
      lockHeaderFooter: lockedElements.headerFooter,
    });
  }, [lockedElements, form]);

  // Tab navigation buttons
  const renderTabNavButtons = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
      <Button 
        onClick={() => {
          /* confirmAlert(
            'Cancel Revising Template',
            'Are you sure you want to cancel editing template? All changes will not be saved and this action cannot be undone.',
            'Yes, Proceed',
            'Cancel',
          ).then((result) => {
            if (result.isConfirmed) {
              onCancel();
            }
          }); */
          onCancel();
        }}
        style={{ marginRight: 'auto' }}
      >
        ← Back to Templates
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
          <Dropdown menu={{ items }} placement="bottomRight">
            <Button type="primary">
              Update Template <DownOutlined />
            </Button>
          </Dropdown>
        )}
      </Space>
    </div>
  );

  // Basic information tab content
  const renderBasicInfoTab = () => (
    <Card bordered={false} title="Basic Template Information">
      <Form.Item
        name="name"
        label="Template Name"
        rules={[{ required: true, message: 'Please enter a template name' }]}
      >
        <Input placeholder="Enter template name" size="large" />
      </Form.Item>
      
      <Form.Item
        name="description"
        label="Description"
        rules={[{ required: true, message: 'Please provide a description' }]}
      >
        <TextArea rows={4} placeholder="Describe what this template is used for and any important details" />
      </Form.Item>
      
      <Form.Item
        name="category"
        label="Template Category"
      >
        <Select 
          placeholder="Select a category"                
          value={filterCategory}
          onChange={(value) => setCategory(value)}
          allowClear
        >
          {categories.map(category => {
            const parentPath = getParentPath(category.folder_path, category.category_id);
            
            return (
              <Option key={category.category_id} value={category.category_id}>
                <span style={{ fontWeight: 500 }}>{category.category_name}</span>
                {parentPath.length > 0 && (
                  <span style={{
                    color: '#888',
                    fontSize: '0.85em',
                    marginLeft: '6px',
                    fontWeight: 'normal'
                  }}>
                    (in {parentPath.join(' › ')})
                  </span>
                )}
              </Option>
            );
          })}
        </Select>
      </Form.Item>
    </Card>
  );

  // Approvers tab content
  const renderApproversTab = () => (
    <Card 
    bordered={false} 
    title=
      <span>
        Template Approvers Configuration 
          <Tooltip title="Define which departments must approve documents created from this template, whether their approval is mandatory, and at which stage they should review the document.">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
      </span>
    >
      
      <Row style={{ marginBottom: '16px' }}>
        <Col span={24}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={addApprover}
            disabled={departments.length <= approvers.length}
          >
            Add Approver
          </Button>
        </Col>
      </Row>
      
      <Table 
        columns={approverColumns} 
        dataSource={approvers}
        pagination={false}
        size="middle"
      />
      
      <Divider />
      
      <Paragraph type="secondary">
        <Text strong>Note:</Text> The Mandatory field determines if approval from this department is required. 
        The Stage field determines the order in which people will review the document.
      </Paragraph>
    </Card>
  );

  // Structure tab content
  const renderStructureTab = () => (
    <Card 
    bordered={false} 
    title=
      <span>
        Template Structure and Locked Elements 
          <Tooltip 
            title="Define which elements of the template should be locked and cannot be modified by users."
            >
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
      </span>
    >      
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card size="small" title="Content Locking">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Form.Item name="lockContent" valuePropName="checked" noStyle>
                  <Switch 
                    checked={lockedElements.content}
                    onChange={() => handleLockElementToggle('content')}
                  />
                </Form.Item>
                <Text> Lock Contents</Text>
              </div>
              <div>
                <Form.Item name="lockTOC" valuePropName="checked" noStyle>
                  <Switch 
                    checked={lockedElements.toc}
                    onChange={() => handleLockElementToggle('toc')}
                  />
                </Form.Item>
                <Text> Lock Table of Contents</Text>
              </div>
              <div>
                <Form.Item name="lockFontSize" valuePropName="checked" noStyle>
                  <Switch 
                    checked={lockedElements.fontSize}
                    onChange={() => handleLockElementToggle('fontSize')}
                  />
                </Form.Item>
                <Text> Lock Font Size</Text>
              </div>
              <div>
                <Form.Item name="lockFontStyle" valuePropName="checked" noStyle>
                  <Switch 
                    checked={lockedElements.fontStyle}
                    onChange={() => handleLockElementToggle('fontStyle')}
                  />
                </Form.Item>
                <Text> Lock Font Style</Text>
              </div>
              <div>
                <Form.Item name="lockHeaderFooter" valuePropName="checked" noStyle>
                  <Switch 
                    checked={lockedElements.headerFooter}
                    onChange={() => handleLockElementToggle('headerFooter')}
                  />
                </Form.Item>
                <Text> Lock Header/Footer</Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="Table of Contents">
            <Form.Item
              name="includeTableOfContents"
              valuePropName="checked"
              initialValue={false}
            >
              <Checkbox>Include Table of Contents (Index)</Checkbox>
            </Form.Item>
            <Text type="secondary">
              A table of contents will be automatically generated based on the document structure.
            </Text>
          </Card>
          
          <Card size="small" title="Attachments" style={{ marginTop: '16px' }}>
            <Form.Item
              name="allowAttachments"
              valuePropName="checked"
              initialValue={false}
            >
              <Checkbox>Allow File Attachments</Checkbox>
            </Form.Item>
          </Card>
        </Col>
      </Row>
    </Card>
  );

  // Content tab (integrating with external content editor)
  const renderContentTab = () => (
    <Card 
    bordered={false} 
    title=
      <span>
        Template Content 
          <Tooltip 
        title="Configure the template content structure and default values."
            >
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
      </span>
    >            
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <EditorPlaceholder 
          mode="create"
          user={user}
          templateId={currentTemplateId || template?.id}
        />
      </div>
    </Card>
  );



  // Notes/Remarks tab (new tab)
  const renderNotesTab = () => (
    <Card 
    bordered={false} 
    title=
      <span>
        Notes & Remarks 
          <Tooltip 
        title="Add any notes, remarks, or special instructions for this template that administrators might need to know."
            >
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
      </span>
    >                  
      <Form.Item
        name="notes"
        label="Admin Notes"
      >
        <TextArea 
          rows={6} 
          placeholder="Enter any additional notes, instructions, or remarks about this template (optional)"
        />
      </Form.Item>
    </Card>
  );

// Review tab content
  const renderReviewTab = () => (
    <Card 
    bordered={false} 
    title=
      <span>
        Review Template Settings 
          <Tooltip 
        title="Please review your template configuration before creating it."
            >
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
      </span>
    >                  
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small" title="Basic Information">
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => (
                <>
                  <p><strong>Name:</strong> {getFieldValue('name')}</p>
                  <p><strong>Description:</strong> {getFieldValue('description')}</p>
                  <p><strong>Category:</strong> {
                    categories.find(c => c.category_id === getFieldValue('category'))?.category_name || getFieldValue('category')
                  }</p>
                </>
              )}
            </Form.Item>
          </Card>
        </Col>
        
        <Col span={24}>
          <Card size="small" title="Approvers Configuration">
            <Table 
              columns={displayApproverColumns} 
              dataSource={approvers}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        
        <Col span={24}>
          <Card size="small" title="Locked Elements">
            <ul>
              {Object.entries(lockedElements).map(([key, value]) => (
                value ? <li key={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</li> : null
              ))}
            </ul>
            {!Object.values(lockedElements).some(Boolean) && <Text type="secondary">No elements locked</Text>}
          </Card>
        </Col>
        
        <Col span={24}>
          <Card size="small" title="Structure">
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => (
                <ul>
                  {getFieldValue('includeTableOfContents') && <li>Include Table of Contents (Index)</li>}
                  {getFieldValue('allowAttachments') && <li>Allow File Attachments</li>}
                  {!getFieldValue('includeTableOfContents') && !getFieldValue('allowAttachments') && 
                    <Text type="secondary">No special structure settings</Text>
                  }
                </ul>
              )}
            </Form.Item>
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Content Configuration">
            <Text type="secondary">Content configuration is set in the Content tab</Text>
          </Card>
        </Col>

        {/* <Col span={24}>
          <Card size="small" title="Notes & Remarks">
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => (
                <>
                  {getFieldValue('notes') ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{getFieldValue('notes')}</div>
                  ) : (
                    <Text type="secondary">No additional notes provided</Text>
                  )}
                </>
              )}
            </Form.Item>
          </Card>
        </Col> */}
      </Row>
      
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Dropdown menu={{ items }} placement="bottomRight">
          <Button type="primary" disabled={!canSubmit && items[0].key === 'submit'}>
            Update Template <DownOutlined />
          </Button>
        </Dropdown>
        {!canSubmit && (
          <div style={{ color: '#ff4d4f', marginTop: 8 }}>
            Please complete all required fields in the highlighted tabs before submitting
          </div>
        )}
      </div>
    </Card>
  );

  // Render the component
  return (
    <div className="create-template-tabs">
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card bordered={false}>
            <Title level={3}>
              <FileTextOutlined /> Update Template
            </Title>
            <Text type="secondary">
              Update the template that serves as the backbone for documents.
              Templates help maintain consistency and define approval workflows.
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
                  key: "approvers",
                  label: (
                    <Badge dot status={getTabStatusColor("approvers")} offset={[5, 0]}>
                      <TeamOutlinedTwo /> Approvers
                    </Badge>
                  ),
                  children: renderApproversTab()
                },
                {
                  key: "structure",
                  label: (
                    <Badge dot status={getTabStatusColor("structure")} offset={[5, 0]}>
                      <LockOutlinedTwo /> Structure & Locks
                    </Badge>
                  ),
                  children: renderStructureTab()
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
                  key: "notes",
                  label: (
                    <Badge dot status={getTabStatusColor("notes")} offset={[5, 0]}>
                      <MessageOutlined /> Notes
                    </Badge>
                  ),
                  children: renderNotesTab()
                },
                {
                  key: "revisionHistory",
                  label: (
                    <span>
                      <HistoryOutlined /> Revision History
                    </span>
                  ),
                  children: template?.id ? (
                    <TemplateRevisionHistoryTab 
                      templateId={template?.id}
                      currentVersion={template?.version}
                    />
                  ) : (
                    <Empty description="No parent template found" />
                  )
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
                      associationType="template" 
                      associationId={currentTemplateId || template?.id} 
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
<Modal
  title={`Select Template ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`}
  visible={templateApproversModalVisible}
  onCancel={handleTemplateApproversModalCancel}
  footer={[
    <Button key="close" onClick={handleTemplateApproversModalCancel}>
      Close
    </Button>,
    <Button 
      key="submit" 
      type="primary"
      onClick={() => {
        handleSubmit('pending');
        setTemplateApproversModalVisible(false);
      }}
      disabled={
        (approverType === 'review' && templateApprovers.reviewers.length === 0) ||
        (approverType === 'approval' && templateApprovers.approvers.length === 0) ||
        !sharedDueDate
      }
    >
      Submit for {approverType === 'review' ? 'Review' : 'Approval'}
    </Button>
  ]}
  width={800}
>      
  <Row gutter={[16, 16]}>
    {/* Approver Type Selection */}
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
              ? "Reviewers will provide feedback and recommendations on the template"
              : "Approvers will make the final decision to approve or reject the template"
          }
          type="info"
          style={{ marginTop: 8 }}
        />
      </Card>
    </Col>

    {/* Due Date Selection */}
    <Col span={24}>
      <Card title="Due Date" size="small">
        <DatePicker
          style={{ width: '100%' }}
          placeholder="Select due date"
          value={sharedDueDate}
          onChange={setSharedDueDate}
          disabledDate={(current) => current && current < moment().startOf('day')}
        />
        <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
          This due date will apply to all selected {approverType === 'review' ? 'reviewers' : 'approvers'}
        </Text>
      </Card>
    </Col>
    
    <Col span={24}>
      <Card title={`Add Template ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
        <Select
          style={{ width: '100%' }}
          placeholder="Select users by email"
          value={selectedTemplateApprover}
          onChange={handleAddTemplateApprover}
          optionLabelProp="label"
          showSearch
          filterOption={(input, option) => 
            option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }
        >
          {users
                  .filter(user => {
                    const currentArray = (approverType === 'review' ? templateApprovers?.reviewers : templateApprovers?.approvers) || [];
                    return !currentArray.some(approver => approver.userId === user.id) &&
                      user.template_approver === 'yes';
                  })
            .map(user => (
              <Option 
                key={user.id} 
                value={user.id}
                label={user.email}
              >
                <div>
                  <div>{user.email}</div>
                  <div style={{ fontSize: 'smaller', color: '#666' }}>{user.first_name} {user.last_name}</div>
                  {user.department && (
                    <div style={{ fontSize: 'smaller', color: '#666' }}>
                      Department: {user.department}
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
            <Card title={`Selected Template ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
              {(() => {
                const currentArray = (approverType === 'review' ? templateApprovers?.reviewers : templateApprovers?.approvers) || [];
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
                  title: 'Department',
                  dataIndex: 'department',
                  key: 'department',
                },
                {
                  title: 'Role',
                  dataIndex: 'role',
                  key: 'role',
                  render: (role) => (
                    <Tag color={role === 'template_reviewer' ? 'blue' : 'green'}>
                      {role === 'template_reviewer' ? 'Reviewer' : 'Approver'}
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
                      onClick={() => handleRemoveTemplateApprover(record.userId)}
                    >
                      Remove
                    </Button>
                  ),
                },
              ]}
            />
          ) : (
            <Empty description={`No template ${approverType === 'review' ? 'reviewers' : 'approvers'} selected`} />
          );
        })()}
      </Card>
    </Col>
  </Row>
</Modal>
    </div>
  );
};

export default ReviseTemplate;