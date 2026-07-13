import React from 'react';
import { Modal, Row, Col, Card, Radio, Alert, DatePicker, Typography, Select, Table, Button, Empty, Tag } from 'antd';
import moment from 'moment';

const { Text } = Typography;
const { Option } = Select;

const TemplateApproversModal = ({ 
  visible, 
  onCancel, 
  approverType, 
  setApproverType, 
  sharedDueDate, 
  setSharedDueDate, 
  templateApprovers, 
  users, 
  handleAddTemplateApprover, 
  handleRemoveTemplateApprover, 
  onSubmit,
  entityLabel = 'Template',
  reviewerRoleSlug = 'template_reviewer',
  approverRoleSlug = 'template_approver'
}) => {

  const currentArray = (approverType === 'review' ? templateApprovers?.reviewers : templateApprovers?.approvers) || [];
  const entity = entityLabel || 'Template';

  return (
    <Modal
      title={`Select ${entity} ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          Close
        </Button>,
        <Button 
          key="submit" 
          type="primary"
          onClick={onSubmit}
          disabled={
            currentArray.length === 0 || !sharedDueDate
          }
        >
          Submit for {approverType === 'review' ? 'Review' : 'Approval'}
        </Button>
      ]}
      width={800}
    >      
      <Row gutter={[16, 16]}>
       
        <Col span={24}>
          <Card title="Submission Type" size="small">
            <Radio.Group 
              value={approverType} 
              onChange={(e) => setApproverType(e.target.value)}
              style={{ width: '100%' }}
            >
              <Radio value="review">Submit for Review</Radio>
              <Radio value="approval">Submit for Approval</Radio>
            </Radio.Group>
            <Alert
              message={
                approverType === 'review' 
                  ? `Reviewers will provide feedback and recommendations on the ${entity.toLowerCase()}`
                  : `Approvers will make the final decision to approve or reject the ${entity.toLowerCase()}`
              }
              type="info"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
    
        <Col span={24}>
          <Card title="Due Date" size="small">
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Select due date"
              value={sharedDueDate}
              onChange={setSharedDueDate}
              disabledDate={(current) => current && current < moment().startOf('day')}
            />
            <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              This due date will apply to all selected {approverType === 'review' ? 'reviewers' : 'approvers'}
            </Text>
          </Card>
        </Col>
        
        <Col span={24}>
          <Card title={`Add ${entity} ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
            <Select
              style={{ width: '100%' }}
              placeholder="Select users by email"
              value={null}
              onChange={handleAddTemplateApprover}
              optionLabelProp="label"
              showSearch
              filterOption={(input, option) => 
                option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {users
                .filter(user => {
                  return !currentArray.some(approver => approver.userId === user.id) && 
                         user.template_approver === 'yes';
                })
                .map(user => (
                  <Option 
                    key={user.id} 
                    value={user.id}
                    label={user.email}
                  >
                    <div>
                      <div>{user.email}</div>
                      <div style={{ fontSize: 'smaller', color: '#666' }}>{user.first_name} {user.last_name}</div>
                      {user.department && (
                        <div style={{ fontSize: 'smaller', color: '#666' }}>
                          Department: {user.department}
                        </div>
                      )}
                    </div>
                  </Option>
                ))
              }
            </Select>
          </Card>
        </Col>
        
        <Col span={24}>
          <Card title={`Selected ${entity} ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
            {currentArray.length > 0 ? (
              <Table
                dataSource={currentArray}
                rowKey="userId"
                pagination={false}
                columns={[
                  {
                    title: 'Name',
                    dataIndex: 'name',
                    key: 'name',
                  },
                  {
                    title: 'Email',
                    dataIndex: 'email',
                    key: 'email',
                  },
                  {
                    title: 'Department',
                    dataIndex: 'department',
                    key: 'department',
                  },
                  {
                    title: 'Role',
                    dataIndex: 'role',
                    key: 'role',
                    render: (role) => (
                      <Tag color={role === reviewerRoleSlug ? 'blue' : 'green'}>
                        {role === reviewerRoleSlug ? 'Reviewer' : 'Approver'}
                      </Tag>
                    )
                  },
                  {
                    title: 'Action',
                    key: 'action',
                    render: (_, record) => (
                      <Button 
                        type="link" 
                        danger 
                        onClick={() => handleRemoveTemplateApprover(record.userId)}
                      >
                        Remove
                      </Button>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty description={`No ${entity.toLowerCase()} ${approverType === 'review' ? 'reviewers' : 'approvers'} selected`} />
            )}
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

export default TemplateApproversModal;
