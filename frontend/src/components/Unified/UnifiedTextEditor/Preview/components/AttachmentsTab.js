import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Upload, Button, Card, Table, Space, Tag, Modal, 
  message, Tooltip, Alert, Progress 
} from 'antd';
import { confirmAlert, successAlert, errorAlert } from '../../../../../utils/alerts';
import { 
  PaperClipOutlined, InboxOutlined, DeleteOutlined, 
  DownloadOutlined, EyeOutlined, FilePdfOutlined, 
  FileWordOutlined, FileExcelOutlined, FileImageOutlined, 
  FileOutlined, LoadingOutlined, ExclamationCircleOutlined 
} from '@ant-design/icons';
import moment from 'moment';
import './AttachmentsTab.css';

const { Dragger } = Upload;

const AttachmentsTab = ({ 
  associationType, 
  associationId, 
  templateId, // Optional template ID to inherit attachments from
  canEdit = false,
  onAttachmentsChange,
  status = 'draft' // New prop to handle conditional delete based on status
}) => {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch attachments
  const fetchAttachments = useCallback(async () => {
    // Check if associationId is actually a valid ID (not null/undefined strings)
    const hasValidId = associationId && associationId !== 'null' && associationId !== 'undefined';
    
    if (!hasValidId) {
      // In creation mode, we don't fetch from server, we rely on local state or parent state
      return;
    }

    setLoading(true);
    try {
      let docAttachments = [];
      let inheritedAttachments = [];

      // 1. Fetch direct attachments
      const response = await axios.get(`/api/attachments/${associationType}/${associationId}`);
      docAttachments = response.data || [];

      // 2. Fetch inherited template attachments if templateId is provided
      if (templateId && templateId !== 'null' && templateId !== 'undefined') {
        const response = await axios.get(`/api/attachments/template/${templateId}`);
        inheritedAttachments = response.data || [];
      }

      // 3. Combine lists. Mark template attachments as inherited (read-only)
      const combined = [
        ...inheritedAttachments.map(a => ({ ...a, isInherited: true })),
        ...docAttachments
      ];

      setAttachments(combined);

      // Notify parent ONLY of the document's own uploaded attachments
      if (onAttachmentsChange) {
        onAttachmentsChange(docAttachments);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
      message.error('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [associationType, associationId, templateId, onAttachmentsChange]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Helper to get matching file-type icons
  const getFileIcon = (fileType) => {
    const type = String(fileType || '').toLowerCase();
    if (type.includes('pdf')) {
      return <FilePdfOutlined className="file-icon pdf-color" />;
    } else if (type.includes('word') || type.includes('officedocument.wordprocessing')) {
      return <FileWordOutlined className="file-icon docx-color" />;
    } else if (type.includes('excel') || type.includes('spreadsheet') || type.includes('officedocument.spreadsheetml')) {
      return <FileExcelOutlined className="file-icon excel-color" />;
    } else if (type.includes('image/')) {
      return <FileImageOutlined className="file-icon image-color" />;
    }
    return <FileOutlined className="file-icon default-color" />;
  };

  // Convert file size to human-readable string
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle file upload
  const handleUpload = async (file) => {
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('association_type', associationType);
      formData.append('association_id', associationId || '');

      setUploadProgress(30);

      const response = await axios.post('/api/attachments/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          // Scale upload progress from 30% to 95% on progress bar
          setUploadProgress(Math.min(95, 30 + Math.round(percentCompleted * 0.65)));
        }
      });

      if (response.data.success) {
        setUploadProgress(100);
        message.success(`${file.name} uploaded successfully.`);

        // If associationId is falsy (creating a template or document), add it to tempAttachments state
        if (!associationId) {
          setAttachments(prev => {
            const next = [...prev, response.data.attachment];
            if (onAttachmentsChange) {
              onAttachmentsChange(next);
            }
            return next;
          });
        } else {
          // If associationId exists, refetch all attachments mapped to it
          fetchAttachments();
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      message.error(`Failed to upload ${file.name}`);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 300);
    }
    return false; // Prevent Ant Design dragger from auto-uploading
  };

  // Handle attachment deletion
  const handleDelete = (attachment) => {
    console.log('🗑️ Attempting to delete attachment:', attachment);
    
    if (!attachment || !attachment.id) {
      console.error('❌ Missing attachment ID');
      errorAlert('Cannot delete', 'Invalid attachment ID');
      return;
    }

    confirmAlert(
      'Are you sure?',
      `Delete ${attachment.file_name}? This action cannot be undone.`,
      'Yes, Delete',
      'Cancel'
    ).then(async (result) => {
      if (result.isConfirmed) {
        console.log('✅ Deletion confirmed for ID:', attachment.id);
        try {
          const response = await axios.delete(`/api/attachments/${attachment.id}`);
          if (response.data.success) {
            successAlert('Deleted!', 'Attachment deleted successfully');
            
            const isTemporary = !associationId || associationId === 'null' || associationId === 'undefined';
            
            // If in draft creation mode or temporary state, update local state
            if (isTemporary) {
              console.log('🔄 Updating local state for temporary attachment');
              setAttachments(prev => {
                const next = prev.filter(a => a.id !== attachment.id);
                if (onAttachmentsChange) {
                  onAttachmentsChange(next);
                }
                return next;
              });
            } else {
              console.log('🔄 Refetching attachments from server');
              fetchAttachments();
            }
          }
        } catch (error) {
          console.error('❌ Delete failed:', error);
          errorAlert('Delete Failed', 'Failed to delete attachment');
        }
      } else {
        console.log('🚫 Deletion cancelled');
      }
    });
  };

  // Open/View inline in new tab
  const handleView = (attachment) => {
    openSecurely(attachment, 'inline');
  };

  const handleDownloadSecurely = (attachment) => {
    openSecurely(attachment, 'attachment');
  };

  const openSecurely = async (attachment, mode = 'inline') => {
    try {
      const response = await axios.get(
        `/api/attachments/${mode === 'inline' ? 'view' : 'download'}/${attachment.id}`, 
        { responseType: 'blob' }
      );
      
      let blob = response.data;
      if (!(blob instanceof Blob)) {
        blob = new Blob([response.data], { type: attachment.file_type || 'application/octet-stream' });
      }
      const url = window.URL.createObjectURL(blob);
      
      if (mode === 'inline') {
        window.open(url, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', attachment.file_name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      // Clean up object URL later
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Failed to open file securely:', err);
      message.error('Failed to fetch file content');
    }
  };

  // Ant Design Table Columns
  const columns = [
    {
      title: 'No.',
      key: 'index',
      width: 70,
      align: 'center',
      render: (text, record, index) => {
        // Calculate global index across all attachments
        const globalIndex = attachments.findIndex(a => a.id === record.id);
        return <span className="attachment-index-number">{globalIndex + 1}</span>;
      }
    },
    {
      title: 'File',
      key: 'file',
      render: (_, record) => (
        <Space size="middle">
          {getFileIcon(record.file_type)}
          <div>
            <div className="file-name">{record.file_name}</div>
            <div className="file-meta-sub">
              {formatSize(record.file_size)} • {(record.file_type && record.file_type.includes('/') ? record.file_type.split('/')[1].toUpperCase() : (record.file_type || 'UNKNOWN').toUpperCase())}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Uploaded By',
      dataIndex: 'uploaded_by_name',
      key: 'uploaded_by',
      render: (text, record) => (
        <Space size="small">
          <Tag color="blue">{text || 'System User'}</Tag>
          {record.isInherited && <Tag color="gold">Template Inherited</Tag>}
        </Space>
      )
    },
    {
      title: 'Upload Date',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      render: (_, record) => {
        // Only show delete if in draft, pending_revision, or temporary state
        // and if it's not an inherited attachment
        const isTemporary = !associationId || associationId === 'null' || associationId === 'undefined';
        const canDelete = canEdit && !record.isInherited && (
          ['draft', 'pending_revision', 'temp'].includes(status) || 
          isTemporary
        );

        return (
          <Space size="small">
            <Tooltip title="Download File">
              <Button 
                type="text" 
                icon={<DownloadOutlined />} 
                onClick={(e) => {
                   console.log('🔵 Download button clicked!');
                   e.preventDefault();
                   e.stopPropagation();
                   handleDownloadSecurely(record);
                 }} 
              />
            </Tooltip>
            {canDelete && (
              <Tooltip title="Delete File">
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  onClick={(e) => {
                    console.log('🔴 Delete button clicked!');
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(record);
                  }} 
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card bordered={false} className="attachments-card">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {canEdit && (
          <div className="upload-container">
            <Dragger
              name="file"
              multiple={false}
              beforeUpload={handleUpload}
              showUploadList={false}
              disabled={isUploading}
              className="attachments-dragger"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined className="upload-icon-anim" />
              </p>
              <p className="ant-upload-text font-weight-bold">
                Upload PDF, Documents, or Images
              </p>
              <p className="ant-upload-hint">
                Drag and drop files here, or <span className="browse-link">click to browse files</span>
              </p>
            </Dragger>
            
            {isUploading && (
              <div className="upload-progress-overlay">
                <LoadingOutlined className="loading-spinner" />
                <Progress percent={uploadProgress} size="small" status="active" style={{ width: 200, marginTop: 8 }} />
                <div className="progress-text">Uploading to Server...</div>
              </div>
            )}
          </div>
        )}

        <Table 
          columns={columns} 
          dataSource={attachments} 
          rowKey="id"
          loading={loading}
          locale={{ emptyText: 'No attachments found' }}
          pagination={{ pageSize: 5 }}
          className="attachments-table"
        />
      </Space>
    </Card>
  );
};

export default AttachmentsTab;
