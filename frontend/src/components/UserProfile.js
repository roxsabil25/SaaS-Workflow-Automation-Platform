import React, { useState, useEffect } from 'react';
import { Card, Tabs, Form, Input, Button, Upload, Avatar, message, Row, Col, Typography, Tag, Divider, Timeline } from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  UploadOutlined, 
  SafetyCertificateOutlined, 
  HistoryOutlined,
  ApartmentOutlined,
  GlobalOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
const BACKEND_URL = 'http://localhost:5000'; // Express backend URL and port

const { Title, Text } = Typography;

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false); // State for avatar upload progress
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  // Fetch user data separately so it can be reloaded after an image upload
  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      
      form.setFieldsValue({
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        email: response.data.email,
        orgId: response.data.orgId,
        role: response.data.role,
        department: response.data.department || 'Not Assigned',
        site: response.data.site || 'N/A',
        template_approver: response.data.template_approver ? 'Yes' : 'No',
        status: response.data.status || 'active'
      });
    } catch (error) {
      message.error('There was a problem loading the profile data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  // Avatar upload handler
  const handleAvatarUpload = async (file) => {
    // Only allow image files
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
      message.error('Only JPG/PNG files are allowed.');
      return false;
    }
    // Size limit: 2MB
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('The image must be smaller than 2MB.');
      return false;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('avatar', file); // Send the file under the 'avatar' field

      // Backend avatar upload endpoint
      await axios.post('/api/users/upload-avatar', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      message.success('Profile image updated successfully.');
      fetchUserData(); // Reload profile data to reflect the new image URL
    } catch (error) {
      message.error(error.response?.data?.error || 'There was a problem uploading the image.');
    } finally {
      setUploading(false);
    }
    return false; // Prevent Ant Design's default upload behavior
  };

const handleInfoUpdate = async (values) => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('accessToken');
      await axios.put('/api/users/update-profile', {
        firstName: values.firstName,
        lastName: values.lastName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('Profile updated successfully.');
      fetchUserData(); // Reload the profile data so the card text updates after the name is changed.
    } catch (error) {
      message.error(error.response?.data?.error || 'Update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  
const handlePasswordChange = async (values) => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('accessToken');

      await axios.put('/api/users/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      message.success('Password changed successfully. Please log in again.');
      passwordForm.resetFields();

      // Remove the access token from local storage
      localStorage.removeItem('accessToken');
      
      // Remove any stored refresh token or other auth data if present:
      // localStorage.removeItem('refreshToken');

      // Redirect to the login page after 1.5 seconds so the user can see the success message
      setTimeout(() => {
        window.location.href = '/login'; // Update this route if your login page path differs
      }, 1500);

    } catch (error) {
      message.error(error.response?.data?.error || 'Password could not be changed.');
    } finally {
      setSubmitting(false);
    }
  };



  const getAvatarSrc = (avatarValue) => {
    if (!avatarValue) return undefined;
    if (avatarValue.startsWith('http://') || avatarValue.startsWith('https://')) {
      return avatarValue;
    }
    return `${BACKEND_URL}${avatarValue.startsWith('/') ? avatarValue : `/${avatarValue}`}`;
  };

  if (loading) return <Card loading={true} style={{ margin: '24px' }} />;

  const tabItems = [
    {
      key: '1',
      label: <span><UserOutlined />Account Details</span>,
      children: (
        <Form form={form} layout="vertical" onFinish={handleInfoUpdate} style={{ marginTop: '16px' }}>
          <Title level={5} style={{ marginBottom: 16 }}>Personal Information</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="firstName" label="First Name" rules={[{ required: true, message: 'Please enter your first name.' }]}>
                <Input prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lastName" label="Last Name" rules={[{ required: true, message: 'Please enter your last name.' }]}>
                <Input prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="email" label="Email Address">
            <Input prefix={<UserOutlined />} disabled style={{ backgroundColor: '#f5f5f5', color: '#555' }} />
          </Form.Item>

          <Divider />
          <Title level={5} style={{ marginBottom: 16 }}>Organization & Role Details (Read-Only)</Title>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="orgId" label="Organization ID">
                <Input prefix={<ApartmentOutlined />} disabled style={{ backgroundColor: '#f5f5f5' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role" label="System Role">
                <Input prefix={<UserOutlined />} disabled style={{ backgroundColor: '#f5f5f5' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="department" label="Department">
                <Input prefix={<ApartmentOutlined />} disabled style={{ backgroundColor: '#f5f5f5' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="site" label="Assigned Site">
                <Input prefix={<GlobalOutlined />} disabled style={{ backgroundColor: '#f5f5f5' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="template_approver" label="Template Approver Privilege">
                <Input prefix={<CheckCircleOutlined />} disabled style={{ backgroundColor: '#f5f5f5' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Account Status">
                <Input prefix={<CheckCircleOutlined />} disabled style={{ backgroundColor: '#f5f5f5', color: 'green', fontWeight: 'bold' }} />
              </Form.Item>
            </Col>
          </Row>

          <Button type="primary" htmlType="submit" loading={submitting} style={{ marginTop: '8px' }}>
            Save Changes
          </Button>
        </Form>
      )
    },
    {
      key: '2',
      label: <span><SafetyCertificateOutlined />Security Settings</span>,
      children: (
        <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange} style={{ marginTop: '16px' }}>
          <Form.Item name="currentPassword" label="Current Password" rules={[{ required: true, message: 'Please enter your current password.' }]}>
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item name="newPassword" label="New Password" rules={[{ required: true, min: 8, message: 'Please enter a password with at least 8 characters.' }]}>
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item name="confirmPassword" label="Confirm New Password" dependencies={['newPassword']} rules={[
            { required: true, message: 'Please confirm your password.' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('The two passwords do not match.'));
              },
            }),
          ]}>
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Button type="primary" danger htmlType="submit" loading={submitting}>Update Password</Button>
        </Form>
      )
    },
    {
      key: '3',
      label: <span><HistoryOutlined />Login Activity</span>,
      children: (
        <div style={{ marginTop: '16px' }}>
          <Text type="secondary">Your recent login and session metadata logs.</Text>
          <Divider />
          <Timeline items={[
            {
              color: 'green',
              children: (
                <>
                  <p><b>Logged in successfully</b> - IP: 127.0.0.1 (Current Session)</p>
                  <p><Text type="secondary">Just now</Text></p>
                </>
              )
            },
            {
              children: (
                <>
                  <p>Token Refreshed - Session Extended</p>
                  <p><Text type="secondary">10 minutes ago</Text></p>
                </>
              )
            }
          ]} />
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <Row gutter={[24, 24]}>
        {/* Left Side Profile Card */}
        <Col xs={24} md={8}>
          <Card style={{ textAlign: 'center', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Avatar 
  size={100} 
  icon={<UserOutlined />} 
  src={getAvatarSrc(user?.avatar_url || user?.avatarUrl || user?.avatar)}
  style={{ marginBottom: '16px', backgroundColor: '#1890ff' }} 
/>
            <Title level={4} style={{ margin: 0 }}>{`${user?.firstName} ${user?.lastName}`}</Title>
            <Text type="secondary" block style={{ marginBottom: '12px' }}>{user?.email}</Text>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <Tag color="blue">{user?.role?.toUpperCase()}</Tag>
              <Tag color="purple">Org ID: {user?.orgId}</Tag>
              <Tag color={user?.status === 'active' ? 'green' : 'red'}>{user?.status?.toUpperCase()}</Tag>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {user?.department && <Tag color="cyan">{user.department}</Tag>}
              {user?.site && <Tag color="geekblue">Site: {user.site}</Tag>}
              {user?.template_approver && <Tag color="gold">Approver</Tag>}
            </div>

            <Divider />
            
            {/* Upload component */}
            <Upload 
              maxCount={1} 
              showUploadList={false} 
              beforeUpload={handleAvatarUpload} // Trigger the new avatar upload handler here
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                {uploading ? 'Uploading...' : 'Change Avatar'}
              </Button>
            </Upload>
          </Card>
        </Col>

        {/* Right Side Settings & Tabs */}
        <Col xs={24} md={16}>
          <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Tabs defaultActiveKey="1" items={tabItems} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default UserProfile;