import React from 'react';
import { Card, Typography, Table, Tag, Divider, Descriptions, Button, Space, message, Row, Col } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import ApproversManager from '../../../../Home/components/Dashboard/Templates/CreateTemplate/components/ApproversManager';

const TemplateApproversTab = ({ 
  parsedTemplate, 
  departments, 
  users = [],
  getCurrentUsersToShow,
  isAuthor,
  updateMetadata
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [approvers, setApprovers] = React.useState(
    Array.isArray(parsedTemplate.approvers) 
      ? parsedTemplate.approvers 
      : (Array.isArray(parsedTemplate.required_approvers) ? parsedTemplate.required_approvers : [])
  );

  // Update local approvers state when parsedTemplate changes (e.g. after a successful save)
  React.useEffect(() => {
    setApprovers(
      Array.isArray(parsedTemplate.approvers) 
        ? parsedTemplate.approvers 
        : (Array.isArray(parsedTemplate.required_approvers) ? parsedTemplate.required_approvers : [])
    );
  }, [parsedTemplate]);

  const addApprover = () => {
    const selectedDepartments = approvers.map(a => a.department);
    const availableDepartments = departments.filter(d => !selectedDepartments.includes(d.name));
    if (availableDepartments.length === 0) {
      message.warning('All departments assigned.');
      return;
    }
    const maxStage = approvers.length > 0 ? Math.max(...approvers.map(a => a.stage)) : 0;
    setApprovers([...approvers, {
      key: approvers.length,
      department: availableDepartments[0].name,
      mandatory: false,
      stage: maxStage > 0 ? maxStage : 1
    }]);
  };

  const removeApprover = (key) => {
    const filtered = approvers.filter(a => a.key !== key);
    setApprovers(filtered.map((a, i) => ({ ...a, key: i })));
  };

  const handleApproverChange = (key, field, value) => {
    setApprovers(approvers.map(a => a.key === key ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    await updateMetadata({ approvers });
    setIsEditing(false);
  };
  
  const renderApproversTable = () => {
    // Priority: parsedTemplate.approvers (array set by hook) → required_approvers → empty
    const dataSource = Array.isArray(parsedTemplate?.approvers) && parsedTemplate.approvers.length > 0
      ? parsedTemplate.approvers
      : (Array.isArray(parsedTemplate?.required_approvers) && parsedTemplate.required_approvers.length > 0
          ? parsedTemplate.required_approvers
          : []);

    // Also check template_approvers for individual user configs to display
    const workflowApprovers = parsedTemplate?.template_approvers;
    const workflowReviewers = Array.isArray(workflowApprovers?.reviewers) ? workflowApprovers.reviewers : [];
    const workflowApproversList = Array.isArray(workflowApprovers?.approvers) ? workflowApprovers.approvers : [];
    const allWorkflowUsers = [...workflowReviewers, ...workflowApproversList];

    if (dataSource.length === 0 && allWorkflowUsers.length === 0) {
      return <Typography.Text type="secondary">No approvers configured</Typography.Text>;
    }

    // If we have department-level config, show the table
    if (dataSource.length > 0) {
      const columns = [
        {
          title: 'Stage',
          dataIndex: 'stage',
          key: 'stage',
          render: (stage) => <Tag>{stage || 'Approval'}</Tag>
        },
        {
          title: 'Department',
          dataIndex: 'department',
          key: 'department',
          render: (deptId) => {
            const dept = departments.find(d => d.id === deptId || d.name === deptId);
            return dept ? dept.name : `${deptId}`;
          }
        },
        {
          title: 'Mandatory',
          dataIndex: 'mandatory',
          key: 'mandatory',
          render: (mandatory) => (
            <Tag color={mandatory ? 'green' : 'orange'}>
              {mandatory ? 'Yes' : 'No'}
            </Tag>
          )
        }
      ];

      return (
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          size="small"
          rowKey={(record, index) => `approver-${index}`}
        />
      );
    }

    // Fallback: show individual user configs from template_approvers
    if (allWorkflowUsers.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {workflowReviewers.length > 0 && (
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Reviewers</Typography.Text>
              {workflowReviewers.map((u, i) => (
                <Tag key={i} color="blue" style={{ marginBottom: 4 }}>
                  {u.name || u.email} {u.department ? `(${u.department})` : ''}
                </Tag>
              ))}
            </div>
          )}
          {workflowApproversList.length > 0 && (
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Approvers</Typography.Text>
              {workflowApproversList.map((u, i) => (
                <Tag key={i} color="green" style={{ marginBottom: 4 }}>
                  {u.name || u.email} {u.department ? `(${u.department})` : ''}
                </Tag>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <Typography.Text type="secondary">No approvers configured</Typography.Text>;
  };


  const renderDepartmentalUsers = () => {
    if (!approvers || approvers.length === 0) return null;

    return (
      <div style={{ marginTop: 24 }}>
        <Typography.Title level={5}>Departmental Contacts</Typography.Title>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          The following users from required departments have visibility into this {parsedTemplate.document_id ? 'document' : 'template'}.
        </Typography.Text>
        
        <Row gutter={[16, 16]}>
          {approvers.map((approver, idx) => {
            const deptUsers = users.filter(u => u.department === approver.department);
            return (
              <Col span={24} key={`dept-users-${idx}`}>
                <Card 
                  size="small" 
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{approver.department} Department</span>
                      <Tag color="blue">Stage {approver.stage}</Tag>
                    </div>
                  }
                  style={{ backgroundColor: '#fafafa' }}
                >
                  {deptUsers.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {deptUsers.map(u => (
                        <Tag key={u.id} color="cyan">
                          {u.first_name} {u.last_name} ({u.email})
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <Typography.Text type="secondary" italic>No users found in this department</Typography.Text>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>
    );
  };

  if (isEditing) {
    return (
      <Card bordered={false}>
        <ApproversManager 
          approvers={approvers}
          setApprovers={setApprovers}
          departments={departments}
          addApprover={addApprover}
          removeApprover={removeApprover}
          handleApproverChange={handleApproverChange}
          handleApproverDepartmentChange={(key, val) => handleApproverChange(key, 'department', val)}
        />
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            Save Approvers
          </Button>
          <Button icon={<CloseOutlined />} onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </Space>
      </Card>
    );
  }

  return (
    <Card bordered={false}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {isAuthor && (
          <Button 
            icon={<EditOutlined />} 
            onClick={() => setIsEditing(true)}
            type="primary"
            ghost
          >
            Edit Approver Workflow
          </Button>
        )}
      </div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={5}>
          {parsedTemplate.status === 'pending_review' || parsedTemplate.status === 'reviewed'
            ? 'Reviewers Status'
            : parsedTemplate.status === 'draft' || parsedTemplate.status === 'pending_revision'
              ? 'Configured Approvers (Pre-set from Template)'
              : 'Approvers Status'}
        </Typography.Title>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(getCurrentUsersToShow() || []).map((user, index) => (
            <Card key={index} size="small" style={{ 
              borderLeft: `4px solid ${
                user.status === 'Approved' || user.status === 'Reviewed' ? '#52c41a' :
                user.status === 'Rejected' ? '#ff4d4f' : '#faad14'
              }` 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <Descriptions size="small" column={2}>
                    <Descriptions.Item label="Name">{user.name}</Descriptions.Item>
                    <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
                  </Descriptions>
                  
                  {user.comment && (
                    <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fff2e8', borderRadius: 4 }}>
                      <Typography.Text strong style={{ fontSize: '12px', color: '#d46b08' }}>
                        Rejection Reason:
                      </Typography.Text>
                      <Typography.Paragraph style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                        {user.comment}
                      </Typography.Paragraph>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      
      <Divider />
      
      <Typography.Title level={5}>Required Approvers Configuration</Typography.Title>
      {renderApproversTable()}

      {renderDepartmentalUsers()}
    </Card>
  );
};

export default TemplateApproversTab;
