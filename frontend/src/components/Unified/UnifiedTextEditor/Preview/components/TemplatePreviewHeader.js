import React from 'react';
import { Button, Typography, Avatar, Tooltip, Badge, Tag, Space } from 'antd';
import { 
  ArrowLeftOutlined, FileTextOutlined, FileSearchOutlined, CheckOutlined, CloseCircleOutlined, DownOutlined 
} from '@ant-design/icons';
import { Dropdown } from 'antd';

const TemplatePreviewHeader = ({ 
  parsedTemplate, 
  currentUser, 
  onCancel, 
  manualSaveContent, 
  isSaving,
  handleReview,
  handleApprove,
  setShowRejectionModal,
  isReviewing,
  isApproving,
  isRejecting,
  handleSubmit
}) => {
  const safeTemplate = parsedTemplate || {};
  const isAuthor = currentUser && parsedTemplate ? String(currentUser.id) === String(parsedTemplate.created_by) : false;

  const authorMenuItems = [
    {
      key: 'pending_review',
      label: 'Submit for Review',
      icon: <FileSearchOutlined />,
      onClick: () => handleSubmit('pending_review')
    },
    {
      key: 'pending_approval',
      label: 'Submit for Approval',
      icon: <CheckOutlined />,
      onClick: () => handleSubmit('pending_approval')
    },
    {
      key: 'draft',
      label: 'Save as Draft',
      icon: <FileTextOutlined />,
      onClick: () => handleSubmit('draft')
    }
  ];

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

  const getCurrentUsersToShow = () => {
    if (!parsedTemplate?.template_approvers) return [];
    
    const status = parsedTemplate.status;
    
    if (status === 'pending_review' || status === 'reviewed') {
      return parsedTemplate.template_approvers.reviewers || [];
    } else if (status === 'pending_approval' || status === 'approved' || status === 'rejected') {
      return parsedTemplate.template_approvers.approvers || [];
    }
    
    return [];
  };

  const getCurrentUserRole = () => {
    if (!parsedTemplate?.template_approvers || !currentUser?.email) return null;
    
    const status = parsedTemplate.status;
    
    if (status === 'pending_review' || status === 'reviewed') {
      const reviewer = parsedTemplate.template_approvers.reviewers.find(r => 
        String(r.email || '').trim().toLowerCase() === String(currentUser.email || '').trim().toLowerCase()
      );
      return reviewer ? { role: 'reviewer', user: reviewer } : null;
    } else if (status === 'pending_approval' || status === 'approved' || status === 'rejected') {
      const approver = parsedTemplate.template_approvers.approvers.find(a => 
        String(a.email || '').trim().toLowerCase() === String(currentUser.email || '').trim().toLowerCase()
      );
      return approver ? { role: 'approver', user: approver } : null;
    }
    
    return null;
  };

  return (
    <div className="template-page-header">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={onCancel}
          style={{ marginRight: 16 }}
        />
        <Avatar 
          icon={getTemplateIcon(parsedTemplate)} 
          size={40}
          style={{ 
            backgroundColor: '#f0f2f5', 
            color: '#1890ff', 
            marginRight: 16
          }} 
        />
        <Typography.Title level={4} style={{ margin: 0 }}>
          {safeTemplate.name || safeTemplate.title || 'Loading...'}
        </Typography.Title>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          {isAuthor && (
            <Dropdown menu={{ items: authorMenuItems }} placement="bottomRight">
              <Button type="primary" size="small">
                Update Template <DownOutlined style={{ fontSize: '10px' }} />
              </Button>
            </Dropdown>
          )}
          {(safeTemplate.status === 'pending_review' || safeTemplate.status === 'reviewed') && (
            <>
              <Tooltip title="Manual save (Ctrl+S)">
                <Button 
                  icon={<CheckOutlined />}
                  onClick={() => manualSaveContent()}
                  size="small"
                  type="default"
                  loading={isSaving}
                >
                  Save
                </Button>
              </Tooltip>
              <div style={{ fontSize: '12px', color: '#666', padding: '2px 6px', backgroundColor: '#f0f2f5', borderRadius: '3px', border: '1px solid #d9d9d9' }}>
                🔄 Auto-save: 1.5s
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Typography.Text strong style={{ marginRight: 8 }}>
            {safeTemplate.status === 'pending_review' || safeTemplate.status === 'reviewed' ? 'Reviewers:' : 'Approvers:'}
          </Typography.Text>
          {getCurrentUsersToShow().map((user, index) => {
            const isCurrentUser = currentUser?.email && user.email && 
              String(user.email).trim().toLowerCase() === String(currentUser.email).trim().toLowerCase();
            const getStatusColor = (status) => {
              switch (status?.toLowerCase()) {
                case 'reviewed':
                case 'approved':
                  return 'success';
                case 'rejected':
                  return 'error';
                case 'pending':
                default:
                  return 'processing';
              }
            };
            
            return (
              <div key={`user-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge 
                  status={getStatusColor(user.status)}
                  text={
                    <span style={{ 
                      fontWeight: isCurrentUser ? 'bold' : 'normal',
                      color: isCurrentUser ? '#1890ff' : undefined
                    }}>
                      {user.name}
                      {user.status?.toLowerCase() === 'rejected' && user.comment && ' *'}
                    </span>
                  }
                />
                
                {isCurrentUser && (() => {
                  const userStatus = user.status?.toLowerCase();
                  const currentUserRole = getCurrentUserRole();
                  
                  if (!currentUserRole) return null;
                  
                  const { role } = currentUserRole;
                  
                  if (userStatus === 'pending') {
                    if (role === 'reviewer') {
                      return (
                        <Button
                          type="primary"
                          icon={<CheckOutlined />}
                          loading={isReviewing}
                          onClick={handleReview}
                          size="small"
                          style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                        >
                          Mark as Reviewed
                        </Button>
                      );
                    } else if (role === 'approver') {
                      return (
                        <Space>
                          <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            loading={isApproving}
                            onClick={handleApprove}
                            size="small"
                            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                          >
                            Approve
                          </Button>
                          <Button
                            danger
                            icon={<CloseCircleOutlined />}
                            loading={isRejecting}
                            onClick={() => setShowRejectionModal(true)}
                            size="small"
                          >
                            Reject
                          </Button>
                        </Space>
                      );
                    }
                  }
                  
                  return (
                    <Tag 
                      color={userStatus === 'approved' ? 'success' : 
                             userStatus === 'reviewed' ? 'success' : 
                             userStatus === 'rejected' ? 'error' : 'default'}
                      icon={userStatus === 'approved' || userStatus === 'reviewed' ? <CheckOutlined /> : 
                            userStatus === 'rejected' ? <CloseCircleOutlined /> : null}
                    >
                      {userStatus === 'approved' ? 'Approved' :
                       userStatus === 'reviewed' ? 'Reviewed' :
                       userStatus === 'rejected' ? 'Rejected' : 'Pending'}
                    </Tag>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TemplatePreviewHeader;
