import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './App.css'
import CreateCampaign from './CreateCampaign';
import AssignCampuses from './AssignCampuses';
import { fetchCampaigns } from './airtable';
import CampaignDetail from './CampaignDetail';


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
    
    console.log('Setting user campuses for role:', userType, campuses);
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
function OrgAdmin({ userRole, userCampuses, onRoleSwitch }) {
  // Debug info - we'll remove this later
  console.log('OrgAdmin - User Role:', userRole);
  console.log('OrgAdmin - User Campuses:', userCampuses);

  const [isCampaignsExpanded, setIsCampaignsExpanded] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  
  // NEW: Search functionality state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaignType, setSelectedCampaignType] = useState('all');
  
  // NEW: Campus filter state
  const [selectedCampusFilter, setSelectedCampusFilter] = useState('all');
  const [availableCampuses, setAvailableCampuses] = useState([]);
  const [loadingCampuses, setLoadingCampuses] = useState(true);
  
  // NEW: Status filter state
  const [selectedStatus, setSelectedStatus] = useState('Published');
  
  // NEW: User role switcher state
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  // NEW: Close campaign modal state
const [showCloseModal, setShowCloseModal] = useState(false);
const [campaignToClose, setCampaignToClose] = useState(null);

  useEffect(() => {
    const loadCampaignsAndCampuses = async () => {
      try {
        setLoadingCampaigns(true);
        setLoadingCampuses(true);
        
        // Import fetchCampuses function
        const { fetchCampuses } = await import('./airtable');
        
        // Fetch both campaigns and campuses in parallel
        const [campaignData, campusData] = await Promise.all([
          fetchCampaigns(),
          fetchCampuses()
        ]);
        
        // Set up available campuses based on user role
        let userAccessibleCampuses = [];
        
        if (userRole === 'org-admin') {
          // Org admin sees all campuses
          userAccessibleCampuses = campusData;
        } else if (userRole === 'single-campus' || userRole === 'multi-campus') {
          // Campus admins only see their assigned campuses
          userAccessibleCampuses = campusData.filter(campus => 
            userCampuses.includes(campus.id)
          );
        } else {
          // No role selected, show all campuses
          userAccessibleCampuses = campusData;
        }
        
        setAvailableCampuses(userAccessibleCampuses);
        
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
        console.log('Available campuses for user:', userRole, userAccessibleCampuses);
        setCampaigns(filteredCampaigns);
        
      } catch (error) {
        console.error('Failed to load campaigns and campuses:', error);
      } finally {
        setLoadingCampaigns(false);
        setLoadingCampuses(false);
      }
    };
    
    loadCampaignsAndCampuses();
  }, [userRole, userCampuses]); // Added dependencies so it re-filters when role changes

  // NEW: Filter campaigns based on status, campus filter, campaign type, and search query (in that hierarchy)
  const getFilteredCampaigns = () => {
    let filtered = campaigns;

    // 1. FIRST: Filter by status (tab selection)
    filtered = filtered.filter(campaign => {
      const campaignStatus = campaign.status || 'Draft'; // Default to Draft if no status
      return campaignStatus === selectedStatus;
    });

    // 2. SECOND: Filter by campus (page-level filter)
    if (selectedCampusFilter !== 'all') {
      filtered = filtered.filter(campaign => {
        // Check if the selected campus is in the campaign's AssignedCampuses
        return campaign.assignedCampuses && 
               campaign.assignedCampuses.includes(selectedCampusFilter);
      });
    }

    // 3. THIRD: Filter by campaign type based on Scope field from Airtable
    if (selectedCampaignType !== 'all') {
      filtered = filtered.filter(campaign => {
        if (selectedCampaignType === 'organization') {
          // Show campaigns where Scope = "Org"
          return campaign.scope === 'Org';
        } else if (selectedCampaignType === 'campus') {
          // Show campaigns where Scope = "Campus"
          return campaign.scope === 'Campus';
        }
        return true;
      });
    }

    // 4. FOURTH: Filter by search query (campaign name)
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(campaign =>
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredCampaigns = getFilteredCampaigns();

  // NEW: Handle search functionality
  const handleSearch = () => {
    // Search is performed in real-time via getFilteredCampaigns
    // This function can be used for additional search actions if needed
    console.log('Searching for:', searchQuery);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // NEW: Handle role switching
  const handleRoleSwitch = (newRole) => {
    // Call the function passed down from App
    onRoleSwitch(newRole);
    
    // Reset filters when switching roles
    setSelectedCampusFilter('all');
    setSelectedStatus('Published');
    setSearchQuery('');
    setSelectedCampaignType('all');
    
    // Close dropdown
    setShowRoleSwitcher(false);
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (e) => {
    if (!e.target.closest('.user-indicator')) {
      setShowRoleSwitcher(false);
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle closing a campaign
const handleCloseCampaign = async (campaignId) => {
  try {
    // Import the function to update campaign status
    const { updateCampaignStatus } = await import('./airtable');
    
    // Update status to Closed in Airtable
    await updateCampaignStatus(campaignId, 'Closed');
    
    // Refresh the campaigns list to show the updated status
    const { fetchCampuses } = await import('./airtable');
    const [campaignData, campusData] = await Promise.all([
      fetchCampaigns(),
      fetchCampuses()
    ]);
    
    // Apply the same filtering logic as before
    let filteredCampaigns;
    if (userRole === 'org-admin') {
      filteredCampaigns = campaignData;
    } else if (userRole === 'single-campus' || userRole === 'multi-campus') {
      filteredCampaigns = campaignData.filter(campaign => {
        return campaign.assignedCampuses && 
               campaign.assignedCampuses.some(campusId => userCampuses.includes(campusId));
      });
    } else {
      filteredCampaigns = campaignData;
    }
    
    setCampaigns(filteredCampaigns);
    
    // Close modal and reset
    setShowCloseModal(false);
    setCampaignToClose(null);
    setOpenDropdown(null);
    
    console.log('Campaign closed successfully');
  } catch (error) {
    console.error('Failed to close campaign:', error);
    alert('Failed to close campaign. Please try again.');
  }
};

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
          <div className="user-indicator" onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}>
            <span className="user-role-name">
              {userRole === 'org-admin' ? 'Org Admin' : 
              userRole === 'single-campus' ? 'Single Campus Admin' : 
              userRole === 'multi-campus' ? 'Multi Campus Admin' : 'User'}
            </span>
            <div className="user-icon">👤</div>
            <span className="dropdown-arrow">▼</span>
            
            {/* Role Switcher Dropdown */}
            {showRoleSwitcher && (
              <div className="role-switcher-dropdown">
                <div className="role-switcher-header">Switch Role</div>
                <div 
                  className={`role-option ${userRole === 'org-admin' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRoleSwitch('org-admin');
                  }}
                >
                  <span className="role-icon">🏢</span>
                  <div className="role-info">
                    <div className="role-name">Org Admin</div>
                    <div className="role-description">All campaigns & campuses</div>
                  </div>
                </div>
                <div 
                  className={`role-option ${userRole === 'single-campus' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRoleSwitch('single-campus');
                  }}
                >
                  <span className="role-icon">🏛️</span>
                  <div className="role-info">
                    <div className="role-name">Single Campus Admin</div>
                    <div className="role-description">All Saints Downtown</div>
                  </div>
                </div>
                <div 
                  className={`role-option ${userRole === 'multi-campus' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRoleSwitch('multi-campus');
                  }}
                >
                  <span className="role-icon">🏬</span>
                  <div className="role-info">
                    <div className="role-name">Multi Campus Admin</div>
                    <div className="role-description">3 assigned campuses</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard */}
        <div className="dashboard">
          <div className="dashboard-header">
            <h1>Campaigns</h1>
            <div className="header-actions">
              <select 
                className="campus-filter"
                value={selectedCampusFilter}
                onChange={(e) => {
                  console.log('Campus filter changed to:', e.target.value);
                  setSelectedCampusFilter(e.target.value);
                }}
                disabled={loadingCampuses}
              >
                <option value="all">All Campuses</option>
                {availableCampuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
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
            <button 
              className={`tab ${selectedStatus === 'Published' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('Published')}
            >
              Published
            </button>
            <button 
              className={`tab ${selectedStatus === 'Draft' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('Draft')}
            >
              Draft
            </button>
            <button 
              className={`tab ${selectedStatus === 'Closed' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('Closed')}
            >
              Closed
            </button>
          </div>

          <div className="search-section">
            <div className="search-container">
              <span className="search-label">Find campaign</span>
              <input 
                type="text" 
                placeholder="Search campaigns..." 
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button 
                className="search-btn"
                onClick={handleSearch}
              >
                🔍
              </button>
              <div className="campaign-type-dropdown">
                <select 
                  className="campaign-type-select"
                  value={selectedCampaignType}
                  onChange={(e) => setSelectedCampaignType(e.target.value)}
                >
                  <option value="all">All campaigns</option>
                  <option value="campus">Campus</option>
                  <option value="organization">Organization</option>
                </select>
              </div>
            </div>
            <button className="sort-btn">⚙️</button>
          </div>

          {/* NEW: Search Results Indicator */}
          {(selectedCampusFilter !== 'all' || searchQuery.trim() !== '' || selectedCampaignType !== 'all') && (
            <div style={{ 
              marginBottom: '16px', 
              fontSize: '14px', 
              color: '#6b7280',
              padding: '8px 0'
            }}>
              Showing {filteredCampaigns.length} of {campaigns.filter(c => (c.status || 'Draft') === selectedStatus).length} {selectedStatus.toLowerCase()} campaigns
              {selectedCampusFilter !== 'all' && (
                <span>
                  {' for '}
                  <strong>
                    {availableCampuses.find(c => c.id === selectedCampusFilter)?.name || 'Selected Campus'}
                  </strong>
                </span>
              )}
              {selectedCampaignType !== 'all' && ` (${selectedCampaignType} campaigns)`}
              {searchQuery.trim() !== '' && ` matching "${searchQuery}"`}
              <button 
                onClick={() => {
                  setSelectedCampusFilter('all');
                  setSearchQuery('');
                  setSelectedCampaignType('all');
                }}
                style={{
                  marginLeft: '12px',
                  background: 'none',
                  border: 'none',
                  color: '#10b981',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '14px'
                }}
              >
                Clear all filters
              </button>
            </div>
          )}

          <div className="campaigns-list">
            {loadingCampaigns ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                Loading campaigns...
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                {selectedCampusFilter !== 'all' || searchQuery.trim() !== '' || selectedCampaignType !== 'all' ? (
                  <div>
                    <div style={{ marginBottom: '8px' }}>
                      No campaigns found matching your filter criteria.
                    </div>
                    {selectedCampusFilter !== 'all' && (
                      <div style={{ marginBottom: '4px', fontSize: '13px' }}>
                        Campus: <strong>{availableCampuses.find(c => c.id === selectedCampusFilter)?.name}</strong>
                      </div>
                    )}
                    {selectedCampaignType !== 'all' && (
                      <div style={{ marginBottom: '4px', fontSize: '13px' }}>
                        Type: <strong>{selectedCampaignType}</strong>
                      </div>
                    )}
                    {searchQuery.trim() !== '' && (
                      <div style={{ marginBottom: '8px', fontSize: '13px' }}>
                        Search: <strong>"{searchQuery}"</strong>
                      </div>
                    )}
                    <button 
                      onClick={() => {
                        setSelectedCampusFilter('all');
                        setSearchQuery('');
                        setSelectedCampaignType('all');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#10b981',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Clear all filters and show all campaigns
                    </button>
                  </div>
                ) : (
                  <div>
                    No campaigns found. 
                    <span 
                      onClick={() => navigate('/create-campaign')}
                      style={{ color: '#10b981', cursor: 'pointer', textDecoration: 'underline', marginLeft: '4px' }}
                    >
                      Create your first campaign
                    </span>
                  </div>
                )}
              </div>
            ) : (
              filteredCampaigns.map((campaign) => (
                <div key={campaign.id} className="campaign-card">
                  <div className="campaign-header">
                    <div className="campaign-title">
                      <h3 
                        onClick={() => navigate(`/campaign/${campaign.id}`)}
                        style={{ cursor: 'pointer', color: '#10b981' }}
                        onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                      >
                        {campaign.name}
                      </h3>
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
                          <div 
                            className="dropdown-item"
                            onClick={() => {
                              navigate(`/campaign/${campaign.id}`);
                              setOpenDropdown(null);
                            }}
                          >
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
                          <div 
                            className={`dropdown-item ${campaign.status === 'Closed' ? 'disabled' : ''}`}
                            style={{
                              opacity: campaign.status === 'Closed' ? 0.5 : 1,
                              cursor: campaign.status === 'Closed' ? 'not-allowed' : 'pointer',
                              pointerEvents: campaign.status === 'Closed' ? 'none' : 'auto'
                            }}
                            onClick={() => {
                              if (campaign.status !== 'Closed') {
                                setCampaignToClose(campaign);
                                setShowCloseModal(true);
                              }
                            }}
                          >
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

{/* Close Campaign Confirmation Modal */}
{showCloseModal && campaignToClose && (
  <div className="modal-overlay">
    <div className="modal-container">
      <h3 className="modal-title">Close Campaign</h3>
      <p className="modal-message">
        Are you sure you want to close <strong>"{campaignToClose.name}"</strong>? This action cannot be undone.
      </p>
      <div className="modal-actions">
        <button 
          className="modal-btn-cancel"
          onClick={() => {
            setShowCloseModal(false);
            setCampaignToClose(null);
          }}
        >
          Cancel
        </button>
        <button 
          className="modal-btn-confirm"
          onClick={() => handleCloseCampaign(campaignToClose.id)}
        >
          Close Campaign
        </button>
      </div>
    </div>
  </div>
)}

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

    // NEW: Handle role switching from dropdown
    const handleRoleSwitch = (newRole) => {
      // Set new role and campuses (same logic as RoleSelection)
      let campuses = [];
      if (newRole === 'single-campus') {
        campuses = ['recusI88Dphjsw6Im'];
      } else if (newRole === 'multi-campus') {
        campuses = ['recNFIxsiUGI0QoIQ', 'recEUc2GcIfGP37ui', 'reckRhX1AxWoRQfYe'];
      } else {
        campuses = [];
      }
      
      // Update main App state
      setUserRole(newRole);
      setUserCampuses(campuses);
      
      // Save to localStorage
      localStorage.setItem('userRole', newRole);
      localStorage.setItem('userCampuses', JSON.stringify(campuses));
      
      console.log('App: Switched to role:', newRole, 'with campuses:', campuses);
    };

  return (
    <Router>
       <Routes>
        <Route path="/" element={<RoleSelection setUserRole={setUserRole} setUserCampuses={setUserCampuses} />} />
        <Route path="/org-admin" element={<OrgAdmin userRole={userRole} userCampuses={userCampuses} onRoleSwitch={handleRoleSwitch} />} />
        <Route path="/single-campus" element={<OrgAdmin userRole={userRole} userCampuses={userCampuses} onRoleSwitch={handleRoleSwitch} />} />
        <Route path="/multi-campus" element={<OrgAdmin userRole={userRole} userCampuses={userCampuses} onRoleSwitch={handleRoleSwitch} />} />
        <Route path="/campaign/:id" element={<CampaignDetail userRole={userRole} userCampuses={userCampuses} />} />
        <Route path="/create-campaign" element={<CreateCampaign />} />
        <Route path="/assign-campuses" element={<AssignCampuses />} />
      </Routes>
    </Router>
  )
}

export default App