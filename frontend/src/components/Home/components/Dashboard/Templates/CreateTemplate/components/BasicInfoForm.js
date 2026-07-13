import React from 'react';
import { Card, Form, Input, Select } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

const BasicInfoForm = ({ categories, filterCategory, setCategory, templates, user }) => {
  // Function to get parent names excluding current category
  const getParentPath = (folder_path, currentId) => {
    if (!folder_path) return [];
    
    return folder_path.split('/')
      .filter(id => id != currentId) // Exclude current category ID
      .map(id => {
        const cat = categories.find(c => c.category_id == id);
        return cat ? cat.category_name : null;
      })
      .filter(Boolean)
      .reverse(); // Show nearest parent first
  };

  return (
    <Card bordered={false} title="Basic Template Information" bodyStyle={{padding: '16px'}}>
      <Form.Item
        name="name"
        label="Template Name"
        validateFirst
        validateDebounce={1000}
        rules={[
          { required: true, message: 'Please enter a template name' },
          {
            validator: async (_, value) => {
              if (value && templates && user) {
                const isDuplicate = templates.some(
                  t => t.name && t.name.toLowerCase() === value.trim().toLowerCase() && t.organization_id === user.orgId
                );
                if (isDuplicate) {
                  return Promise.reject(new Error('A template with this name already exists.'));
                }
              }
              return Promise.resolve();
            }
          }
        ]}
        style={{ marginBottom: '16px' }}
      >
        <Input placeholder="Enter template name" size="middle" />
      </Form.Item>
      
      <Form.Item
        name="description"
        label="Description"
        rules={[{ required: true, message: 'Please provide a description' }]}
        style={{ marginBottom: '16px' }}
      >
        <TextArea rows={3} placeholder="Describe what this template is used for and any important details" />
      </Form.Item>
      
      <Form.Item
        name="category"
        label="Template Category"
        style={{ marginBottom: '16px' }}
      >
        <Select 
          placeholder="Select a category"                
          value={filterCategory}
          onChange={(value) => setCategory(value)}
          allowClear
        >
          {categories.map(category => {
            const parentPath = getParentPath(category.folder_path, category.category_id);
            
            return (
              <Option key={category.category_id} value={category.category_id}>
                <span style={{ fontWeight: 500 }}>{category.category_name}</span>
                {parentPath.length > 0 && (
                  <span style={{
                    color: '#888',
                    fontSize: '0.85em',
                    marginLeft: '6px',
                    fontWeight: 'normal'
                  }}>
                    (in {parentPath.join(' › ')})
                  </span>
                )}
              </Option>
            );
          })}
        </Select>
      </Form.Item>
    </Card>
  );
};

export default BasicInfoForm;
