import React from 'react';
import { Card, Empty, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * EditorPlaceholder
 * 
 * A safe placeholder component to be used when the main editor code is removed
 * for intellectual property protection during development handovers.
 */
const EditorPlaceholder = ({ mode, isDocument, ...props }) => {
  return (
    <Card 
      style={{ 
        height: '100%', 
        minHeight: '600px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f2f5',
        border: '1px dashed #d9d9d9',
        margin: '20px'
      }}
    >
      <Empty
        image={<FileTextOutlined style={{ fontSize: 64, color: '#1890ff' }} />}
        description={
          <div style={{ textAlign: 'center' }}>
            <Title level={4}>Editor Content Area</Title>
            <Text type="secondary">
              The {isDocument ? 'document' : 'template'} editor is currently in <strong>{mode || 'preview'}</strong> mode.
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Note: The core editor engine has been detached for this development build.
            </Text>
          </div>
        }
      />
    </Card>
  );
};

export default EditorPlaceholder;
