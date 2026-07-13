import React from 'react';
import { Card, Row, Col, Typography, Tag, Space, Divider, Steps, List, Tooltip, Avatar, Empty } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ExclamationCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  HistoryOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckOutlined,
  CommentOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Title, Text, Paragraph } = Typography;

const OverviewProgressTab = ({ 
  parsedTemplate, 
  users = [], 
  departments = [], 
  categories = [],
  entityLabel = "Template" 
}) => {
  if (!parsedTemplate) return null;

  const status = parsedTemplate.status?.toLowerCase();
  
  // Helper to get status tag
  const getStatusTag = (status) => {
    switch (status) {
      case 'draft':
        return <Tag color="default" icon={<FileTextOutlined />}>Draft</Tag>;
      case 'pending_review':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>Pending Review</Tag>;
      case 'reviewed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Reviewed</Tag>;
      case 'pending_approval':
        return <Tag color="warning" icon={<ExclamationCircleOutlined />}>Pending Approval</Tag>;
      case 'approved':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Approved</Tag>;
      case 'published':
        return <Tag color="cyan" icon={<CheckOutlined />}>Published</Tag>;
      case 'rejected':
        return <Tag color="error" icon={<CloseCircleOutlined />}>Rejected</Tag>;
      case 'pending_revision':
        return <Tag color="orange" icon={<HistoryOutlined />}>Pending Revision</Tag>;
      default:
        return <Tag color="default">{status?.replace('_', ' ').toUpperCase()}</Tag>;
    }
  };

  // Helper to get approval status icon/tag
  const getParticipantStatus = (status, comment) => {
    switch (status?.toLowerCase()) {
      case 'reviewed':
      case 'approved':
        return (
          <Space>
            <Tag color="success" icon={<CheckCircleOutlined />}>{status.charAt(0).toUpperCase() + status.slice(1)}</Tag>
            {comment && (
              <Tooltip title={comment}>
                <CommentOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            )}
          </Space>
        );
      case 'rejected':
        return (
          <Space>
            <Tag color="error" icon={<CloseCircleOutlined />}>Rejected</Tag>
            {comment && (
              <Tooltip title={comment}>
                <CommentOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            )}
          </Space>
        );
      case 'pending':
      default:
        return <Tag color="warning" icon={<ClockCircleOutlined />}>Pending</Tag>;
    }
  };

  const author = users.find(u => String(u.id) === String(parsedTemplate.created_by));
  const reviewers = parsedTemplate.template_approvers?.reviewers || [];
  const approvers = parsedTemplate.template_approvers?.approvers || [];

  // Helper to get overall phase status
  const getPhaseStatus = (items, phaseType) => {
    if (!items || items.length === 0) return 'pending';
    
    const hasRejected = items.some(item => item.status?.toLowerCase() === 'rejected');
    if (hasRejected) return 'rejected';

    const allCompleted = items.every(item => 
      ['reviewed', 'approved'].includes(item.status?.toLowerCase())
    );
    
    if (allCompleted) return 'completed';

    const someStarted = items.some(item => 
      ['reviewed', 'approved'].includes(item.status?.toLowerCase())
    );

    // Contextual status based on document state
    if (phaseType === 'review') {
      if (status === 'reviewed' || status === 'pending_approval' || status === 'approved' || status === 'published') return 'completed';
      if (status === 'pending_review' || someStarted) return 'in_progress';
    } else if (phaseType === 'approval') {
      if (status === 'approved' || status === 'published') return 'completed';
      if (status === 'pending_approval' || someStarted) return 'in_progress';
    }

    return 'pending';
  };

  const renderPhaseStatusTag = (items, phaseType) => {
    const phaseStatus = getPhaseStatus(items, phaseType);
    
    switch (phaseStatus) {
      case 'completed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Completed</Tag>;
      case 'rejected':
        return <Tag color="error" icon={<CloseCircleOutlined />}>Rejected</Tag>;
      case 'in_progress':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>In Progress</Tag>;
      default:
        return <Tag color="default">Pending</Tag>;
    }
  };

  // Workflow Stages for Steps component
  const getWorkflowSteps = () => {
    const steps = [
      { title: 'Draft', status: 'finish' },
      { title: 'Review', status: 'wait' },
      { title: 'Approval', status: 'wait' },
      { title: 'Finalized', status: 'wait' }
    ];

    if (status === 'draft' || status === 'pending_revision') {
      steps[0].status = 'process';
    } else if (status === 'pending_review' || status === 'reviewed') {
      steps[0].status = 'finish';
      steps[1].status = status === 'pending_review' ? 'process' : 'finish';
    } else if (status === 'pending_approval' || status === 'approved') {
      steps[0].status = 'finish';
      steps[1].status = 'finish';
      steps[2].status = status === 'pending_approval' ? 'process' : 'finish';
    } else if (status === 'published') {
      steps[0].status = 'finish';
      steps[1].status = 'finish';
      steps[2].status = 'finish';
      steps[3].status = 'finish';
    } else if (status === 'rejected') {
      steps[0].status = 'finish';
      // Determine where it was rejected
      if (reviewers.some(r => r.status === 'rejected')) {
        steps[1].status = 'error';
      } else {
        steps[1].status = 'finish';
        steps[2].status = 'error';
      }
    }

    return steps;
  };

  return (
    <div style={{ padding: '4px' }}>
      <Row gutter={[24, 24]}>
        {/* Summary Card */}
        <Col span={24}>
          <Card bordered={false} className="workflow-summary-card">
            <Row align="middle" gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Space direction="vertical" size={4}>
                  <Text type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Status</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Title level={3} style={{ margin: 0 }}>{getStatusTag(status)}</Title>
                  </div>
                </Space>
              </Col>
              <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                <Space size="large">
                  <div>
                    <Text type="secondary" block>Submission Date</Text>
                    <Text strong>{parsedTemplate.created_at ? moment(parsedTemplate.created_at).format('MMM DD, YYYY') : 'N/A'}</Text>
                  </div>
                  <div>
                    <Text type="secondary" block>Last Updated</Text>
                    <Text strong>{parsedTemplate.updated_at ? moment(parsedTemplate.updated_at).format('MMM DD, YYYY') : 'N/A'}</Text>
                  </div>
                </Space>
              </Col>
            </Row>
            
            <Divider style={{ margin: '20px 0' }} />
            
            <div style={{ padding: '0 20px' }}>
              <Steps 
                size="small" 
                current={
                  status === 'draft' || status === 'pending_revision' ? 0 :
                  status === 'pending_review' || status === 'reviewed' ? 1 :
                  status === 'pending_approval' || status === 'approved' ? 2 :
                  status === 'published' ? 3 : 1
                }
                items={getWorkflowSteps()}
              />
            </div>
          </Card>
        </Col>

        {/* Details Section */}
        <Col xs={24} lg={8}>
          <Card title={<Space><UserOutlined /> Author Information</Space>} bordered={false} style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Avatar size={64} icon={<UserOutlined />} src={author?.avatar} style={{ marginRight: 16, backgroundColor: '#1890ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>{author ? `${author.first_name} ${author.last_name}` : 'Unknown Author'}</Title>
                <Text type="secondary">{author?.email || 'No email available'}</Text>
                <br />
                <Tag color="blue" style={{ marginTop: 4 }}>{author?.role || 'User'}</Tag>
              </div>
            </div>
            <Divider />
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Department:</Text>
                <Text strong>{author?.department || 'Not specified'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Entity Type:</Text>
                <Text strong>{entityLabel}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Category:</Text>
                <Text strong>
                  {categories.find(c => c.category_id === parsedTemplate.category_id)?.category_name || 
                   parsedTemplate.category_id || 'Not specified'}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Row gutter={[24, 24]}>
            {/* Reviewers Progress */}
            <Col span={24}>
              <Card 
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Space><TeamOutlined /> Review Participants</Space>
                    {renderPhaseStatusTag(reviewers, 'review')}
                  </div>
                } 
                bordered={false}
              >
                {reviewers.length > 0 ? (
                  <List
                    itemLayout="horizontal"
                    dataSource={reviewers}
                    renderItem={(item) => (
                      <List.Item
                        extra={getParticipantStatus(item.status, item.comment)}
                      >
                        <List.Item.Meta
                          avatar={<Avatar icon={<UserOutlined />} />}
                          title={item.name}
                          description={
                            <Space split={<Divider type="vertical" />}>
                              <Text type="secondary">{item.department}</Text>
                              {item.dueDate && (
                                <Text type="secondary">
                                  <CalendarOutlined /> Due: {moment(item.dueDate).format('MMM DD, YYYY')}
                                </Text>
                              )}
                              {(item.reviewedAt || item.rejectedAt) && (
                                <Text type="secondary">
                                  Action: {moment(item.reviewedAt || item.rejectedAt).format('MMM DD, YYYY')}
                                </Text>
                              )}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="No reviewers assigned" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            {/* Approvers Progress */}
            <Col span={24}>
              <Card 
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Space><CheckCircleOutlined /> Approval Participants</Space>
                    {renderPhaseStatusTag(approvers, 'approval')}
                  </div>
                } 
                bordered={false}
              >
                {approvers.length > 0 ? (
                  <List
                    itemLayout="horizontal"
                    dataSource={approvers}
                    renderItem={(item) => (
                      <List.Item
                        extra={getParticipantStatus(item.status, item.comment)}
                      >
                        <List.Item.Meta
                          avatar={<Avatar icon={<UserOutlined />} />}
                          title={item.name}
                          description={
                            <Space split={<Divider type="vertical" />}>
                              <Text type="secondary">{item.department}</Text>
                              {item.dueDate && (
                                <Text type="secondary">
                                  <CalendarOutlined /> Due: {moment(item.dueDate).format('MMM DD, YYYY')}
                                </Text>
                              )}
                              {(item.approvedAt || item.rejectedAt) && (
                                <Text type="secondary">
                                  Action: {moment(item.approvedAt || item.rejectedAt).format('MMM DD, YYYY')}
                                </Text>
                              )}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="No approvers assigned" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default OverviewProgressTab;
