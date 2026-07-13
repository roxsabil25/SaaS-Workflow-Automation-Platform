import React from 'react';
import { Layout, Menu, Button, Typography } from 'antd';
import {
  StarOutlined,
  HistoryOutlined,
  DatabaseOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined
} from '@ant-design/icons';

const { Sider } = Layout;
const { SubMenu } = Menu;
const { Text } = Typography;

const Sidebar = ({
  collapsed,
  setCollapsed,
  activeTab,
  setActiveTab,
  menuItems,
  user,
  handleCreateDocument,
  showJoinDocModal
}) => {
  // Function to check if user has access to a menu item
  const hasAccess = (item) => {
    const userRole = user?.role?.toLowerCase();
    const isTemplateApprover = user?.template_approver === 'yes';
    
    // Admin-only access
    if (item.adminOnly && userRole !== 'admin') {
      return false;
    }
    
    // Author-only access
    if (item.authorOnly && userRole !== 'author') {
      return false;
    }
    
    // Project Manager-only access
    if (item.pmOnly && userRole !== 'project manager') {
      return false;
    }
    
    // Admin or Author access
    if (item.adminAuthorOnly && !['admin', 'author'].includes(userRole)) {
      return false;
    }
    
    // Admin or Project Manager access
    if (item.adminPmOnly && !['admin', 'project manager'].includes(userRole)) {
      return false;
    }
    
    // Template Approver access - any role can be a template approver
    if (item.tempApprover && !isTemplateApprover) {
      return false;
    }
    
    // Coordinator, People Manager, Approver/Reviewer, Viewer have access to non-restricted items
    // These roles can access items that don't have specific role restrictions
    
    // Exclude Member access
    if (item.excludeMember && userRole === 'member') {
      return false;
    }

    return true;
  };

  // Function to render menu items
  const renderMenuItems = (items) => {
    return items.map(item => {
      // Check if user has permission to see this item
      if (!hasAccess(item)) {
        return null;
      }
      
      // If the item has children, render as SubMenu
      if (item.children) {
        // Filter children based on access
        const accessibleChildren = item.children.filter(child => hasAccess(child));
        
        // Don't render the submenu if no children are accessible
        if (accessibleChildren.length === 0) {
          return null;
        }
        
        return (
          <SubMenu 
            key={item.key} 
            icon={item.icon} 
            title={item.label}
          >
            {accessibleChildren.map(child => (
              <Menu.Item key={child.key} icon={child.icon} style={child.style}>
                {child.label}
              </Menu.Item>
            ))}
          </SubMenu>
        );
      } else {
        // Otherwise render as Menu.Item
        return (
          <Menu.Item key={item.key} icon={item.icon}>
            {item.label}
          </Menu.Item>
        );
      }
    }).filter(Boolean); // Remove null items
  };

  // Custom trigger for collapsing sidebar with menu icon
  const CustomTrigger = () => (
    <Button
      type="text"
      icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      onClick={() => setCollapsed(!collapsed)}
      style={{ 
        fontSize: '16px',
        width: '100%',
        height: '48px',
        marginBottom: '16px',
        borderRadius: 0,
        borderBottom: '1px solid #f0f0f0'
      }}
    />
  );

  return (
    <Sider 
      collapsible 
      collapsed={collapsed} 
      onCollapse={setCollapsed}
      width={250}
      theme="light"
      style={{ 
        background: '#fff',
        boxShadow: '2px 0 8px 0 rgba(29,35,41,0.05)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'auto',
        alignSelf: 'flex-start',
        zIndex: 100
      }}
      trigger={null} // Hide default trigger
    >
      <CustomTrigger />
      <Menu
        mode="inline"
        selectedKeys={[activeTab]}
        onClick={({ key }) => setActiveTab(key)}
        style={{ borderRight: 0 }}
      >
        {renderMenuItems(menuItems)}
      </Menu>
      {!collapsed && (
        <div style={{ padding: '16px' }}>
          <Text strong>Quick Access</Text>
          <Menu mode="inline" style={{ border: 'none' }}>
            <Menu.Item key="favorites" icon={<StarOutlined />}>Favorites</Menu.Item>
            <Menu.Item key="recent" icon={<HistoryOutlined />}>Recently Viewed</Menu.Item>
            <Menu.Item key="depository" icon={<DatabaseOutlined />}>Document Depository</Menu.Item>
          </Menu>
        </div>
      )}
    </Sider>
  );
};

export default Sidebar;
