import React from 'react';
import { Card, Descriptions, Tag, Button, Form, Input, Select, Space } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';

const TemplateOverviewTab = ({ 
  parsedTemplate, 
  getCategoryDetails, 
  categories = [], 
  updateMetadata, 
  isAuthor, 
  entityLabel = 'Template' 
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [form] = Form.useForm();

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updateMetadata(values);
      setIsEditing(false);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  if (isEditing) {
    return (
      <Card bordered={false}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: parsedTemplate.name || parsedTemplate.title,
            description: parsedTemplate.description,
            category_id: parsedTemplate.category_id || parsedTemplate.categoryId
          }}
        >
          <Form.Item name="name" label={`${entityLabel} Name`} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="category_id" label="Category">
            <Select>
              {categories.map(cat => (
                <Select.Option key={cat.category_id} value={cat.category_id}>
                  {cat.category_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              Save Changes
            </Button>
            <Button icon={<CloseOutlined />} onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </Space>
        </Form>
      </Card>
    );
  }

  return (
    <Card style={{ overflow: 'auto' }} bordered={false}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {isAuthor && (
          <Button 
            icon={<EditOutlined />} 
            onClick={() => setIsEditing(true)}
            type="primary"
            ghost
          >
            Edit Info
          </Button>
        )}
      </div>
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label={`${entityLabel} Name`}>{parsedTemplate.name || parsedTemplate.title}</Descriptions.Item>
        <Descriptions.Item label="Description">{parsedTemplate.description}</Descriptions.Item>
        <Descriptions.Item label="Category">{getCategoryDetails(parsedTemplate.category_id || parsedTemplate.categoryId)?.category_name || 'No Category'}</Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={
            parsedTemplate.status === 'approved' ? 'green' :
            parsedTemplate.status === 'reviewed' ? 'blue' : 
            parsedTemplate.status === 'rejected' ? 'red' :
            parsedTemplate.status === 'pending_approval' ? 'orange' :
            parsedTemplate.status === 'pending_review' ? 'purple' : 'default'
          }>
            {parsedTemplate.status === 'approved' ? 'Approved' :
             parsedTemplate.status === 'reviewed' ? 'Reviewed' : 
             parsedTemplate.status === 'rejected' ? 'Rejected' :
             parsedTemplate.status === 'pending_approval' ? 'Pending Approval' :
             parsedTemplate.status === 'pending_review' ? 'Pending Review' : 'Draft'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Created">{parsedTemplate.created_at ? new Date(parsedTemplate.created_at).toLocaleDateString() : new Date().toLocaleDateString()}</Descriptions.Item>
        <Descriptions.Item label="Last Updated">{parsedTemplate.updated_at ? new Date(parsedTemplate.updated_at).toLocaleDateString() : new Date().toLocaleDateString()}</Descriptions.Item>
        <Descriptions.Item label="Version">{parsedTemplate.version || '1.0'}</Descriptions.Item>
        <Descriptions.Item label="Author/Creator">{parsedTemplate.created_by || parsedTemplate.author || 'Unknown'}</Descriptions.Item>
        <Descriptions.Item label="Document Type">{parsedTemplate.document_type || entityLabel}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
};

export default TemplateOverviewTab;
