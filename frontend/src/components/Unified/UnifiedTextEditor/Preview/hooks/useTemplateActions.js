import { useState } from 'react';
import axios from 'axios';
import { Modal } from 'antd';
import { successAlert, errorAlert } from '../../../../../utils/alerts';

export const useTemplateActions = (parsedTemplate, setParsedTemplate, currentUser) => {
  const [isReviewing, setIsReviewing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionComment, setRejectionComment] = useState("");
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  const templateId = parsedTemplate?.id || parsedTemplate?.template_id;

  const handleReview = async () => {
    if (!templateId) return;
    setIsReviewing(true);
    try {
      await axios.put(`/api/template_review/${templateId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.firstName} ${currentUser?.lastName}`,
        action: 'review'
      });
      
      setParsedTemplate(prev => {
        const updatedReviewers = prev.template_approvers.reviewers.map(reviewer => {
          if (reviewer.email === currentUser?.email) {
            return { ...reviewer, status: 'Reviewed' };
          }
          return reviewer;
        });
        const allReviewed = updatedReviewers.every(r => r.status === 'Reviewed');
        return {
          ...prev,
          status: allReviewed ? 'reviewed' : 'pending_review',
          template_approvers: { ...prev.template_approvers, reviewers: updatedReviewers }
        };
      });
      
      return true;
    } catch (error) {
      console.error('Error reviewing template:', error);
      errorAlert('Error', 'Failed to review template. Please try again.');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleApprove = async () => {
    if (!templateId) return;
    setIsApproving(true);
    try {
      await axios.put(`/api/template_approve/${templateId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.firstName} ${currentUser?.lastName}`,
        action: 'approve'
      });
      
      setParsedTemplate(prev => {
        const updatedApprovers = prev.template_approvers.approvers.map(approver => {
          if (approver.email === currentUser?.email) {
            return { ...approver, status: 'Approved' };
          }
          return approver;
        });
        const allApproved = updatedApprovers.every(a => a.status === 'Approved');
        return {
          ...prev,
          status: allApproved ? 'approved' : 'pending_approval',
          template_approvers: { ...prev.template_approvers, approvers: updatedApprovers }
        };
      });
      
      return successAlert('Template Approved', 'The template has been successfully approved.');
    } catch (error) {
      console.error('Error approving template:', error);
      errorAlert('Error', 'Failed to approve template. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!templateId) return;
    setIsRejecting(true);
    try {
      await axios.put(`/api/template_reject/${templateId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.firstName} ${currentUser?.lastName}`,
        action: 'reject',
        comment: rejectionComment
      });
      
      setParsedTemplate(prev => {
        const updatedApprovers = prev.template_approvers.approvers.map(approver => {
          if (approver.email === currentUser?.email) {
            return { ...approver, status: 'Rejected', comment: rejectionComment };
          }
          return approver;
        });
        return {
          ...prev,
          status: 'rejected',
          template_approvers: { ...prev.template_approvers, approvers: updatedApprovers }
        };
      });
      
      setShowRejectionModal(false);
      setRejectionComment("");
      return successAlert('Template Rejected', 'The template has been rejected with your comments.');
    } catch (error) {
      console.error('Error rejecting template:', error);
      errorAlert('Error', 'Failed to reject template. Please try again.');
    } finally {
      setIsRejecting(false);
    }
  };

  const updateMetadata = async (metadata) => {
    if (!templateId) return;
    try {
      const response = await axios.put(`/api/update_template_metadata/${templateId}`, metadata);
      if (response.data.success) {
        setParsedTemplate(prev => ({ ...prev, ...metadata }));
        successAlert('Success', 'Information updated successfully');
        return true;
      }
    } catch (error) {
      console.error('Error updating template metadata:', error);
      errorAlert('Update Failed', 'There was an error updating the template configuration.');
      return false;
    }
  };

  const handleSubmit = async (status, templateApproversOverride = null) => {
    if (!templateId) return;
    
    try {
      const templateData = {
        ...parsedTemplate,
        status: status,
        template_approvers: templateApproversOverride || parsedTemplate.template_approvers
      };

      const response = await axios.put(`/api/update_template/${templateId}`, templateData);
      
      if (response.data.success) {
        setParsedTemplate(prev => ({ 
          ...prev, 
          status: status,
          template_approvers: templateApproversOverride || prev.template_approvers
        }));
        return successAlert(
          status === 'draft' ? 'Draft Saved' : 'Template Submitted', 
          `The template has been ${status === 'draft' ? 'saved as a draft' : 'submitted for workflow'} successfully.`
        );
      }
    } catch (error) {
      console.error('Error submitting template:', error);
      errorAlert(
        'Submission Failed', 
        error.response?.data?.message || 'There was an error updating your template status.' 
      );
      return false;
    }
  };

  return {
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
    handleSubmit
  };
};
