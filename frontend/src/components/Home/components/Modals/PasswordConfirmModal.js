import React, { useState, useRef } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';

const PasswordConfirmModal = ({ visible, onCancel, onConfirm }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      try {
        // Simulate API call to verify password
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Call the confirmation callback
        if (onConfirm) {
          await onConfirm(values.password);
        }
        
        // Reset form and close modal
        form.resetFields();
        
      } catch (error) {
        console.error('Password verification failed:', error);
        message.error('Password verification failed');
      } finally {
        setLoading(false);
      }
    } catch (validationError) {
      console.error('Validation failed:', validationError);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Modal
      title="Confirm Password"
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="back" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={loading} 
          onClick={handleSubmit}
        >
          Confirm
        </Button>,
      ]}
      maskClosable={false}
      destroyOnClose={true}
      ref={modalRef}
    >
      <p>Please enter your password to confirm this action:</p>
      <Form
        form={form}
        layout="vertical"
        name="password_confirm_form"
      >
        <Form.Item
          name="password"
          rules={[{ required: true, message: 'Please input your password!' }]}
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="Password" 
            autoComplete="current-password"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PasswordConfirmModal;