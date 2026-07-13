import React from 'react';
import { Card, Typography, Empty, Divider } from 'antd';

const TemplateNotesTab = ({ parsedTemplate }) => {
  return (
    <Card bordered={false}>
      <Typography.Title level={5}>Template Notes</Typography.Title>
      {parsedTemplate.notes ? (
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          padding: 16, 
          backgroundColor: '#fafafa', 
          border: '1px solid #e8e8e8',
          borderRadius: 4
        }}>
          {parsedTemplate.notes}
        </div>
      ) : (
        <Empty 
          description="No additional notes provided" 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
        />
      )}
      
      <Divider />
      
      <Typography.Title level={5}>Usage Guidelines</Typography.Title>
      <ul>
        <li>Select any text in the content area to add comments or suggestions</li>
        <li>Comments are for sharing thoughts and questions about the content</li>
        <li>Suggestions are for proposing specific improvements or changes</li>
        <li>Both comments and suggestions are saved automatically and visible to all reviewers</li>
        <li>Use replies to respond to specific comments or suggestions</li>
        <li>Only authors can delete their own comments, suggestions, and replies</li>
        <li>Template reviewers can mark templates as reviewed</li>
        <li>Template approvers can approve or reject templates with comments</li>
      </ul>
    </Card>
  );
};

export default TemplateNotesTab;
