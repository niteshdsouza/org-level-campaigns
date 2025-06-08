import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import './CampaignDetail.css';
import { fetchCampaignById, fetchCampaignDonors } from './airtable';


function CampaignDetail({ userRole, userCampuses }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('campus');
  const [selectedCampus, setSelectedCampus] = useState(null);
  const [donors, setDonors] = useState([]);
  
  // NEW: Search functionality state
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real campaign data and donors
  useEffect(() => {
    const loadCampaign = async () => {
      try {
        setLoading(true);
        
        // Fetch campaign data and donor data in parallel
        const [campaignData, donorData] = await Promise.all([
          fetchCampaignById(id),
          fetchCampaignDonors(id)
        ]);
        
        setCampaign(campaignData);
        setDonors(donorData);
      } catch (error) {
        console.error('Failed to load campaign:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadCampaign();
  }, [id]);

  // NEW: Clear search when switching tabs
  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  // NEW: Filter data based on active tab and search query
  const getFilteredData = () => {
    if (activeTab === 'campus') {
      // Filter campuses by name
      if (!campaign?.campusBreakdown) return [];
      
      return campaign.campusBreakdown.filter(campus =>
        campus.campusName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      // Filter members by name or email
      let filteredMembers = donors.filter(donor =>
        donor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        donor.email.toLowerCase().includes(searchQuery.toLowerCase())
      );

      // Apply campus filter if selected
      if (selectedCampus) {
        filteredMembers = filteredMembers.filter(donor => 
          donor.campusIds.includes(selectedCampus.campusId)
        );
      }

      return filteredMembers;
    }
  };

  // NEW: Get search placeholder based on active tab
  const getSearchPlaceholder = () => {
    return activeTab === 'campus' 
      ? 'Search campuses...' 
      : 'Search members...';
  };

  // NEW: Get search label based on active tab
  const getSearchLabel = () => {
    return activeTab === 'campus' 
      ? 'Find campus' 
      : 'Find member';
  };

  const calculateDuration = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      const days = diffDays % 30;
      return `${months} month${months > 1 ? 's' : ''} ${days} day${days !== 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? 's' : ''}`;
    }
  };

  // Define breadcrumbs for this page
  const breadcrumbs = [
    { text: 'Campaigns', link: '/org-admin' },
    { text: 'Overview', link: '/org-admin' },
    { text: campaign?.name || 'Loading...' }
  ];

  // NEW: Get filtered data for current view
  const filteredData = getFilteredData();

  if (loading) {
    return (
        <Layout breadcrumbs={[{ text: 'Campaigns', link: '/org-admin' }, { text: 'Loading...' }]} userRole={userRole} userCampuses={userCampuses}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Loading campaign details...
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumbs={breadcrumbs} userRole={userRole} userCampuses={userCampuses}>
      {/* Campaign Detail Header */}
      <div className="campaign-detail-header">
        <div className="campaign-detail-title">
          <h1>{campaign?.name}</h1>
          <div className="campaign-detail-badges">
            <span className="detail-badge org">
              {campaign?.scope === 'Org' ? 'Org campaign' : 'Campus campaign'}
            </span>
            <span className="detail-badge live">
              {campaign?.status}
            </span>
          </div>
        </div>
        
        <div className="campaign-detail-actions">
          <button className="detail-action-btn primary">Add a pledge</button>
          <button className="detail-action-btn secondary">Add a gift</button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="campaign-overview">
        <h2 className="overview-title">Overview</h2>
        
        <div className="overview-stats">
          <div className="overview-stat">
            <div className="overview-stat-value">${campaign?.totalRaised?.toLocaleString()}</div>
            <div className="overview-stat-label">Total Given</div>
            <div className="overview-stat-sublabel">Left to goal (given)</div>
          </div>
          
          <div className="overview-stat">
            <div className="overview-stat-value">${campaign?.totalPledged?.toLocaleString()}</div>
            <div className="overview-stat-label">Pledged</div>
            <div className="overview-stat-sublabel">Left to goal (pledged)</div>
          </div>
          
          <div className="overview-stat">
            <div className="overview-stat-value">${campaign?.financialGoal?.toLocaleString()}</div>
            <div className="overview-stat-label">Goal</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="detail-progress-section">
          <div className="detail-progress-bar">
            <div 
              className="detail-progress-fill"
              style={{
                width: campaign?.financialGoal > 0 
                  ? `${Math.min((campaign?.totalRaised / campaign?.financialGoal) * 100, 100)}%`
                  : '0%'
              }}
            ></div>
          </div>
          <div className="detail-progress-labels">
            <span>
              {campaign?.financialGoal > 0 
                ? `${Math.round((campaign?.totalRaised / campaign?.financialGoal) * 100)}%`
                : '0%'
              } Given
            </span>
            <span>
              {campaign?.financialGoal > 0 
                ? `${Math.round((campaign?.totalPledged / campaign?.financialGoal) * 100)}%`
                : '0%'
              } Pledged
            </span>
          </div>
        </div>

        {/* Individual Stats Row */}
        <div className="individual-stats">
          <div className="individual-stat">
            <div className="stat-content">
              <div className="stat-label">Individual gifts</div>
              <div className="stat-value">{campaign?.giftCount?.toLocaleString() || '0'}</div>
            </div>
          </div>

          <div className="individual-stat">
            <div className="stat-content">
              <div className="stat-label">Individual pledges</div>
              <div className="stat-value">{campaign?.pledgeCount?.toLocaleString() || '0'}</div>
            </div>
          </div>

          <div className="individual-stat">
            <div className="stat-content">
              <div className="stat-label">Total Recurring Schedules</div>
              <div className="stat-value">0</div>
            </div>
          </div>
        </div>

        {/* Campaign Timeline */}
        <div className="campaign-timeline">
          {campaign?.startDate && campaign?.endDate ? (
            <span>
              Started {new Date(campaign.startDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })} • 
              Ends {new Date(campaign.endDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })} • 
              Opened for {calculateDuration(campaign.startDate, campaign.endDate)}
            </span>
          ) : (
            <span>Campaign dates not set</span>
          )}
        </div>
      </div>

      {/* Campus Breakdown Table */}
      <div className="campus-breakdown">
        {/* Tab Section */}
        <div className="breakdown-tabs">
          <button 
            className={`breakdown-tab ${activeTab === 'campus' ? 'active' : ''}`}
            onClick={() => setActiveTab('campus')}
          >
            Campus ({campaign?.campusBreakdown?.length || 0})
          </button>
          <button 
            className={`breakdown-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members ({donors.length})
            {selectedCampus && (
              <span className="tab-filter-indicator">
                • {selectedCampus.campusName}
              </span>
            )}
          </button>
          
          {selectedCampus && (
            <button 
              className="clear-filter-btn"
              onClick={() => setSelectedCampus(null)}
              title="Clear campus filter"
            >
              ✕
            </button>
          )}
        </div>

        <div className="breakdown-header">
          <div className="breakdown-search">
            <span className="search-label" style={{ fontSize: '14px', color: '#374151', fontWeight: '500', marginRight: '8px' }}>
              {getSearchLabel()}
            </span>
            <input 
              type="text" 
              placeholder={getSearchPlaceholder()}
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="search-button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </button>
          </div>
          
          <button className="export-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7,10 12,15 17,10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>

        {/* NEW: Results count indicator */}
        {searchQuery && (
          <div style={{ 
            marginBottom: '16px', 
            fontSize: '14px', 
            color: '#6b7280',
            padding: '8px 0',
            borderBottom: '1px solid #f3f4f6'
          }}>
            Showing {filteredData.length} of {activeTab === 'campus' 
              ? (campaign?.campusBreakdown?.length || 0) 
              : (selectedCampus 
                  ? donors.filter(donor => donor.campusIds.includes(selectedCampus.campusId)).length
                  : donors.length
                )
            } {activeTab} matching "{searchQuery}"
          </div>
        )}

        {activeTab === 'campus' ? (
          // Campus Tab Content
          filteredData.length > 0 ? (
            <table className="breakdown-table">
              <thead>
                <tr>
                  <th>Campus</th>
                  <th>Total pledged</th>
                  <th>Total raised</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((campus) => (
                  <tr key={campus.campusId}>
                    <td>
                      <span 
                        className="campus-name-cell"
                        onClick={() => {
                          setSelectedCampus(campus);
                          setActiveTab('members');
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {campus.campusName}
                      </span>
                    </td>
                    <td>${campus.pledged?.toLocaleString() || '0'}</td>
                    <td>${campus.raised?.toLocaleString() || '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              {searchQuery 
                ? `No campuses found matching "${searchQuery}"`
                : 'No campus data available for this campaign'
              }
            </div>
          )
        ) : (
          // Members Tab Content
          <div className="members-content">
            <div className="members-header">
              <h3>
                {selectedCampus ? `${selectedCampus.campusName} Donors` : 'All Campaign Donors'}
              </h3>
              <span className="donor-count">
                {filteredData.length} donors
                {searchQuery && ` (filtered)`}
              </span>
            </div>
            
            {filteredData.length > 0 ? (
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email Address</th>
                    <th>Home campus</th>
                    <th>Date pledged</th>
                    <th>Pledged amount</th>
                    <th>Given amount</th>
                    <th>Remaining</th>
                    <th>Progress</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((donor) => (
                    <tr key={donor.donorId}>
                      <td>
                        <div className="donor-name">{donor.name}</div>
                      </td>
                      <td>
                        <div className="donor-email">{donor.email}</div>
                      </td>
                      <td>{donor.homeCampus || 'Not specified'}</td>
                      <td>
                        {donor.datePledged 
                          ? new Date(donor.datePledged).toLocaleDateString('en-US', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric' 
                            })
                          : 'No pledge date'
                        }
                      </td>
                      <td>${donor.pledgedAmount?.toLocaleString() || '0'}</td>
                      <td>${donor.givenAmount?.toLocaleString() || '0'}</td>
                      <td>${donor.remaining?.toLocaleString() || '0'}</td>
                      <td>
                        <div className="progress-cell">
                          <div className="progress-bar-small">
                            <div 
                              className="progress-fill-small"
                              style={{ width: `${Math.min(donor.progress, 100)}%` }}
                            ></div>
                          </div>
                          <span className="progress-text-small">{donor.progress.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td>
                        <button className="row-menu-btn">⋯</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                {searchQuery 
                  ? `No members found matching "${searchQuery}"`
                  : selectedCampus 
                    ? `No donors found for ${selectedCampus.campusName}`
                    : 'No donor data available for this campaign'
                }
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default CampaignDetail;