import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Layout({ children, userRole, userCampuses, breadcrumbs }) {
  const [isCampaignsExpanded, setIsCampaignsExpanded] = useState(true);
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      {/* Sidebar - extracted from OrgAdmin */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-collapse">
            <span className="collapse-icon">←</span>
            <span className="collapse-text">Collapse Menu</span>
          </div>
        </div>
        
        <div className="sidebar-menu">
          <div className="menu-item">
            <span className="menu-icon">📊</span>
            <span>Dashboard</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">💰</span>
            <span>Finance</span>
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">🔄</span>
            <span>Reconciliation</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">💼</span>
            <span>Funds</span>
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item-container">
            <div 
              className="menu-item active"
              onClick={() => setIsCampaignsExpanded(!isCampaignsExpanded)}
            >
              <span className="menu-icon">📢</span>
              <span>Campaigns</span>
            </div>
            {isCampaignsExpanded && (
              <div className="submenu">
                <div className="submenu-item active">
                  <span>Overview</span>
                  <span className="checkmark">✓</span>
                </div>
                <div className="submenu-item">
                  <span>Add a pledge</span>
                </div>
              </div>
            )}
          </div>
          <div className="menu-item">
            <span className="menu-icon">👥</span>
            <span>Community</span>
            <span className="link-icon">🔗</span>
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">📈</span>
            <span>App Analytics</span>
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">🌱</span>
            <span>Donor Development</span>
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">🔄</span>
            <span>Recurring</span>
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">🎁</span>
            <span>Gift Entry</span>
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">📋</span>
            <span>Giving Statements</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">📚</span>
            <span>Resource Center</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">⚙️</span>
            <span>Settings</span>
            <span className="warning-icon">⚠️</span>
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">💬</span>
            <span>Feedback</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Breadcrumb - dynamic based on props */}
        <div className="breadcrumb">
          <div className="breadcrumb-left">
            {breadcrumbs ? (
              breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  {crumb.link ? (
                    <span 
                      className="breadcrumb-link" 
                      onClick={() => navigate(crumb.link)}
                      style={{cursor: 'pointer'}}
                    >
                      {crumb.text}
                    </span>
                  ) : (
                    <span>{crumb.text}</span>
                  )}
                  {index < breadcrumbs.length - 1 && (
                    <span className="breadcrumb-separator">›</span>
                  )}
                </React.Fragment>
              ))
            ) : (
              <>
                <span className="breadcrumb-link">Campaigns</span>
                <span className="breadcrumb-separator">›</span>
                <span>Overview</span>
              </>
            )}
          </div>
          
          {/* User Role Indicator */}
          <div className="user-indicator">
            <span className="user-role-name">
              {userRole === 'org-admin' ? 'Org Admin' : 
               userRole === 'single-campus' ? 'Single Campus Admin' : 
               userRole === 'multi-campus' ? 'Multi Campus Admin' : 'User'}
            </span>
            <div className="user-icon">👤</div>
          </div>
        </div>

        {/* Page Content */}
        <div className="dashboard">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Layout;