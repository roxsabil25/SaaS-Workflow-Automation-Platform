import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { successAlert, errorAlert, confirmAlert, toastAlert } from '../../../../../utils/alerts';
import { 
  Card, 
  List, 
  Button, 
  Tag, 
  Avatar, 
  Typography, 
  Tabs, 
  Empty, 
  Radio, 
  Space, 
  Tooltip, 
  Divider,
  Badge,
  Skeleton,
  Breadcrumb,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Select,
  Table,
  Dropdown,
  Menu,
  Spin,
  Descriptions,
  Alert
} from 'antd';
import { 
  FileOutlined, 
  EyeOutlined, 
  EditOutlined, 
  FolderOutlined,
  FolderAddOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  LockOutlined,
  UserOutlined,
  AppstoreOutlined,
  BarsOutlined,
  PlusOutlined,
  GlobalOutlined,
  TeamOutlined,
  ArrowLeftOutlined,
  HomeOutlined,
  DeleteOutlined,
  DownOutlined,
  UpOutlined,
  MoreOutlined,
  CopyOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  FileAddOutlined,
  EllipsisOutlined,
  InboxOutlined,
  RollbackOutlined,
  FileSearchOutlined,
  PrinterOutlined,
  DownloadOutlined,
  CalendarOutlined,
  ArchiveBoxOutlined,
  BranchesOutlined,
  HistoryOutlined,
  StopOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons';



const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const Templates = ({ user, navigate, fetchUserData, templates, users, PUBLIC_TEMPLATES, handleUseTemplate, handleReviseTemplate, categories, departments }) => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'blocks' or 'list'
  const [publicTemplates] = useState(PUBLIC_TEMPLATES);
  const [orgTemplates, setOrgTemplates] = useState([]);
  const [orgCategories, setOrgCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState({ id: 0, path: "" });
  const [addCategoryVisible, setAddCategoryVisible] = useState(false);
  const [addCategoryForm] = Form.useForm();
  const [editCategoryVisible, setEditCategoryVisible] = useState(false);
  const [editCategoryForm] = Form.useForm();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState("2");
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [archivingTemplates, setArchivingTemplates] = useState(new Set());
  const [statusChangingTemplates, setStatusChangingTemplates] = useState(new Set());

  // Status display helper function
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'published':
        return { color: 'success', icon: <FileOutlined />, text: 'Published' };
      case 'pending_revision':
        return { color: 'warning', icon: <EditOutlined />, text: 'Revision' };
      case 'disabled':
        return { color: 'error', icon: <StopOutlined />, text: 'Disabled' };
      default:
        return { color: 'default', icon: <FileOutlined />, text: status || 'Unknown' };
    }
  };

  // Fetch organization templates from the database
  useEffect(() => {
    const fetchOrgTemplates = async () => {
      try {
        setLoading(true);
        if (templates && templates.length > 0) {
          // Include both published and disabled templates
          const orgTemps = templates.filter(t => 
            t.organization_id === user.orgId && 
            ['published', 'pending_revision', 'disabled'].includes(t.status)
          );
          setOrgTemplates(orgTemps);
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      } finally {
        setLoading(false);
      }
    };

    const processOrgCategories = () => {
      if (categories && categories.length > 0) {
        const templateCategories = categories.filter(c => c.organization_id === user.orgId);
        setOrgCategories(templateCategories);
      }
    };

    fetchOrgTemplates();
    processOrgCategories();
  }, [user, templates, categories]);

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
  const handleArchiveTemplate = async (templateId) => {
    setArchivingTemplates(prev => new Set([...prev, templateId]));
    
    try {
      await handleTemplateStatusUpdate(templateId, 'archived');
      message.success('Template successfully archived');
      fetchUserData();
    } catch (error) {
      console.error('Error archiving template:', error);
      message.error('Failed to archive template. Please try again.');
    } finally {
      setArchivingTemplates(prev => {
        const newSet = new Set(prev);
        newSet.delete(templateId);
        return newSet;
      });
    }
  };

  const handleToggleTemplateStatus = async (templateId, currentStatus) => {
    const newStatus = currentStatus === 'published' ? 'disabled' : 'published';
    const actionText = newStatus === 'disabled' ? 'disable' : 'enable';
    
    setStatusChangingTemplates(prev => new Set([...prev, templateId]));
    
    try {
      await handleTemplateStatusUpdate(templateId, newStatus);
      message.success(`Template successfully ${actionText}d`);
      fetchUserData();
    } catch (error) {
      console.error(`Error ${actionText}ing template:`, error);
      message.error(`Failed to ${actionText} template. Please try again.`);
    } finally {
      setStatusChangingTemplates(prev => {
        const newSet = new Set(prev);
        newSet.delete(templateId);
        return newSet;
      });
    }
  };

  // Template Data Formatting
  const formatTemplateData = (template) => {
    const isPublicTemplate = !template.organization_id;
    
    if (isPublicTemplate) {
      return {
        id: template.id,
        title: template.title,
        description: template.description || "No description available",
        content: template.content,
        lockedSections: template.lockedSections,
        isLocked: template.lockedSections && JSON.parse(template.lockedSections).length > 0,
        status: "published",
        isDisabled: false
      };
    }
    
    let formattedTitle = template.name;
    if (template.category_id) {
      const category = orgCategories.find(c => c.category_id === template.category_id);
      if (category && category.category_prefix) {
        formattedTitle = `${category.category_prefix} - ${template.name}`;
      }
    }
    
    return {
      id: template.id,
      title: formattedTitle,
      originalTitle: template.name,
      description: template.description || "No description available",
      content: template.content,
      lockedSections: template.locked_sections,
      requiredApprovers: template.required_approvers,
      categoryId: template.category_id,
      createdBy: template.created_by,
      status: template.status,
      version: template.version,
      createdAt: new Date(template.created_at).toLocaleDateString(),
      updatedAt: new Date(template.updated_at).toLocaleDateString(),
      isLocked: template.locked_sections && JSON.parse(template.locked_sections).length > 0,
      hasApprovers: template.required_approvers && JSON.parse(template.required_approvers).length > 0,
      isDisabled: template.status === 'disabled'
    };
  };

  const getTemplateIcon = (template) => {
    const templateName = template.title || template.name || "";
    if (templateName.toLowerCase().includes('contract')) {
      return <FileTextOutlined />;
    } else if (templateName.toLowerCase().includes('proposal')) {
      return <FilePdfOutlined />;
    } else {
      return <FileOutlined />;
    }
  };

  // Template Action Handlers
  const handlePreviewTemplate = (template) => {
    setSelectedTemplate(template);
    setPreviewModalVisible(true);
  };

  const handleUseTemplateWithCheck = (templateId, isDisabled) => {
    if (isDisabled) {
      message.warning('This template is currently disabled and cannot be used.');
      return;
    }
    handleUseTemplate(templateId);
  };

  // Template Actions Menu Generation
  const getTemplateBlockActions = (template) => {
    const isPublicTemplate = !template.organization_id;
    const isArchiving = archivingTemplates.has(template.id);
    const isChangingStatus = statusChangingTemplates.has(template.id);
    const formattedTemplate = formatTemplateData(template);
    
    const menuItems = [
      {
        key: 'preview',
        icon: <EyeOutlined />,
        label: 'Preview',
        onClick: () => handlePreviewTemplate(template)
      },
      {
        key: 'use',
        icon: <FileAddOutlined />,
        label: 'Use Template',
        disabled: formattedTemplate.isDisabled,
        onClick: () => handleUseTemplateWithCheck(template.id, formattedTemplate.isDisabled)
      }
    ];

    if (!isPublicTemplate && user?.role === 'admin') {
      // Add status toggle button
      const statusAction = {
        key: 'toggle-status',
        icon: formattedTemplate.status === 'published' ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
        label: isChangingStatus 
          ? (formattedTemplate.status === 'published' ? 'Disabling...' : 'Enabling...')
          : (formattedTemplate.status === 'published' ? 'Disable Template' : 'Enable Template'),
        disabled: isChangingStatus || template.status === 'pending_revision',
        onClick: () => {
          const actionText = formattedTemplate.status === 'published' ? 'disable' : 'enable';
          confirmAlert(
            `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Template`,
            `Are you sure you want to ${actionText} this template?`,
            'Yes, proceed',
            'Cancel'
          ).then((result) => {
            if (result.isConfirmed) {
              handleToggleTemplateStatus(template.id, formattedTemplate.status);
            }
          });
        }
      };

      menuItems.push(
        statusAction,
        {
          key: 'revise',
          icon: <HistoryOutlined />,
          label: 'Revise',
          disabled: isArchiving || formattedTemplate.isDisabled || template.status === 'pending_revision',
          onClick: () => {
            confirmAlert(
              'Revise Template',
              'Are you sure you want to revise this template? The old version will be moved to old templates after the revision is published.',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleReviseTemplate(template);
              }
            });
          }
        },
        {
          key: 'archive',
          icon: <InboxOutlined />,
          label: isArchiving ? 'Archiving...' : 'Archive',
          disabled: isArchiving,
          onClick: () => {
            confirmAlert(
              'Archive Template',
              'Are you sure you want to archive this template? It will be moved to archived status.',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleArchiveTemplate(template.id);
              }
            });
          }
        }
      );
    }

    return menuItems;
  };

  const getTemplateCategoryActions = (template) => {
    const isPublicTemplate = !template.organization_id;
    const isArchiving = archivingTemplates.has(template.id);
    const isChangingStatus = statusChangingTemplates.has(template.id);
    const formattedTemplate = formatTemplateData(template);
    
    const menuItems = [
      {
        key: 'preview',
        icon: <EyeOutlined />,
        label: 'Preview',
        onClick: () => handlePreviewTemplate(template)
      },
      {
        key: 'use',
        icon: <FileAddOutlined />,
        label: 'Use Template',
        disabled: formattedTemplate.isDisabled,
        onClick: () => handleUseTemplateWithCheck(template.id, formattedTemplate.isDisabled)
      }
    ];

    if (!isPublicTemplate && user?.role === 'admin') {
      const statusAction = {
        key: 'toggle-status',
        icon: formattedTemplate.status === 'published' ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
        label: isChangingStatus 
          ? (formattedTemplate.status === 'published' ? 'Disabling...' : 'Enabling...')
          : (formattedTemplate.status === 'published' ? 'Disable Template' : 'Enable Template'),
        disabled: isChangingStatus || template.status === 'pending_revision',
        onClick: () => {
          const actionText = formattedTemplate.status === 'published' ? 'disable' : 'enable';
          confirmAlert(
            `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Template`,
            `Are you sure you want to ${actionText} this template?`,
            'Yes, proceed',
            'Cancel'
          ).then((result) => {
            if (result.isConfirmed) {
              handleToggleTemplateStatus(template.id, formattedTemplate.status);
            }
          });
        }
      };

      menuItems.push(
        statusAction,
        {
          key: 'revise',
          icon: <HistoryOutlined />,
          label: 'Revise',
          disabled: isArchiving || formattedTemplate.isDisabled || template.status === 'pending_revision',
          onClick: () => {
            confirmAlert(
              'Revise Template',
              'Are you sure you want to revise this template? The old version will be moved to old templates after the revision is published.',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleReviseTemplate(template);
              }
            });
          }
        },
        {
          key: 'archive',
          icon: <InboxOutlined />,
          label: isArchiving ? 'Archiving...' : 'Archive',
          disabled: isArchiving,
          onClick: () => {
            confirmAlert(
              'Archive Template',
              'Are you sure you want to archive this template? It will be moved to archived status.',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleArchiveTemplate(template.id);
              }
            });
          }
        }
      );
    }

    return menuItems;
  };

  // Template Item Renderer
  const renderTemplateItem = (template) => {
    const formattedTemplate = formatTemplateData(template);
    const isPublicTemplate = !template.organization_id;
    const statusDisplay = getStatusDisplay(formattedTemplate.status);
    
    return (
      <List.Item key={template.id}>
        <Card 
          hoverable={!formattedTemplate.isDisabled} 
          className={`template-card ${formattedTemplate.isDisabled ? 'disabled-template' : ''}`}
          style={{ 
            height: '320px',
            width: '100%',
            display: 'flex', 
            flexDirection: 'column',
            borderLeft: formattedTemplate.isDisabled 
              ? '4px solid #ff4d4f' 
              : formattedTemplate.isLocked 
                ? '4px solid #faad14' 
                : '4px solid #52c41a',
            opacity: formattedTemplate.isDisabled ? 0.7 : 1
          }}
          bodyStyle={{ 
            padding: '16px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 12 }}>
            <Badge 
              count={`v${formattedTemplate.version || '1.0'}`} 
              style={{ 
                backgroundColor: isPublicTemplate ? '#1890ff' : '#52c41a',
                fontSize: '10px',
                height: '18px',
                lineHeight: '18px',
                minWidth: '28px'
              }}
            >
              <Avatar 
                icon={getTemplateIcon(template)} 
                size={48}
                style={{ 
                  backgroundColor: formattedTemplate.isDisabled ? '#f5f5f5' : '#f0f2f5', 
                  color: formattedTemplate.isDisabled ? '#bfbfbf' : '#1890ff'
                }} 
              />
            </Badge>
            <div style={{ flex: 1, marginLeft: 12 }}>
              <Tooltip title={formattedTemplate.title}>
                <Title 
                  level={5} 
                  ellipsis={{ rows: 2 }} 
                  style={{ 
                    marginBottom: 4,
                    fontSize: '14px',
                    lineHeight: '1.3',
                    color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit'
                  }}
                >
                  {formattedTemplate.title}
                </Title>
              </Tooltip>
            </div>
            <Dropdown
              menu={{ items: getTemplateBlockActions(template) }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button type="text" icon={<EllipsisOutlined />} />
            </Dropdown>
          </div>
          
          <div style={{ flex: 1, marginBottom: 12 }}>
            <Paragraph 
              ellipsis={{ rows: 2 }} 
              type="secondary"
              style={{ 
                fontSize: '12px', 
                marginBottom: 8,
                color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit'
              }}
            >
              {formattedTemplate.description}
            </Paragraph>
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <Space wrap size={[4, 4]}>
              {activeTab === "2" && formattedTemplate.categoryId && (
                <Tag color="blue" size="small">
                  <FolderOutlined /> {getCategoryNameById(template.category_id, orgCategories)}
                </Tag>
              )}
              {formattedTemplate.isLocked && (
                <Tag color="warning" size="small">
                  <LockOutlined /> Locked
                </Tag>
              )}
              {formattedTemplate.hasApprovers && (
                <Tag color="purple" size="small">
                  <UserOutlined /> Approvers
                </Tag>
              )}
              {!isPublicTemplate && (
                <Tag color={statusDisplay.color} size="small">
                  {statusDisplay.icon} {statusDisplay.text}
                </Tag>
              )}
            </Space>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '11px' }}>
                {!isPublicTemplate && (
                  <>
                    <Text 
                      type="secondary" 
                      style={{ 
                        display: 'block',
                        color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit'
                      }}
                    >
                      <CalendarOutlined /> Updated: {formattedTemplate.updatedAt}
                    </Text>
                    <Text 
                      type="secondary"
                      style={{ 
                        color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit'
                      }}
                    >
                      <BranchesOutlined /> Version: {formattedTemplate.version || '1.0'}
                    </Text>
                  </>
                )}
              </div>
              <Space size={4}>
                <Button 
                  type="primary" 
                  size="small" 
                  disabled={formattedTemplate.isDisabled}
                  onClick={() => handleUseTemplateWithCheck(formattedTemplate.id, formattedTemplate.isDisabled)}
                >
                  Use Template
                </Button>
              </Space>
            </div>
          </div>
        </Card>
      </List.Item>
    );
  };

  // Category Helper Functions
  const getCategoryNameById = (categoryId, categoryList) => {
    const category = categoryList.find(c => c.category_id === categoryId);
    return category ? category.category_name : `Category ${categoryId}`;
  };

  const getParentCategoryPath = (categoryId) => {
    const category = orgCategories.find(c => c.category_id === categoryId);
    return category ? category.folder_path : "";
  };

  const getCategoryBreadcrumb = (categoryId) => {
    if (!categoryId) return [];
    
    const breadcrumbs = [];
    let currentCategory = orgCategories.find(c => c.category_id === categoryId);
    
    while (currentCategory) {
      breadcrumbs.unshift({
        id: currentCategory.category_id,
        name: currentCategory.category_name
      });
      
      if (currentCategory.parent_category_id) {
        currentCategory = orgCategories.find(c => c.category_id === currentCategory.parent_category_id);
      } else {
        currentCategory = null;
      }
    }
    
    return breadcrumbs;
  };

  const getSubcategories = (parentCategoryId) => {
    if (parentCategoryId === 0) {
      return orgCategories.filter(category => !category.parent_category_id);
    }
    return orgCategories.filter(category => category.parent_category_id === parentCategoryId);
  };

  // Category Management Functions
  const handleCategoryClick = (category) => {
    setCurrentCategory({
      id: category.category_id,
      path: category.folder_path
    });
  };

  const handleAddCategory = () => {
    setAddCategoryVisible(true);
  };

  const submitAddCategory = async () => {
    try {
      const values = await addCategoryForm.validateFields();
      
      await axios.post(`/api/add_category/${user.orgId}`, { 
        category_name: values.categoryName,
        category_prefix: values.categoryPrefix,
        parent_category_id: currentCategory.id === 0 ? null : currentCategory.id,
      });

      await fetchUserData();
      message.success('Category created successfully');
      addCategoryForm.resetFields();
      setAddCategoryVisible(false);
    } catch (error) {
      console.error("Failed to create category:", error);
      message.error('Failed to create category');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await axios.delete(`/api/delete_category`, { 
        data: {
          categoryId: categoryId,
          organization_id: user.orgId,
        }
      });

      await fetchUserData();
      message.success('Category deleted successfully');
      
      if (currentCategory.id === categoryId) {
        navigateToParentCategory();
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
      message.error('Failed to delete category');
    }
  };

  const handleEditCategory = (category) => {
    setSelectedCategory(category);
    editCategoryForm.setFieldsValue({
      categoryName: category.category_name,
      categoryPrefix: category.category_prefix
    });
    setEditCategoryVisible(true);
  };

  const navigateToParentCategory = () => {
    if (currentCategory.id === 0) return;
    
    const currentCategoryObj = orgCategories.find(c => c.category_id === currentCategory.id);
    if (currentCategoryObj && currentCategoryObj.parent_category_id) {
      const parentCategory = orgCategories.find(c => c.category_id === currentCategoryObj.parent_category_id);
      setCurrentCategory({
        id: parentCategory.category_id,
        path: parentCategory.folder_path
      });
    } else {
      setCurrentCategory({ id: 0, path: "" });
    }
  };

  const navigateToRoot = () => {
    setCurrentCategory({ id: 0, path: "" });
  };

  // View Renderers
  const renderListView = () => {
    if (activeTab === "1") {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Empty
            description={
              <Text strong>List view is not available for public templates</Text>
            }
          />
          <Button 
            type="primary" 
            onClick={() => setViewMode('blocks')}
            style={{ marginTop: 16 }}
          >
            Switch to Blocks View
          </Button>
        </div>
      );
    }
    
    const publishedTemplates = orgTemplates.filter(t => t.status === 'published');
    const disabledTemplates = orgTemplates.filter(t => t.status === 'disabled');
    const pendingRevisionTemplates = orgTemplates.filter(t => t.status === 'pending_revision');
    const allAvailableTemplates = [...publishedTemplates, ...disabledTemplates, ...pendingRevisionTemplates]
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    if (allAvailableTemplates.length === 0) {
      return <Empty description="No templates available" />;
    }

    return (
      <div className="file-manager-view">
        <List
          bordered
          dataSource={allAvailableTemplates}
          renderItem={template => {
            const formattedTemplate = formatTemplateData(template);
            const isPublicTemplate = !template.organization_id;
            const statusDisplay = getStatusDisplay(formattedTemplate.status);
            
            return (
              <List.Item
                actions={[
                  <Button 
                    type="primary" 
                    size="small" 
                    disabled={formattedTemplate.isDisabled}
                    onClick={() => handleUseTemplateWithCheck(formattedTemplate.id, formattedTemplate.isDisabled)}
                  >
                    Use Template
                  </Button>,
                  <Dropdown
                    menu={{ items: getTemplateCategoryActions(template) }}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button type="text" icon={<EllipsisOutlined />} />
                  </Dropdown>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Badge 
                      count={`v${formattedTemplate.version || '1.0'}`} 
                      style={{ 
                        backgroundColor: isPublicTemplate ? '#1890ff' : '#52c41a',
                        fontSize: '10px',
                        height: '18px',
                        lineHeight: '18px',
                        minWidth: '28px'
                      }}
                    >
                      <Avatar 
                        icon={getTemplateIcon(template)} 
                        size={48}
                        style={{ 
                          backgroundColor: formattedTemplate.isDisabled ? '#f5f5f5' : '#f0f2f5', 
                          color: formattedTemplate.isDisabled ? '#bfbfbf' : '#1890ff',
                          opacity: formattedTemplate.isDisabled ? 0.7 : 1
                        }} 
                      />
                    </Badge>
                  }
                  title={
                    <div>
                      <span style={{ 
                        color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit',
                        textDecoration: formattedTemplate.isDisabled ? 'line-through' : 'none'
                      }}>
                        {formattedTemplate.title}
                      </span>
                      <Space style={{ marginLeft: 12 }}>
                        {formattedTemplate.isLocked && (
                          <Tag color="warning">
                            <LockOutlined /> Locked
                          </Tag>
                        )}
                        {formattedTemplate.hasApprovers && (
                          <Tag color="purple">
                            <UserOutlined /> Approvers
                          </Tag>
                        )}
                        {!isPublicTemplate && (
                          <Tag color={statusDisplay.color}>
                            {statusDisplay.icon} {statusDisplay.text}
                          </Tag>
                        )}
                      </Space>
                    </div>
                  }
                  description={
                    <span style={{ 
                      color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit' 
                    }}>
                      {formattedTemplate.description}
                    </span>
                  }
                />
              </List.Item>
            );
          }}
        />
      </div>
    );
  };

  const renderBlockView = () => {
    if (activeTab === "1") {
      // Public templates - simple list
      return (
        <List
          grid={{ 
            gutter: [16, 16], 
            xs: 1, 
            sm: 2, 
            md: 3, 
            lg: 3,
            xl: 4,
            xxl: 5
          }}
          dataSource={publicTemplates}
          renderItem={renderTemplateItem}
          locale={{ emptyText: <Empty description="No templates found" /> }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} templates`
          }}
        />
      );
    } else {
      // Organization templates - show both published and disabled templates
      const publishedTemplates = orgTemplates.filter(t => t.status === 'published');
      const disabledTemplates = orgTemplates.filter(t => t.status === 'disabled');
      const pendingRevisionTemplates = orgTemplates.filter(t => t.status === 'pending_revision');
      const allAvailableTemplates = [...publishedTemplates, ...disabledTemplates, ...pendingRevisionTemplates]
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

      return (
        <div>
          {/* All Templates Section */}
          {allAvailableTemplates.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={4}>Organization Templates</Title>
                <div>
                <Tag color="success">Published: {publishedTemplates.length}</Tag>
                <Tag color="warning">Revision: {pendingRevisionTemplates.length}</Tag>
                <Tag color="error">Disabled: {disabledTemplates.length}</Tag>
                </div>
              </div>
              <List
                grid={{ 
                  gutter: [16, 16], 
                  xs: 1, 
                  sm: 2, 
                  md: 3, 
                  lg: 3,
                  xl: 4,
                  xxl: 5
                }}
                dataSource={allAvailableTemplates}
                renderItem={renderTemplateItem}
                pagination={{
                  pageSize: 15,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => 
                    `${range[0]}-${range[1]} of ${total} templates`
                }}
              />
            </div>
          )}
          
          {/* Empty state */}
          {allAvailableTemplates.length === 0 && (
            <Empty description="No templates available" />
          )}
        </div>
      );
    }
  };

  const submitEditCategory = async () => {
    try {
      const values = await editCategoryForm.validateFields();
      
      await axios.put(`/api/update_category/${selectedCategory.category_id}`, {
        category_name: values.categoryName,
        category_prefix: values.categoryPrefix,
        organization_id: user.orgId
      });

      await fetchUserData();
      message.success('Category updated successfully');
      editCategoryForm.resetFields();
      setEditCategoryVisible(false);
      setSelectedCategory(null);
    } catch (error) {
      console.error("Failed to update category:", error);
      message.error('Failed to update category');
    }
  };

  return (
    <div className="templates-dashboard">
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>Document Templates</Title>
          <Space>
            <Radio.Group 
              value={viewMode} 
              onChange={e => setViewMode(e.target.value)}
              buttonStyle="solid"
              optionType="button"
            >
              <Radio.Button value="blocks">
                <AppstoreOutlined /> Blocks
              </Radio.Button>
              <Radio.Button value="list" disabled={activeTab === "1"}>
                <BarsOutlined /> List
              </Radio.Button>
            </Radio.Group>
          </Space>
        </div>

        <Tabs 
          defaultActiveKey="2" 
          onChange={(key) => {
            setActiveTab(key);
            setCurrentCategory({ id: 0, path: "" }); // Reset folder view when changing tabs
            if (key === "1") setViewMode('blocks'); // Force blocks view for public templates
          }}
        >
          {/* <TabPane 
            tab={
              <span>
                <GlobalOutlined /> Public Templates
              </span>
            } 
            key="1"
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              renderBlockView()
            )}
          </TabPane> */}
          <TabPane 
            tab={
              <span>
                <TeamOutlined /> Organization Templates
              </span>
            } 
            key="2"
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              viewMode === 'blocks' ? renderBlockView() : renderListView()
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* Add Category Modal */}
      <Modal
        title="Add New Category"
        open={addCategoryVisible}
        onCancel={() => setAddCategoryVisible(false)}
        onOk={submitAddCategory}
      >
        <Form
          form={addCategoryForm}
          layout="vertical"
        >
          <Form.Item
            name="categoryName"
            label="Category Name"
            rules={[{ required: true, message: 'Please enter a category name' }]}
          >
            <Input placeholder="Enter category name" />
          </Form.Item>
          
          <Form.Item
            name="categoryPrefix"
            label="Category Prefix"
            rules={[{ required: true, message: 'Please enter a category prefix' }]}
          >
            <Input placeholder="Enter new category prefix" />
          </Form.Item>

          {/* Show current parent folder information */}
          <Form.Item label="Parent Folder">
            <Input 
              value={currentCategory.id === 0 ? "Root Level" : getCategoryNameById(currentCategory.id, orgCategories)} 
              disabled 
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        title="Edit Category"
        open={editCategoryVisible}
        onCancel={() => setEditCategoryVisible(false)}
        onOk={submitEditCategory}
      >
        <Form
          form={editCategoryForm}
          layout="vertical"
        >
          <Form.Item
            name="categoryName"
            label="Category Name"
            rules={[{ required: true, message: 'Please enter a category name' }]}
          >
            <Input placeholder="Enter new category name" />
          </Form.Item>

          <Form.Item
            name="categoryPrefix"
            label="Category Prefix"
            rules={[{ required: true, message: 'Please enter a category prefix' }]}
          >
            <Input placeholder="Enter new category prefix" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Template Preview Modal */}
      <TemplatePreviewModal
        visible={previewModalVisible}
        template={selectedTemplate}
        onClose={() => setPreviewModalVisible(false)}
        categories={orgCategories}
        users={users}
        departments={departments}
      />

    </div>
  );
};

const TemplatePreviewModal = ({ 
  visible, 
  template, 
  onClose, 
  categories, 
  users,
  departments
}) => {
  const [loading, setLoading] = useState(false);
  const [renderedContent, setRenderedContent] = useState(null);


  // Parse the template data to extract necessary information
  const parsedTemplate = React.useMemo(() => {
    if (!template) return null;
    
    // Parse required_approvers JSON string to get approvers array
    let approvers = [];
    try {
      approvers = template.required_approvers ? JSON.parse(template.required_approvers) : [];
    } catch (e) {
      console.error("Error parsing approvers:", e);
    }
    
    // Parse template_structure to get locked elements
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
    } catch (e) {
      console.error("Error parsing template structure:", e);
    }
    
    return {
      ...template,
      approvers,
      lockedElements,
      includeTableOfContents,
      allowAttachments
    };
  }, [template]);

  // Function to get template icon based on name
  const getTemplateIcon = (template) => {
    const templateName = template?.name || template?.title || "";
    if (templateName.toLowerCase().includes('contract')) {
      return <FileTextOutlined />;
    } else if (templateName.toLowerCase().includes('proposal')) {
      return <FileSearchOutlined />;
    } else {
      return <FileTextOutlined />;
    }
  };

  // Function to get category details
  const getCategoryDetails = (categoryId) => {
    return categories.find(c => c.category_id === categoryId) || {};
  };

  // Function to parse and display locked elements
  const renderLockedElements = () => {
    if (
      !parsedTemplate?.lockedElements || 
      Object.values(parsedTemplate.lockedElements).filter(isLocked => isLocked).length === 0
    ) {
      return <Text type="secondary">No elements locked</Text>;
    }

    return (
      <ul className="locked-elements-list">
        {Object.entries(parsedTemplate.lockedElements).map(([element, isLocked]) => (
          isLocked && <li key={element}>{element}</li>
        ))}
      </ul>
    );
  };

  // Render content as static HTML for pure read-only preview mode.
  const renderTemplateContent = () => {
    if (!parsedTemplate?.content) return null;

    try {
      let contentObj;
      if (typeof parsedTemplate.content === 'string') {
        contentObj = JSON.parse(parsedTemplate.content);
      } else {
        contentObj = parsedTemplate.content;
      }

      const actualContent = contentObj.content || contentObj;

      return (
        <div className="document-viewer">
          <div className="document-page" style={{
            backgroundColor: 'white',
            padding: '30px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            margin: '0 auto',
            maxWidth: '800px',
            minHeight: '1000px',
            position: 'relative'
          }}>
            <div
              className="document-content"
              dangerouslySetInnerHTML={{ __html: actualContent }}
              style={{
                fontFamily: '"Work Sans", "Open Sans", Arial, sans-serif',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#333'
              }}
            />
          </div>
        </div>
      );
    } catch (e) {
      console.error("Error rendering content:", e);
      return (
        <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <Alert
            message="Content Rendering Error"
            description="Could not properly render the template content. Displaying raw content instead."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
            {parsedTemplate.content}
          </pre>
        </div>
      );
    }
  };
  

  // Function to render approvers table with due date
  const renderApproversTable = () => {
    if (!parsedTemplate?.approvers || parsedTemplate.approvers.length === 0) {
      return <Text type="secondary">No approvers configured</Text>;
    }

    const columns = [
      {
        title: 'Stage',
        dataIndex: 'stage',
        key: 'stage',
        render: (stage) => <Tag>{stage || 'Approval'}</Tag>
      },
      {
        title: 'Department',
        dataIndex: 'department',
        key: 'department',
        render: (deptId) => {
          const dept = departments.find(d => d.id === deptId);
          return dept ? dept.name : `${deptId}`;
        }
      },
      {
        title: 'Mandatory',
        dataIndex: 'mandatory',
        key: 'mandatory',
        render: (mandatory) => (
          <Tag color={mandatory ? 'green' : 'orange'}>
            {mandatory ? 'Yes' : 'No'}
          </Tag>
        )
      }
    ];

    return (
      <Table
        columns={columns}
        dataSource={parsedTemplate.approvers}
        pagination={false}
        size="small"
        rowKey={(record, index) => `approver-${index}`}
      />
    );
  };

  useEffect(() => {
    if (visible && template) {
      setLoading(true);
      setTimeout(() => {
        setRenderedContent(renderTemplateContent());
        setLoading(false);
      }, 800);
    }
  }, [visible, template]);


  if (!parsedTemplate) return null;

  return (
    <Modal
      visible={visible}
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar 
            icon={getTemplateIcon(parsedTemplate)} 
            size={40}
            style={{ 
              backgroundColor: '#f0f2f5', 
              color: '#1890ff', 
              marginRight: 16
            }} 
          />
          <span>Template Preview: {parsedTemplate.name || parsedTemplate.title}</span>
        </div>
      }
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
      styles={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading template preview...</div>
        </div>
      ) : (
        <div className="template-preview-content">
          <Tabs defaultActiveKey="content">
            <TabPane tab="Overview" key="overview">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Template Name">{parsedTemplate.name || parsedTemplate.title}</Descriptions.Item>
                <Descriptions.Item label="Description">{parsedTemplate.description}</Descriptions.Item>
                <Descriptions.Item label="Category">
                  {getCategoryDetails(parsedTemplate.category_id || parsedTemplate.categoryId)?.category_name || 'No Category'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={parsedTemplate.status === 'published' ? 'green' : 'default'}>
                    {parsedTemplate.status || 'Published'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {parsedTemplate.created_at ? new Date(parsedTemplate.created_at).toLocaleDateString() : new Date().toLocaleDateString()}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {parsedTemplate.updated_at ? new Date(parsedTemplate.updated_at).toLocaleDateString() : new Date().toLocaleDateString()}
                </Descriptions.Item>
              </Descriptions>
            </TabPane>
            
            <TabPane tab="Content" key="content">
              <Card bordered={false}>
                <Alert
                  message="Preview Mode"
                  description="This is a preview of how the template will appear to users. Content may be adjusted based on user permissions."
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                
                <div className="template-content-preview">
                  {renderedContent || (
                    <div style={{ textAlign: 'center', color: '#999', padding: 80 }}>
                      <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                      <p>Content preview not available</p>
                    </div>
                  )}
                </div>

              </Card>
            </TabPane>
            
            <TabPane tab="Structure" key="structure">
              <Card title="Locked Elements" size="small" style={{ marginBottom: 16 }}>
                {renderLockedElements()}
              </Card>
              
              <Card title="Document Structure" size="small" style={{ marginBottom: 16 }}>
                <ul>
                  {parsedTemplate.includeTableOfContents && <li>Includes Table of Contents</li>}
                  {parsedTemplate.allowAttachments && <li>Allows File Attachments</li>}
                  {!parsedTemplate.includeTableOfContents && !parsedTemplate.allowAttachments && 
                    <Text type="secondary">No special structure settings</Text>}
                </ul>
              </Card>
            </TabPane>
            
            <TabPane tab="Approvers" key="approvers">
              <Card bordered={false}>
                {renderApproversTable()}
              </Card>
            </TabPane>
            
            <TabPane tab="Notes" key="notes">
              <Card bordered={false}>
                {parsedTemplate.notes ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{parsedTemplate.notes}</div>
                ) : (
                  <Text type="secondary">No additional notes provided</Text>
                )}
              </Card>
            </TabPane>
          </Tabs>
        </div>
      )}
    </Modal>
  );
};

export default Templates;