import React, { useRef } from 'react';
import { Tabs, Spin, message } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import moment from 'moment';
import PropTypes from 'prop-types';

import '../../../Home/components/Dashboard/Templates/CommentsSuggestionsFixes.css';
import './TemplatePreview.css';

// Hooks
import { useTemplatePreviewState } from './hooks/useTemplatePreviewState';
import { useTemplateActions } from './hooks/useTemplateActions';
import { useTemplateContent } from './hooks/useTemplateContent';

// Components
import TemplatePreviewHeader from './components/TemplatePreviewHeader';
import TemplateOverviewTab from './components/TemplateOverviewTab';
import OverviewProgressTab from './components/OverviewProgressTab';
import TemplateContentTab from './components/TemplateContentTab';
import TemplateStructureTab from './components/TemplateStructureTab';
import TemplateApproversTab from './components/TemplateApproversTab';
import TemplateActivityTab from './components/TemplateActivityTab';
import TemplateNotesTab from './components/TemplateNotesTab';
import TemplateReviewTab from './components/TemplateReviewTab';
import TemplateRevisionHistoryTab from './components/TemplateRevisionHistoryTab';
import AttachmentsTab from './components/AttachmentsTab';
import ReferencesTab from './components/ReferencesTab';
import RejectionModal from './components/RejectionModal';
import TemplateApproversModal from '../../../Home/components/Dashboard/Templates/CreateTemplate/components/TemplateApproversModal';

const { TabPane } = Tabs;

const TemplatePreview = ({ 
  template, 
  categories, 
  users,
  departments,
  currentUser,
  onCancel 
}) => {
  
  // State Hook
  const { 
    loading, 
    parsedTemplate, 
    setParsedTemplate, 
    initialData 
  } = useTemplatePreviewState(template);

  // Actions Hook
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
    handleReject,
    updateMetadata,
    handleSubmit: apiSubmit
  } = useTemplateActions(parsedTemplate, setParsedTemplate, currentUser);

  // Workflow State
  const [templateApproversModalVisible, setTemplateApproversModalVisible] = React.useState(false);
  const [templateApprovers, setTemplateApprovers] = React.useState({
    reviewers: [],
    approvers: []
  });
  const [approverType, setApproverType] = React.useState('review');
  const [sharedDueDate, setSharedDueDate] = React.useState(null);

  // Sync templateApprovers from parsedTemplate on load
  React.useEffect(() => {
    if (parsedTemplate?.template_approvers) {
      setTemplateApprovers({
        reviewers: parsedTemplate.template_approvers.reviewers || [],
        approvers: parsedTemplate.template_approvers.approvers || []
      });
    }
  }, [parsedTemplate]);

  // Refs — declared BEFORE useTemplateContent so the hook can read fresh DOM HTML
  const pagesContainerRef = useRef(null);

  // Content Hook
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
    // lastSavedContent,
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
  } = useTemplateContent(parsedTemplate, initialData, currentUser, pagesContainerRef, setParsedTemplate);

  const isAuthor = currentUser && parsedTemplate ? String(currentUser.id) === String(parsedTemplate.created_by) : false;
  const canEditAttachments = (isAuthor || (currentUser && currentUser.role === 'admin')) && ['draft', 'pending_revision'].includes(parsedTemplate?.status);
  const canEditReferences = canEditAttachments; // Same logic as attachments

  // Handlers for workflow
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
    
    if (!templateApprovers[targetArray].some(approver => approver.userId === userId)) {
      setTemplateApprovers(prev => ({
        ...prev,
        [targetArray]: [...prev[targetArray], newApprover]
      }));
    }
  };
  
  const handleRemoveTemplateApprover = (userId) => {
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    setTemplateApprovers(prev => ({
      ...prev,
      [targetArray]: prev[targetArray].filter(approver => approver.userId !== userId)
    }));
  };

  const handleHeaderSubmit = async (status) => {
    if (status === 'draft') {
      const result = await apiSubmit('draft');
      if (result) onCancel();
      return;
    }
    setApproverType(status === 'pending_review' ? 'review' : 'approval');
    setTemplateApproversModalVisible(true);
  };

  // Helper
  const getCategoryDetails = (categoryId) => {
    return categories.find(c => c.category_id === categoryId) || {};
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

  return (
    <>
      <div className="template-page" style={{ backgroundColor: '#fff', minHeight: '100vh' }}>
        {/* Header */}
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
            const result = await handleApprove();
            if (result) onCancel();
          }}
          setShowRejectionModal={setShowRejectionModal}
          isReviewing={isReviewing}
          isApproving={isApproving}
          isRejecting={isRejecting}
          handleSubmit={handleHeaderSubmit}
        />
        
        {/* Content */}
        <div className="template-page-content">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Loading template...</div>
            </div>
          ) : (
            <div className="template-content">
              <Tabs defaultActiveKey="content" type="card">
                <TabPane tab="Overview" key="overview">
                   <TemplateOverviewTab 
                     parsedTemplate={parsedTemplate} 
                     getCategoryDetails={getCategoryDetails} 
                     categories={categories}
                     updateMetadata={updateMetadata}
                     isAuthor={isAuthor}
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
                    entityLabel="Template"
                  />
                </TabPane>

                <TabPane tab="Content" key="content">
                  <TemplateContentTab
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
                      const role = currentUser && parsedTemplate ? (
                        String(currentUser.id) === String(parsedTemplate.created_by) ? 'admin' :
                        (parsedTemplate.template_approvers?.reviewers?.some(r => String(r.userId) === String(currentUser.id) || r.email === currentUser.email) ? 'reviewer' : 'viewer')
                      ) : 'viewer';
                      return role;
                    })()}
                    socketUpdateKey={socketUpdateKey}
                    pagesContainerRef={pagesContainerRef}
                    setContentHtml={setContentHtml}
                    handleCommentsChange={handleCommentsChange}
                    handleSuggestionsChange={handleSuggestionsChange}
                    references={references}
                    handleReferencesChange={handleReferencesChange}
                    emitCommentAdd={emitCommentAdd}
                    emitCommentUpdate={emitCommentUpdate}
                    emitCommentDelete={emitCommentDelete}
                    emitSuggestionAdd={emitSuggestionAdd}
                    emitSuggestionUpdate={emitSuggestionUpdate}
                    emitSuggestionDelete={emitSuggestionDelete}
                    lastTypingTimeRef={lastTypingTimeRef}
                  />
                </TabPane>

                {parsedTemplate?.status === 'published' && (
                  <TabPane tab="Revision History" key="revisionHistory">
                    <TemplateRevisionHistoryTab 
                      templateId={parsedTemplate?.id}
                      currentVersion={parsedTemplate?.version}
                    />
                  </TabPane>
                )}

                <TabPane tab="Structure" key="structure">
                  <TemplateStructureTab 
                    parsedTemplate={parsedTemplate} 
                    contentHtml={contentHtml}
                    comments={comments}
                    suggestions={suggestions}
                    references={references}
                  />
                </TabPane>

                <TabPane tab="Approvers" key="approvers">
                   <TemplateApproversTab 
                     parsedTemplate={parsedTemplate}
                     departments={departments}
                     users={users}
                     getCurrentUsersToShow={getCurrentUsersToShow}
                     isAuthor={isAuthor}
                     updateMetadata={updateMetadata}
                   />
                </TabPane>

                <TabPane tab="Activity" key="activity">
                  <TemplateActivityTab 
                    comments={comments}
                    suggestions={suggestions}
                    references={references}
                  />
                </TabPane>

                 <TabPane tab="Notes" key="notes">
                   <TemplateNotesTab parsedTemplate={parsedTemplate} />
                 </TabPane>

                 <TabPane tab="Attachments" key="attachments">
                   <AttachmentsTab 
                     associationType="template" 
                     associationId={parsedTemplate?.id} 
                     canEdit={canEditAttachments} 
                   />
                 </TabPane>

                  <TabPane tab="References" key="references">
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

                 {isAuthor && (
                   <TabPane tab="Review" key="review">
                     <TemplateReviewTab 
                       parsedTemplate={parsedTemplate}
                       approvers={[...templateApprovers.reviewers, ...templateApprovers.approvers]}
                       departments={departments}
                       categories={categories}
                       handleSubmit={async (status) => {
                         const result = await apiSubmit(status);
                         if (result) onCancel();
                       }}
                       canSubmit={true}
                       showTemplateApproversModal={() => setTemplateApproversModalVisible(true)}
                       setApproverType={setApproverType}
                     />
                   </TabPane>
                 )}
              </Tabs>
            </div>
          )}
        </div>

        <RejectionModal 
          visible={showRejectionModal}
          onCancel={() => {
            setShowRejectionModal(false);
            setRejectionComment("");
          }}
          onReject={async () => {
            const result = await handleReject();
            if (result) onCancel();
          }}
          rejectionComment={rejectionComment}
           setRejectionComment={setRejectionComment}
           isRejecting={isRejecting}
         />

          <TemplateApproversModal 
            visible={templateApproversModalVisible}
            onCancel={() => setTemplateApproversModalVisible(false)}
            approverType={approverType}
            setApproverType={setApproverType}
            sharedDueDate={sharedDueDate}
            setSharedDueDate={setSharedDueDate}
            templateApprovers={templateApprovers}
            users={users}
            handleAddTemplateApprover={handleAddTemplateApprover}
            handleRemoveTemplateApprover={handleRemoveTemplateApprover}
            onSubmit={async () => {
              if (!sharedDueDate) {
                message.error('Please select a due date');
                return;
              }
              const finalStatus = approverType === 'review' ? 'pending_review' : 'pending_approval';
              
              const updatedApprovers = { ...templateApprovers };
              // Reset ALL reviewers and approvers to 'pending' on resubmission
              // so previously rejected/approved users get a clean slate
              updatedApprovers.reviewers = (updatedApprovers.reviewers || []).map(a => {
                const { rejectedAt, reviewedAt, approvedAt, comment: _comment, ...rest } = a;
                return {
                  ...rest,
                  status: 'pending',
                  dueDate: sharedDueDate
                };
              });
              updatedApprovers.approvers = (updatedApprovers.approvers || []).map(a => {
                const { rejectedAt, reviewedAt, approvedAt, comment: _comment, ...rest } = a;
                return {
                  ...rest,
                  status: 'pending',
                  dueDate: sharedDueDate
                };
              });

              const result = await apiSubmit(finalStatus, updatedApprovers);
              if (result) {
                setTemplateApproversModalVisible(false);
                onCancel();
              }
            }}
          />
        </div>


    </>       
  );
};

TemplatePreview.propTypes = {
  template: PropTypes.object.isRequired,
  categories: PropTypes.array,
  users: PropTypes.array,
  departments: PropTypes.array,
  currentUser: PropTypes.object,
  onCancel: PropTypes.func.isRequired
};

TemplatePreview.defaultProps = {
  categories: [],
  users: [],
  departments: []
};

export default TemplatePreview;