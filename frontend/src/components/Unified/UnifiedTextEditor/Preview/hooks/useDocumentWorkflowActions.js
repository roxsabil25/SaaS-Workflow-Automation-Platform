import { useState } from 'react';
import axios from 'axios';
import { successAlert, errorAlert } from '../../../../../utils/alerts';

export const useDocumentWorkflowActions = (parsedTemplate, setParsedTemplate, currentUser) => {
  const [isReviewing, setIsReviewing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  const documentId = parsedTemplate?.document_id || parsedTemplate?.id;

  const handleReview = async () => {
    if (!documentId) return false;
    setIsReviewing(true);
    try {
      await axios.put(`/api/document_review/${documentId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.first_name} ${currentUser?.last_name}`,
        action: 'review'
      });

      setParsedTemplate((prev) => {
        if (!prev?.template_approvers?.reviewers) return prev;
        const updatedReviewers = prev.template_approvers.reviewers.map((reviewer) => {
          if (reviewer.email === currentUser?.email) {
            return { ...reviewer, status: 'Reviewed' };
          }
          return reviewer;
        });
        const allReviewed = updatedReviewers.every((r) => r.status === 'Reviewed');
        return {
          ...prev,
          status: allReviewed ? 'reviewed' : 'pending_review',
          template_approvers: { ...prev.template_approvers, reviewers: updatedReviewers }
        };
      });

      return true;
    } catch (error) {
      console.error('Error reviewing document:', error);
      errorAlert('Error', 'Failed to review document. Please try again.');
      return false;
    } finally {
      setIsReviewing(false);
    }
  };

  const handleApprove = async () => {
    if (!documentId) return false;
    setIsApproving(true);
    try {
      await axios.put(`/api/document_approve/${documentId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.first_name} ${currentUser?.last_name}`,
        action: 'approve'
      });

      setParsedTemplate((prev) => {
        if (!prev?.template_approvers?.approvers) return prev;
        const updatedApprovers = prev.template_approvers.approvers.map((approver) => {
          if (approver.email === currentUser?.email) {
            return { ...approver, status: 'Approved' };
          }
          return approver;
        });
        const allApproved = updatedApprovers.every((a) => a.status === 'Approved');
        return {
          ...prev,
          status: allApproved ? 'approved' : 'pending_approval',
          template_approvers: { ...prev.template_approvers, approvers: updatedApprovers }
        };
      });

      return await successAlert('Document Approved', 'The document has been approved.');
    } catch (error) {
      console.error('Error approving document:', error);
      errorAlert('Error', 'Failed to approve document. Please try again.');
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!documentId) return false;
    setIsRejecting(true);
    try {
      await axios.put(`/api/document_reject/${documentId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.first_name} ${currentUser?.last_name}`,
        action: 'reject',
        comment: rejectionComment
      });

      setParsedTemplate((prev) => {
        if (!prev?.template_approvers?.approvers) return prev;
        const updatedApprovers = prev.template_approvers.approvers.map((approver) => {
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

      const result = await successAlert('Document Rejected', 'The document has been rejected with your comments.');
      setShowRejectionModal(false);
      setRejectionComment('');
      return result;
    } catch (error) {
      console.error('Error rejecting document:', error);
      errorAlert('Error', 'Failed to reject document. Please try again.');
      return false;
    } finally {
      setIsRejecting(false);
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
    handleReject
  };
};
