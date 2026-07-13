import React from 'react';
import { Card, Form, Input, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const NotesTab = () => {
  return (
    <Card 
    bordered={false} 
    bodyStyle={{padding: '16px'}}
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
        style={{ marginBottom: '8px' }}
      >
        <TextArea 
          rows={4} 
          placeholder="Enter any additional notes, instructions, or remarks about this template (optional)"
        />
      </Form.Item>
    </Card>
  );
};

export default NotesTab;
