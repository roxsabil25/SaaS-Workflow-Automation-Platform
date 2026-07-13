import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { Tabs, Spin, Card, Row, Col, Button, Dropdown, Badge, Tooltip, Tag, message } from 'antd';
import PropTypes from 'prop-types';

import '../../../Home/components/Dashboard/Templates/CommentsSuggestionsFixes.css';
import './TemplatePreview.css';

import { useDocumentWorkflowPreviewState } from './hooks/useDocumentWorkflowPreviewState';
import { useDocumentWorkflowActions } from './hooks/useDocumentWorkflowActions';
import { useDocumentWorkflowContent } from './hooks/useDocumentWorkflowContent';

import TemplatePreviewHeader from './components/TemplatePreviewHeader';
import TemplateOverviewTab from './components/TemplateOverviewTab';
import OverviewProgressTab from './components/OverviewProgressTab';
import TemplateContentTab from './components/TemplateContentTab';
import TemplateStructureTab from './components/TemplateStructureTab';
import TemplateApproversTab from './components/TemplateApproversTab';
import TemplateActivityTab from './components/TemplateActivityTab';
import TemplateNotesTab from './components/TemplateNotesTab';
import RejectionModal from './components/RejectionModal';
import TemplateApproversModal from '../../../Home/components/Dashboard/Templates/CreateTemplate/components/TemplateApproversModal';
import { 
  FileTextOutlined, FileSearchOutlined, SaveOutlined, 
  InfoCircleOutlined, DownOutlined,
  TeamOutlined, EditOutlined,
  MessageOutlined, HistoryOutlined, PaperClipOutlined,
  BookOutlined
} from '@ant-design/icons';
import { successAlert, errorAlert, toastAlert } from '../../../../utils/alerts';
import AttachmentsTab from './components/AttachmentsTab';
import ReferencesTab from './components/ReferencesTab';
import TemplateImpactTab from './components/TemplateImpactTab';

const { TabPane } = Tabs;

/**
 * Same UI as TemplatePreview; loads/saves document workflow via /api/get_document and /api/update_document_content.
 */
const DocumentPreview = ({
  document: documentRow,
  categories,
  users,
  departments,
  currentUser,
  onCancel,
  readOnly = false
}) => {
  const pagesContainerRef = useRef(null);

  const {
    parsedTemplate,
    setParsedTemplate,
    initialData,
    loading
  } = useDocumentWorkflowPreviewState(documentRow);

  const {
    isReviewing,
    isApproving,
    isRejecting,
    rejectionComment,
    setRejectionComment,
    showRejectionModal,
    setShowRejectionModal,
    handleReview,
    handleApprove,
    handleReject
  } = useDocumentWorkflowActions(parsedTemplate, setParsedTemplate, currentUser);

  const {
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
    socketUpdateKey,
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
  } = useDocumentWorkflowContent(parsedTemplate, initialData, currentUser, pagesContainerRef, setParsedTemplate);

  const isAuthor = currentUser && parsedTemplate ? String(currentUser.id) === String(parsedTemplate.created_by) : false;
  const canEditAttachments = !readOnly && (isAuthor || (currentUser && currentUser.role === 'admin')) && ['draft', 'pending_revision'].includes(parsedTemplate?.status);
  const canEditReferences = canEditAttachments; // Same logic as attachments

  const [documentApproversModalVisible, setDocumentApproversModalVisible] = useState(false);
  const [approverType, setApproverType] = useState('review');
  const [sharedDueDate, setSharedDueDate] = useState(null);
  const [documentWorkflowApprovers, setDocumentWorkflowApprovers] = useState({
    reviewers: [],
    approvers: []
  });

  // Sync workflow approvers from parsedTemplate if they exist
  useEffect(() => {
    if (parsedTemplate?.template_approvers) {
      setDocumentWorkflowApprovers(parsedTemplate.template_approvers);
    }
  }, [parsedTemplate]);

  const handleAddDocumentApprover = (userId) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    const newApprover = {
      userId,
      name: `${u.first_name} ${u.last_name}`,
      email: u.email,
      department: u.department || '',
      role: approverType === 'review' ? 'document_reviewer' : 'document_approver',
      status: 'pending',
      dueDate: sharedDueDate
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

  const persistDocumentWorkflow = async (status) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    if (!documentId) return;

    let workflowForSubmit = { ...documentWorkflowApprovers };
    // Reset ALL reviewers and approvers to 'pending' on resubmission
    // so previously rejected/approved users get a clean slate
    workflowForSubmit.reviewers = (workflowForSubmit.reviewers || []).map((a) => {
      const { rejectedAt, reviewedAt, approvedAt, comment: _comment, ...rest } = a;
      return {
        ...rest,
        status: 'pending',
        dueDate: sharedDueDate || a.dueDate
      };
    });
    workflowForSubmit.approvers = (workflowForSubmit.approvers || []).map((a) => {
      const { rejectedAt, reviewedAt, approvedAt, comment: _comment, ...rest } = a;
      return {
        ...rest,
        status: 'pending',
        dueDate: sharedDueDate || a.dueDate
      };
    });

    try {
      const body = {
        status: status,
        approvers: workflowForSubmit
      };
      
      const res = await axios.put(`/api/update_document/${documentId}`, body);
      if (res.data.success) {
        setParsedTemplate(prev => ({
          ...prev,
          status: status,
          template_approvers: workflowForSubmit
        }));
        return true;
      }
    } catch (error) {
      console.error('Error updating document workflow:', error);
      errorAlert('Update Failed', error.response?.data?.message || 'Failed to update document workflow status.');
    }
    return false;
  };

  const handleSubmitWorkflow = async (status) => {
    if (status === 'draft') {
      const ok = await persistDocumentWorkflow('draft');
      if (ok) {
        await toastAlert('Document saved as draft');
        return true;
      }
      return false;
    }

    const ok = await persistDocumentWorkflow(status);
    if (ok) {
      const actionText = status === 'pending_review' ? 'Review' : 'Approval';
      await successAlert('Document Submitted', `Document submitted for ${actionText} successfully`);
      if (onCancel) onCancel();
      return true;
    }
    return false;
  };

  const generateWorkflowItems = () => {
    const items = [];

    items.push({
      key: 'review',
      label: 'Submit for Review',
      icon: <FileSearchOutlined />,
      onClick: () => {
        setApproverType('review');
        setDocumentApproversModalVisible(true);
      }
    });

    items.push({
      key: 'approval',
      label: 'Submit for Approval',
      icon: <SaveOutlined />,
      onClick: () => {
        setApproverType('approval');
        setDocumentApproversModalVisible(true);
      }
    });

    items.push({
      key: 'draft',
      label: 'Save as Draft',
      icon: <FileTextOutlined />,
      onClick: () => handleSubmitWorkflow('draft')
    });

    return items;
  };

  const renderTabNavButtons = () => {
    if (readOnly) return null;

    const items = generateWorkflowItems();
    
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Dropdown menu={{ items }} placement="bottomRight">
          <Button size="small" type="primary">
            Update Document <DownOutlined />
          </Button>
        </Dropdown>
      </div>
    );
  };

  const getCategoryDetails = (categoryId) => {
    return categories.find((c) => c.category_id === categoryId) || {};
  };

  const getCurrentUsersToShow = () => {
    if (!parsedTemplate?.template_approvers) return [];

    const status = parsedTemplate.status;
    const { reviewers = [], approvers = [] } = parsedTemplate.template_approvers;

    if (status === 'pending_review' || status === 'reviewed') {
      return reviewers;
    } else if (status === 'pending_approval' || status === 'approved' || status === 'rejected') {
      return approvers;
    } else if (status === 'draft' || status === 'pending_revision') {
      // For drafts: show all configured users (from template) so author can see the workflow
      return [...reviewers, ...approvers];
    }

    return [];
  };


  if (!documentRow) {
    return null;
  }

  return (
    <>
      <div className="template-page" style={{ backgroundColor: '#fff', minHeight: '100vh' }}>
        <TemplatePreviewHeader
          parsedTemplate={parsedTemplate}
          currentUser={currentUser}
          onCancel={onCancel}
          manualSaveContent={manualSaveContent}
          isSaving={isSaving}
          handleReview={async () => {
            await handleReview();
          }}
          handleApprove={async () => {
            const ok = await handleApprove();
            if (ok) onCancel();
          }}
          setShowRejectionModal={setShowRejectionModal}
          isReviewing={isReviewing}
          isApproving={isApproving}
          isRejecting={isRejecting}
          handleSubmit={async (status) => {
            if (status === 'draft') {
              const ok = await handleSubmitWorkflow('draft');
              if (ok) onCancel();
            } else {
              setApproverType(status === 'pending_review' ? 'review' : 'approval');
              setDocumentApproversModalVisible(true);
            }
          }}
        />

        <div className="template-page-content">
          {loading || !parsedTemplate ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Loading document...</div>
            </div>
          ) : (
            <div className="template-content">
              <Tabs 
                defaultActiveKey="content" 
                type="card"
                tabBarExtraContent={renderTabNavButtons()}
              >
                <TabPane 
                  tab={<span><FileTextOutlined /> Overview</span>} 
                  key="overview"
                >
                  <TemplateOverviewTab
                    parsedTemplate={parsedTemplate}
                    getCategoryDetails={getCategoryDetails}
                    entityLabel="Document"
                  />
                </TabPane>

                <TabPane 
                  tab={<span><HistoryOutlined /> Overview Progress</span>} 
                  key="overviewProgress"
                >
                  <OverviewProgressTab
                    parsedTemplate={parsedTemplate}
                    users={users}
                    departments={departments}
                    categories={categories}
                    entityLabel="Document"
                  />
                </TabPane>

                <TabPane 
                  tab={<span><EditOutlined /> Content</span>} 
                  key="content"
                >
                  <TemplateContentTab
                    isDocument={true}
                    parsedTemplate={parsedTemplate}
                    contentHtml={contentHtml}
                    loading={loading}
                    comments={comments}
                    suggestions={suggestions}
                    logo={logo}
                    headerHTML={headerHTML}
                    footerHTML={footerHTML}
                    logoText={logoText}
                    logoTextRight={logoTextRight}
                    setHeaderHTML={setHeaderHTML}
                    setFooterHTML={setFooterHTML}
                    setLogoText={setLogoText}
                    setLogoTextRight={setLogoTextRight}
                    setLogo={setLogo}
                    currentUser={currentUser}
                    userRole={(() => {
                      const role =
                        currentUser && parsedTemplate
                          ? String(currentUser.id) === String(parsedTemplate.created_by)
                            ? 'author'
                            : 'viewer'
                          : 'viewer';
                      return role;
                    })()}
                    setContentHtml={setContentHtml}
                    manualSaveContent={manualSaveContent}
                    isSaving={isSaving}
                    handleCommentsChange={handleCommentsChange}
                    handleSuggestionsChange={handleSuggestionsChange}
                    references={references}
                    handleReferencesChange={handleReferencesChange}
                    pagesContainerRef={pagesContainerRef}
                    socketUpdateKey={socketUpdateKey}
                    lastTypingTimeRef={lastTypingTimeRef}
                    emitCommentAdd={emitCommentAdd}
                    emitCommentUpdate={emitCommentUpdate}
                    emitCommentDelete={emitCommentDelete}
                    emitSuggestionAdd={emitSuggestionAdd}
                    emitSuggestionUpdate={emitSuggestionUpdate}
                    emitSuggestionDelete={emitSuggestionDelete}
                  />
                </TabPane>

                <TabPane 
                  tab={<span><FileTextOutlined /> Structure</span>} 
                  key="structure"
                >
                  <TemplateStructureTab parsedTemplate={parsedTemplate} references={references} />
                </TabPane>

                <TabPane 
                  tab={<span><TeamOutlined /> Approvers</span>} 
                  key="approvers"
                >
                  <TemplateApproversTab 
                    parsedTemplate={parsedTemplate}
                    departments={departments}
                    users={users}
                    getCurrentUsersToShow={getCurrentUsersToShow}
                  />
                </TabPane>

                <TabPane 
                  tab={<span><HistoryOutlined /> Activity</span>} 
                  key="activity"
                >
                  <TemplateActivityTab 
                    comments={comments}
                    suggestions={suggestions}
                    references={references}
                  />
                </TabPane>

                <TabPane 
                  tab={<span><MessageOutlined /> Notes</span>} 
                  key="notes"
                >
                  <TemplateNotesTab parsedTemplate={parsedTemplate} />
                </TabPane>

                <TabPane 
                  tab={<span><PaperClipOutlined /> Attachments</span>} 
                  key="attachments"
                >
                  <AttachmentsTab 
                    associationType="document" 
                    associationId={parsedTemplate?.document_id || parsedTemplate?.id} 
                    canEdit={canEditAttachments} 
                    status={parsedTemplate?.status}
                  />
                </TabPane>

                <TabPane 
                  tab={<span><BookOutlined /> References</span>} 
                  key="references"
                >
                  <ReferencesTab 
                    references={references} 
                    manualReferences={manualReferences}
                    onReferencesChange={handleReferencesChange}
                    onManualReferencesChange={handleManualReferencesChange}
                    canEdit={canEditReferences}
                    onReferenceClick={(refId) => {
                      // Scroll to reference in editor
                      const el = document.querySelector(`[data-reference-id="${refId}"]`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('reference-highlight-glow');
                        setTimeout(() => el.classList.remove('reference-highlight-glow'), 2000);
                      }
                    }}
                  />
                </TabPane>

                <TabPane 
                  tab={<span><TeamOutlined /> Impact</span>} 
                  key="impact"
                >
                  <TemplateImpactTab parsedTemplate={parsedTemplate} />
                </TabPane>

                {!readOnly && (
                  <TabPane 
                    tab={
                      <Badge dot status={parsedTemplate.status === 'draft' ? 'error' : 'success'} offset={[5, 0]}>
                        <FileSearchOutlined /> Review
                      </Badge>
                    } 
                    key="review"
                  >
                  <Card 
                    bordered={false} 
                    title={
                      <span>
                        Review Document Configuration
                        <Tooltip title="Review document settings and submit for workflow transitions">
                          <InfoCircleOutlined style={{ marginLeft: 8 }} />
                        </Tooltip>
                      </span>
                    }
                  >
                    <Row gutter={[16, 16]}>
                      <Col span={24}>
                        <Card size="small" title="Basic Information">
                          <p><strong>Title:</strong> {parsedTemplate.title || parsedTemplate.name || 'Not specified'}</p>
                          <p><strong>Status:</strong> <Tag color="blue">{parsedTemplate.status?.replace('_', ' ').toUpperCase()}</Tag></p>
                          <div style={{ marginTop: 24 }}>
                            <Button 
                              type="primary" 
                              onClick={() => {
                                setApproverType('review');
                                setDocumentApproversModalVisible(true);
                              }}
                            >
                              Submit for Review
                            </Button>
                            <Button 
                              style={{ marginLeft: 12 }}
                              onClick={() => {
                                setApproverType('approval');
                                setDocumentApproversModalVisible(true);
                              }}
                            >
                              Submit for Approval
                            </Button>
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  </Card>
                </TabPane>
                )}
              </Tabs>
            </div>
          )}
        </div>

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
          reviewerRoleSlug="document_reviewer"
          approverRoleSlug="document_approver"
          onSubmit={async () => {
            if (!sharedDueDate) {
              errorAlert('Submission Failed', 'Please select a due date');
              return;
            }
            const finalStatus = approverType === 'review' ? 'pending_review' : 'pending_approval';
            const ok = await handleSubmitWorkflow(finalStatus);
            if (ok) {
              setDocumentApproversModalVisible(false);
              onCancel();
            }
          }}
        />

        <RejectionModal
          visible={showRejectionModal}
          onCancel={() => {
            setShowRejectionModal(false);
            setRejectionComment('');
          }}
          onReject={async () => {
            const ok = await handleReject();
            if (ok) onCancel();
          }}
          rejectionComment={rejectionComment}
          setRejectionComment={setRejectionComment}
          isRejecting={isRejecting}
        />
      </div>
    </>
  );
};

DocumentPreview.propTypes = {
  document: PropTypes.object.isRequired,
  categories: PropTypes.array,
  users: PropTypes.array,
  departments: PropTypes.array,
  currentUser: PropTypes.object,
  onCancel: PropTypes.func.isRequired,
  readOnly: PropTypes.bool
};

DocumentPreview.defaultProps = {
  categories: [],
  users: [],
  departments: []
};

export default DocumentPreview;
