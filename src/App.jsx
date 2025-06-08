import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './App.css'
import CreateCampaign from './CreateCampaign';
import AssignCampuses from './AssignCampuses';
import { fetchCampaigns } from './airtable';


// Role Selection Component
function RoleSelection({ setUserRole, setUserCampuses }) {
  const navigate = useNavigate()

  const handleUserTypeSelect = (userType) => {
    // Store the selected role
    setUserRole(userType);
    
    // Hardcode campus assignments for prototype
    let campuses = [];
    if (userType === 'single-campus') {
      // Single Campus Admin manages All Saints Downtown
      campuses = ['recusI88Dphjsw6Im'];
    } else if (userType === 'multi-campus') {
      // Multi Campus Admin manages All Saints North, Grace Community, Hope Chapel
      campuses = ['recNFIxsiUGI0QoIQ', 'recEUc2GcIfGP37ui', 'reckRhX1AxWoRQfYe'];
    } else {
      // Org Admin sees everything
      campuses = [];
    }
    
    setUserCampuses(campuses);
    
    // Save to localStorage
    localStorage.setItem('userRole', userType);
    localStorage.setItem('userCampuses', JSON.stringify(campuses));
    console.log('Saved to localStorage:', userType, campuses);
    
    navigate(`/${userType}`)
  }

  return (
    <div className="app">
      <div className="user-selection-container">
        <div className="header">
          <h1>Select Your Role</h1>
          <p>Choose how you'll be using the campaigns platform</p>
        </div>
        
        <div className="user-type-cards">
          <div 
            className="user-card"
            onClick={() => handleUserTypeSelect('org-admin')}
          >
            <div className="card-icon">🏢</div>
            <h3>Org Admin</h3>
            <p>Create and manage organization-wide campaigns</p>
          </div>

          <div 
            className="user-card"
            onClick={() => handleUserTypeSelect('single-campus')}
          >
            <div className="card-icon">🏛️</div>
            <h3>Single Campus Admin</h3>
            <p>Manage campaigns for your individual campus</p>
          </div>

          <div 
            className="user-card"
            onClick={() => handleUserTypeSelect('multi-campus')}
          >
            <div className="card-icon">🏬</div>
            <h3>Multi Campus Admin</h3>
            <p>Oversee campaigns across multiple campuses</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Org Admin Dashboard
function OrgAdmin({ userRole, userCampuses }) {
  // Debug info - we'll remove this later
  console.log('OrgAdmin - User Role:', userRole);
  console.log('OrgAdmin - User Campuses:', userCampuses);

  const [isCampaignsExpanded, setIsCampaignsExpanded] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        setLoadingCampaigns(true);
        const campaignData = await fetchCampaigns();
        
        // Filter campaigns based on user role
        let filteredCampaigns;
        
        if (userRole === 'org-admin') {
          // Org admin sees all campaigns
          filteredCampaigns = campaignData;
        } else if (userRole === 'single-campus' || userRole === 'multi-campus') {
          // Campus admins only see campaigns assigned to their campuses
          filteredCampaigns = campaignData.filter(campaign => {
            // Check if any of the user's campuses are in the campaign's AssignedCampuses
            return campaign.assignedCampuses && 
                   campaign.assignedCampuses.some(campusId => userCampuses.includes(campusId));
          });
        } else {
          // No role selected, show all campaigns
          filteredCampaigns = campaignData;
        }
        
        console.log('Filtered campaigns for role:', userRole, filteredCampaigns);
        setCampaigns(filteredCampaigns);
        
      } catch (error) {
        console.error('Failed to load campaigns:', error);
      } finally {
        setLoadingCampaigns(false);
      }
    };
    
    loadCampaigns();
  }, [userRole, userCampuses]); // Added dependencies so it re-filters when role changes

  return (
    <div className="app-layout">
      {/* Sidebar */}
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
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <div className="breadcrumb-left">
            <span className="breadcrumb-link">Campaigns</span>
            <span className="breadcrumb-separator">›</span>
            <span>Overview</span>
          </div>
          
          {/* User Role Indicator moved to breadcrumb level */}
          <div className="user-indicator">
            <span className="user-role-name">
              {userRole === 'org-admin' ? 'Org Admin' : 
              userRole === 'single-campus' ? 'Single Campus Admin' : 
              userRole === 'multi-campus' ? 'Multi Campus Admin' : 'User'}
            </span>
            <div className="user-icon">👤</div>
          </div>
        </div>

        {/* Dashboard */}
        <div className="dashboard">
        <div className="dashboard-header">
          <h1>Campaigns</h1>
          <div className="header-actions">
            <select className="campus-filter">
              <option>Campus</option>
              <option>All</option>
            </select>
            <button 
              className="create-btn"
              onClick={() => navigate('/create-campaign')}
            >
              Create campaign
            </button>
            
            </div>
        </div>

          <div className="campaign-tabs">
            <button className="tab active">Published</button>
            <button className="tab">Draft</button>
            <button className="tab">Closed</button>
          </div>

          <div className="search-section">
            <div className="search-container">
              <span className="search-label">Find campaign</span>
              <input 
                type="text" 
                placeholder="Search" 
                className="search-input"
              />
              <button className="search-btn">🔍</button>
              <div className="campaign-type-dropdown">
                <select className="campaign-type-select">
                  <option value="" disabled selected>Campaign type</option>
                  <option value="all">All campaigns</option>
                  <option value="campus">Campus</option>
                  <option value="organization">Organization</option>
                </select>
              </div>
            </div>
            <button className="sort-btn">⚙️</button>
          </div>

          <div className="campaigns-list">
  {loadingCampaigns ? (
    <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
      Loading campaigns...
    </div>
  ) : campaigns.length === 0 ? (
    <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
      No campaigns found. <span 
        onClick={() => navigate('/create-campaign')}
        style={{ color: '#10b981', cursor: 'pointer', textDecoration: 'underline' }}
      >
        Create your first campaign
      </span>
    </div>
  ) : (
    campaigns.map((campaign) => (
      <div key={campaign.id} className="campaign-card">
        <div className="campaign-header">
          <div className="campaign-title">
            <h3>{campaign.name}</h3>
            <span className="org-badge">
                              {campaign.scope === 'Org' ? 'Org campaign' : 'Campus campaign'}
                          </span>
              <span className={`status-badge ${
                campaign.startDate && new Date() >= new Date(campaign.startDate) ? 'live' : 'scheduled'
              }`}>
                {campaign.startDate && new Date() >= new Date(campaign.startDate) ? 'Live' : 'Scheduled'}
              </span>
              <span className={`status-badge ${campaign.status?.toLowerCase() || 'draft'}`}>
                {campaign.status || 'Draft'}
              </span>
            <span className={`status-badge ${campaign.status?.toLowerCase() || 'draft'}`}>
              {campaign.status || 'Draft'}
            </span>
          </div>
          <div className="menu-container">
            <button 
              className="menu-dots"
              onClick={() => setOpenDropdown(openDropdown === campaign.id ? null : campaign.id)}
            >
              ⋯
            </button>
            {openDropdown === campaign.id && (
              <div className="dropdown-menu">
                <div className="dropdown-item">
                  <span className="dropdown-icon">↗</span>
                  View Details
                </div>
                <div className="dropdown-item">
                  <span className="dropdown-icon">✏</span>
                  Edit Campaign
                </div>
                <div className="dropdown-item">
                  <span className="dropdown-icon">📋</span>
                  Duplicate
                </div>
                <div className="dropdown-item">
                  <span className="dropdown-icon">✕</span>
                  Close
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="campaign-stats">
          <div className="stat">
            <span className="label">Raised</span>
            <span className="value">${campaign.raised?.toLocaleString() || '0'}</span>
          </div>
          <div className="stat">
            <span className="label">Pledged</span>
            <span className="value">${campaign.pledged?.toLocaleString() || '0'}</span>
          </div>
          <div className="stat">
            <span className="label">Goal</span>
            <span className="value">${campaign.financialGoal?.toLocaleString() || '0'}</span>
          </div>
        </div>
        
        <div className="progress-section">
          <div className="progress-bar">
            <div 
              className="progress" 
              style={{
                width: campaign.financialGoal > 0 
                  ? `${Math.min((campaign.raised / campaign.financialGoal) * 100, 100)}%`
                  : '0%'
              }}
            ></div>
          </div>
          <span className="progress-text">
            {campaign.financialGoal > 0 
              ? `${Math.round((campaign.raised / campaign.financialGoal) * 100)}%`
              : '0%'
            }
          </span>
        </div>
        
        <div className="campaign-footer">
          <span className="campaign-dates">
            {campaign.startDate && campaign.endDate 
              ? `${new Date(campaign.startDate).toLocaleDateString()} - ${new Date(campaign.endDate).toLocaleDateString()}`
              : 'Dates not set'
            }
          </span>
          <div className="campaign-actions">
            <button className="action-btn">🔗 Add pledge</button>
            <button className="action-btn">📤 Share</button>
          </div>
        </div>
      </div>
    ))
  )}
</div>
        </div>
      </div>
    </div>
  )
}

// Placeholder components for other roles
function SingleCampus({ userRole, userCampuses }) {
  // Debug info - we'll remove this later
  console.log('SingleCampus - User Role:', userRole);
  console.log('SingleCampus - User Campuses:', userCampuses);

  return <div>Single Campus Dashboard - Coming Soon!</div>
}

function MultiCampus() {
  return <div>Multi Campus Dashboard - Coming Soon!</div>
}

// Main App with routing
function App() {
  const [userRole, setUserRole] = useState(null);
  const [userCampuses, setUserCampuses] = useState([]); // For campus admins

  // Load role from localStorage on app start
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    const savedCampuses = localStorage.getItem('userCampuses');
    
    if (savedRole) {
      console.log('Loading from localStorage:', savedRole, savedCampuses);
      setUserRole(savedRole);
      
      if (savedCampuses) {
        try {
          setUserCampuses(JSON.parse(savedCampuses));
        } catch (error) {
          console.error('Error parsing saved campuses:', error);
          setUserCampuses([]);
        }
      }
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RoleSelection setUserRole={setUserRole} setUserCampuses={setUserCampuses} />} />
        <Route path="/org-admin" element={<OrgAdmin userRole={userRole} userCampuses={userCampuses} />} />
        <Route path="/single-campus" element={<OrgAdmin userRole={userRole} userCampuses={userCampuses} />} />
        <Route path="/multi-campus" element={<OrgAdmin userRole={userRole} userCampuses={userCampuses} />} />
        <Route path="/create-campaign" element={<CreateCampaign />} />
        <Route path="/assign-campuses" element={<AssignCampuses />} />
      </Routes>
    </Router>
  )
}

export default App