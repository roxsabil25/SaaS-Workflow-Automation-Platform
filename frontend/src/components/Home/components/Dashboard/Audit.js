import React, { useState, useMemo } from 'react';
import {
  Card, Table, Tag, Typography, Space, Input, Select, DatePicker, Button, Row, Col,
  Tooltip, Badge, Modal, Descriptions, Timeline
} from 'antd';
import {
  AuditOutlined, SearchOutlined, ClearOutlined, FileTextOutlined,
  UserOutlined, ClockCircleOutlined, EyeOutlined,
  CheckCircleOutlined, CloseCircleOutlined, EditOutlined,
  LoginOutlined, LogoutOutlined, FileAddOutlined, DeleteOutlined,
  FileDoneOutlined, SyncOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// ─── Action metadata ────────────────────────────────────────────────────────
const ACTION_META = {
  USER_LOGIN:         { color: 'cyan',     icon: <LoginOutlined />,        label: 'User Login' },
  USER_LOGOUT:        { color: 'purple',   icon: <LogoutOutlined />,       label: 'User Logout' },
  DOCUMENT_CREATED:   { color: 'green',    icon: <FileAddOutlined />,      label: 'Document Created' },
  DOCUMENT_UPDATED:   { color: 'blue',     icon: <EditOutlined />,         label: 'Document Updated' },
  DOCUMENT_DELETED:   { color: 'red',      icon: <DeleteOutlined />,       label: 'Document Deleted' },
  DOCUMENT_REVIEWED:  { color: 'geekblue', icon: <EyeOutlined />,          label: 'Document Reviewed' },
  DOCUMENT_APPROVED:  { color: 'gold',     icon: <CheckCircleOutlined />,  label: 'Document Approved' },
  DOCUMENT_REJECTED:  { color: 'volcano',  icon: <CloseCircleOutlined />,  label: 'Document Rejected' },
  DOCUMENT_PUBLISHED: { color: 'lime',     icon: <FileDoneOutlined />,     label: 'Document Published' },
  TEMPLATE_CREATED:   { color: 'green',    icon: <FileAddOutlined />,      label: 'Template Created' },
  TEMPLATE_UPDATED:   { color: 'blue',     icon: <EditOutlined />,         label: 'Template Updated' },
  TEMPLATE_DELETED:   { color: 'red',      icon: <DeleteOutlined />,       label: 'Template Deleted' },
  TEMPLATE_REVIEWED:  { color: 'geekblue', icon: <EyeOutlined />,          label: 'Template Reviewed' },
  TEMPLATE_APPROVED:  { color: 'gold',     icon: <CheckCircleOutlined />,  label: 'Template Approved' },
  TEMPLATE_REJECTED:  { color: 'volcano',  icon: <CloseCircleOutlined />,  label: 'Template Rejected' },
  TEMPLATE_PUBLISHED: { color: 'lime',     icon: <FileDoneOutlined />,     label: 'Template Published' },
  AI_SUMMARY_GENERATED: { color: 'magenta', icon: <SyncOutlined />,        label: 'AI Summary Generated' },
  PASSWORD_RESET:     { color: 'orange',   icon: <EditOutlined />,         label: 'Password Reset' },
};

const getActionMeta = (action) => {
  if (!action) return { color: 'default', icon: null, label: '—' };
  const upper = action.toUpperCase();
  if (ACTION_META[upper]) return ACTION_META[upper];
  // fuzzy fallback
  if (upper.includes('CREATE')) return { color: 'green',    icon: <FileAddOutlined />,     label: action.replace(/_/g, ' ') };
  if (upper.includes('DELETE')) return { color: 'red',      icon: <DeleteOutlined />,      label: action.replace(/_/g, ' ') };
  if (upper.includes('UPDATE') || upper.includes('EDIT'))
                                return { color: 'blue',     icon: <EditOutlined />,        label: action.replace(/_/g, ' ') };
  if (upper.includes('APPROVE')) return { color: 'gold',   icon: <CheckCircleOutlined />, label: action.replace(/_/g, ' ') };
  if (upper.includes('REJECT'))  return { color: 'volcano', icon: <CloseCircleOutlined />, label: action.replace(/_/g, ' ') };
  if (upper.includes('REVIEW'))  return { color: 'geekblue',icon: <EyeOutlined />,         label: action.replace(/_/g, ' ') };
  if (upper.includes('LOGIN'))   return { color: 'cyan',    icon: <LoginOutlined />,       label: action.replace(/_/g, ' ') };
  if (upper.includes('PUBLISH')) return { color: 'lime',    icon: <FileDoneOutlined />,    label: action.replace(/_/g, ' ') };
  return { color: 'default', icon: null, label: action.replace(/_/g, ' ') };
};

// ─── Parse details JSON into structured fields ───────────────────────────────
const parseDetails = (details) => {
  if (!details) return {};
  try {
    return typeof details === 'string' ? JSON.parse(details) : details;
  } catch {
    return { raw: String(details) };
  }
};

// Human-readable field labels
const FIELD_LABELS = {
  title:        'Document Title',
  name:         'Template Name',
  status:       'Status',
  email:        'Email',
  userEmail:    'Reviewer Email',
  comment:      'Rejection Comment',
  templateId:   'Template ID',
  templateName: 'Template Name',
  version:      'Version',
  note:         'Note',
  raw:          'Details',
};

const friendlyKey = (k) => FIELD_LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();

const statusColor = (val) => {
  const v = String(val).toLowerCase();
  if (['published', 'approved', 'active'].includes(v)) return 'green';
  if (['draft'].includes(v)) return 'blue';
  if (['pending_review', 'pending_approval', 'pending'].includes(v)) return 'orange';
  if (['rejected'].includes(v)) return 'red';
  if (['reviewed'].includes(v)) return 'geekblue';
  return null;
};

// ─── Detail Summary (inline in table) ───────────────────────────────────────
const DetailSummary = ({ details, actionType }) => {
  const parsed = parseDetails(details);
  const keys = Object.keys(parsed);
  if (!keys.length) return <Text type="secondary">—</Text>;

  // Pick the most meaningful field to show inline
  const primary = parsed.title || parsed.name || parsed.templateName || parsed.email || parsed.note || parsed.raw;
  const status = parsed.status;

  return (
    <Space wrap size={4}>
      {primary && (
        <Text style={{ fontSize: 12 }} ellipsis>
          {String(primary).slice(0, 40)}{String(primary).length > 40 ? '…' : ''}
        </Text>
      )}
      {status && (
        <Tag color={statusColor(status) || 'default'} style={{ fontSize: 11 }}>
          {String(status).replace(/_/g, ' ')}
        </Tag>
      )}
      {!primary && !status && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {keys.length} field{keys.length > 1 ? 's' : ''}
        </Text>
      )}
    </Space>
  );
};

// ─── Detail Modal ────────────────────────────────────────────────────────────
const DetailModal = ({ record, onClose }) => {
  if (!record) return null;
  const meta = getActionMeta(record.action_type);
  const parsed = parseDetails(record.details);
  const userName = [record.first_name, record.last_name].filter(Boolean).join(' ') || `User #${record.user_id}`;

  return (
    <Modal
      open={!!record}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      title={
        <Space>
          <Tag color={meta.color} icon={meta.icon} style={{ fontSize: 13, padding: '2px 10px' }}>
            {meta.label}
          </Tag>
        </Space>
      }
      width={560}
    >
      {/* Timeline summary */}
      <Timeline
        style={{ marginBottom: 20, marginTop: 8 }}
        items={[
          {
            color: meta.color === 'default' ? 'gray' : meta.color,
            dot: meta.icon,
            children: (
              <div>
                <Text strong>{meta.label}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    by <Text strong>{userName}</Text>
                    {' · '}
                    <Tooltip title={dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}>
                      {dayjs(record.created_at).fromNow()}
                    </Tooltip>
                  </Text>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Core info */}
      <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="User">{userName}</Descriptions.Item>
        <Descriptions.Item label="Time">
          {dayjs(record.created_at).format('MMMM D, YYYY [at] HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="Action">
          <Tag color={meta.color}>{meta.label}</Tag>
        </Descriptions.Item>
        {record.document_id && (
          <Descriptions.Item label="Document ID">
            <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {record.document_id}
            </Text>
          </Descriptions.Item>
        )}
        {record.ip_address && (
          <Descriptions.Item label="IP Address">
            <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{record.ip_address}</Text>
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Parsed detail fields */}
      {Object.keys(parsed).length > 0 && (
        <>
          <Title level={5} style={{ marginBottom: 8 }}>Additional Details</Title>
          <Descriptions bordered size="small" column={1}>
            {Object.entries(parsed).map(([k, v]) => (
              <Descriptions.Item key={k} label={friendlyKey(k)}>
                {k === 'status'
                  ? <Tag color={statusColor(v) || 'default'}>{String(v).replace(/_/g, ' ')}</Tag>
                  : k.toLowerCase().includes('id')
                  ? <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(v)}</Text>
                  : <Text>{String(v)}</Text>
                }
              </Descriptions.Item>
            ))}
          </Descriptions>
        </>
      )}
    </Modal>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getUniqueActionTypes = (logs) =>
  [...new Set((logs || []).map(l => l.action_type).filter(Boolean))].sort();

const getUniqueUsers = (logs) => {
  const seen = new Set();
  return (logs || [])
    .filter(l => { if (seen.has(l.user_id)) return false; seen.add(l.user_id); return true; })
    .map(l => ({ id: l.user_id, name: [l.first_name, l.last_name].filter(Boolean).join(' ') || `User #${l.user_id}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// ─── Main Component ──────────────────────────────────────────────────────────
const Audit = ({ activityLog }) => {
  const [search, setSearch]           = useState('');
  const [actionFilter, setActionFilter] = useState(null);
  const [userFilter, setUserFilter]   = useState(null);
  const [dateRange, setDateRange]     = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const actionTypes  = useMemo(() => getUniqueActionTypes(activityLog), [activityLog]);
  const uniqueUsers  = useMemo(() => getUniqueUsers(activityLog), [activityLog]);

  const filtered = useMemo(() => {
    return (activityLog || []).filter((log) => {
      if (search) {
        const s = search.toLowerCase();
        const name    = [log.first_name, log.last_name].filter(Boolean).join(' ').toLowerCase();
        const action  = (log.action_type || '').toLowerCase();
        const docId   = (log.document_id || '').toLowerCase();
        const details = JSON.stringify(log.details || '').toLowerCase();
        if (![name, action, docId, details].some(f => f.includes(s))) return false;
      }
      if (actionFilter && log.action_type !== actionFilter) return false;
      if (userFilter && String(log.user_id) !== String(userFilter)) return false;
      if (dateRange?.[0] && dateRange?.[1]) {
        const ts = dayjs(log.created_at);
        if (ts.isBefore(dateRange[0].startOf('day')) || ts.isAfter(dateRange[1].endOf('day'))) return false;
      }
      return true;
    });
  }, [activityLog, search, actionFilter, userFilter, dateRange]);

  const hasFilters = search || actionFilter || userFilter || dateRange;

  const todayCount = useMemo(() =>
    (activityLog || []).filter(l => l.created_at && dayjs(l.created_at).isAfter(dayjs().startOf('day'))).length,
    [activityLog]
  );

  const columns = [
    {
      title: <Space><ClockCircleOutlined />Time</Space>,
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: 'descend',
      render: (ts) => {
        if (!ts) return '—';
        const d = dayjs(ts);
        return (
          <Tooltip title={d.format('YYYY-MM-DD HH:mm:ss')}>
            <div style={{ lineHeight: 1.4 }}>
              <Text style={{ fontSize: 12 }}>{d.format('MMM D, YYYY')}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>{d.fromNow()}</Text>
            </div>
          </Tooltip>
        );
      },
      width: 130,
    },
    {
      title: <Space><UserOutlined />User</Space>,
      key: 'user',
      render: (_, r) => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ');
        return (
          <div style={{ lineHeight: 1.4 }}>
            <Text strong style={{ fontSize: 13 }}>{name || '—'}</Text>
            {r.ip_address && (
              <div><Text type="secondary" style={{ fontSize: 11 }}>{r.ip_address}</Text></div>
            )}
          </div>
        );
      },
      width: 140,
    },
    {
      title: 'Action',
      dataIndex: 'action_type',
      key: 'action_type',
      sorter: (a, b) => (a.action_type || '').localeCompare(b.action_type || ''),
      render: (action) => {
        const meta = getActionMeta(action);
        return (
          <Tag color={meta.color} icon={meta.icon} style={{ fontWeight: 600 }}>
            {meta.label}
          </Tag>
        );
      },
      width: 190,
    },
    {
      title: <Space><FileTextOutlined />Document</Space>,
      dataIndex: 'document_id',
      key: 'document_id',
      render: (docId) => docId
        ? <Tooltip title={docId}><Text copyable={{ text: docId }} style={{ fontSize: 12, fontFamily: 'monospace' }}>{docId.slice(0, 8)}…</Text></Tooltip>
        : <Text type="secondary">—</Text>,
      width: 120,
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => <DetailSummary details={record.details} actionType={record.action_type} />,
    },
    {
      title: '',
      key: 'expand',
      render: (_, record) => (
        <Tooltip title="View full details">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedRecord(record)}
          />
        </Tooltip>
      ),
      width: 40,
    },
  ];

  return (
    <>
      <Card
        bordered={false}
        title={
          <Space>
            <AuditOutlined />
            <span>Audit Trail</span>
            {todayCount > 0 && (
              <Badge count={todayCount} style={{ backgroundColor: '#52c41a' }} title={`${todayCount} actions today`} />
            )}
          </Space>
        }
      >
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search user, action, document, details…"
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} md={5}>
            <Select placeholder="Filter by action" value={actionFilter} onChange={setActionFilter} allowClear style={{ width: '100%' }}>
              {actionTypes.map(a => {
                const meta = getActionMeta(a);
                return (
                  <Option key={a} value={a}>
                    <Tag color={meta.color} icon={meta.icon} style={{ marginRight: 4 }}>{meta.label}</Tag>
                  </Option>
                );
              })}
            </Select>
          </Col>
          <Col xs={12} md={5}>
            <Select
              placeholder="Filter by user" value={userFilter} onChange={setUserFilter}
              allowClear style={{ width: '100%' }} showSearch
              filterOption={(input, option) => option?.children?.toLowerCase().includes(input.toLowerCase())}
            >
              {uniqueUsers.map(u => <Option key={u.id} value={String(u.id)}>{u.name}</Option>)}
            </Select>
          </Col>
          <Col xs={20} md={5}>
            <RangePicker value={dateRange} onChange={setDateRange} style={{ width: '100%' }} allowClear />
          </Col>
          <Col xs={4} md={1}>
            <Tooltip title="Clear filters">
              <Button icon={<ClearOutlined />} onClick={() => { setSearch(''); setActionFilter(null); setUserFilter(null); setDateRange(null); }} disabled={!hasFilters} style={{ width: '100%' }} />
            </Tooltip>
          </Col>
        </Row>

        {hasFilters && (
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Showing <Text strong>{filtered.length}</Text> of {(activityLog || []).length} records
            </Text>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={filtered.map((log, i) => ({ ...log, key: log.id || i }))}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ['15', '30', '50', '100'], showTotal: (t) => `Total ${t} audit entries` }}
          scroll={{ x: 800 }}
          size="small"
          locale={{ emptyText: 'No audit records found' }}
        />
      </Card>

      <DetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </>
  );
};

export default Audit;