// components/Header.jsx
import React from 'react';
import { 
  Layout, 
  Typography, 
  Input, 
  Badge, 
  Dropdown, 
  Avatar, 
  Button 
} from 'antd';
import { BellOutlined, UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';

const { Header } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;

const HeaderComponent = ({
  user,
  localTime,
  notifications,
  handleLogout,
  setActiveTab // Home থেকে setActiveTab প্রপ্স রিসিভ করা হলো
}) => {

  // Profile dropdown menu
  const userMenu = {
    items: [
      {
        key: 'profile',
        label: 'Profile',
        icon: <UserOutlined />,
        onClick: () => setActiveTab('profile'), // রাউট চেঞ্জ না করে স্টেট চেঞ্জ করবে
      },
      {
        key: 'settings',
        label: 'Settings',
        icon: <SettingOutlined />,
        onClick: () => setActiveTab('settings'), // সেটিংসের জন্যও সেম
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        label: 'Logout',
        icon: <LogoutOutlined />,
        onClick: handleLogout,
      },
    ]
  };

  // Notifications dropdown menu
  const notificationsMenu = {
    style: { width: 300 },
    items: [
      {
        key: 'title',
        label: 'Notifications',
        disabled: true,
        style: { fontWeight: 'bold', background: '#f0f0f0', color: '#333', cursor: 'default' },
      },
      ...((notifications && notifications.length > 0) ? (
        notifications.map(notification => ({
          key: notification.id,
          label: (
            <div style={{ display: 'flex', alignItems: 'flex-start', whiteSpace: 'normal' }}>
              <Badge status={notification.read ? "default" : "processing"} style={{ marginTop: 6, marginRight: 8 }} />
              <div>
                <div>{notification.message}</div>
                <div style={{ fontSize: '12px', color: '#999' }}>{notification.time}</div>
              </div>
            </div>
          ),
        }))
      ) : [
        {
          key: 'no-notif',
          label: 'No notifications',
          disabled: true,
        }
      ]),
      {
        type: 'divider',
      },
      {
        key: 'view-all',
        label: <a style={{ display: 'block', textAlign: 'center' }}>View All Notifications</a>,
      }
    ]
  };

  return (
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>CustomDocs</Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.65)', marginLeft: 16 }}>{localTime}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Search 
            placeholder="Search..." 
            allowClear
            style={{ width: 240, marginRight: 16 }}
            onSearch={value => console.log(value)}
          />
          <Dropdown menu={notificationsMenu} trigger={['click']} placement="bottomRight">
            <Badge count={notifications ? notifications.filter(n => !n.read).length : 0} overflowCount={99}>
              <Button type="text" icon={<BellOutlined style={{ color: 'white', fontSize: 20 }} />} style={{ marginRight: 8 }} />
            </Badge>
          </Dropdown>
          <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span style={{ marginLeft: 8, color: 'white' }}>{user?.email}</span>
            </div>
          </Dropdown>
        </div>
      </Header>
  );
};

export default HeaderComponent;