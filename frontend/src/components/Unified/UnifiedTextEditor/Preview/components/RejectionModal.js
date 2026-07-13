import React from 'react';
import { Modal, Alert, Form, Input, Typography } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';

const RejectionModal = ({ 
  visible, 
  onCancel, 
  onReject, 
  rejectionComment, 
  setRejectionComment, 
  isRejecting 
}) => {
  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <CloseCircleOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
          Reject Template
        </div>
      }
      open={visible}
      onOk={onReject}
      onCancel={onCancel}
      okText="Reject Template"
      cancelText="Cancel"
      confirmLoading={isRejecting}
      okButtonProps={{ danger: true }}
      width={500}
    >
      <Alert
        message="Template Rejection"
        description="Please provide a reason for rejecting this template. This will help the template creator understand what needs to be improved."
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form.Item label="Rejection Reason" required>
        <Input.TextArea
          value={rejectionComment}
          onChange={e => setRejectionComment(e.target.value)}
          placeholder="Please explain why you are rejecting this template..."
          autoSize={{ minRows: 4, maxRows: 8 }}
          autoFocus
          showCount
          maxLength={500}
        />
      </Form.Item>
      
      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
        Your rejection reason will be saved and visible to the template creator and other stakeholders.
      </Typography.Text>
    </Modal>
  );
};

export default RejectionModal;
